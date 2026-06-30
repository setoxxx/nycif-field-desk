import fs from 'node:fs/promises';
import path from 'node:path';

const VENUE_FILE = 'data/nycif_nightlife_spots.json';
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const OUT_FILE = path.join(OUT_DIR, 'nycif_nightlife_noise_correlation.json');
const REVIEW_FILE = path.join(OUT_DIR, 'nycif_nightlife_noise_correlation_needs_review.json');
const REPORT_FILE = path.join(REPORT_DIR, 'nightlife_noise_correlation_report.json');

const SOURCE_URL = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json';
const FETCH_LIMIT = Number(process.env.NYCIF_NOISE_FETCH_LIMIT || 50000);
const MAX_ROWS = Number(process.env.NYCIF_NOISE_MAX_ROWS || 250000);
const LOOKBACK_DAYS = Number(process.env.NYCIF_NOISE_LOOKBACK_DAYS || 365);
const MIN_TREND_SCORE = Number(process.env.NYCIF_NIGHTLIFE_MIN_TREND_SCORE || 12);
const MIN_365D_100FT = Number(process.env.NYCIF_NIGHTLIFE_MIN_365D_100FT || 3);
const MIN_90D_250FT = Number(process.env.NYCIF_NIGHTLIFE_MIN_90D_250FT || 5);
const GRID_SIZE_DEGREES = Number(process.env.NYCIF_NOISE_GRID_SIZE_DEGREES || 0.004);

const RADII_FEET = [100, 250, 500];
const WINDOWS_DAYS = [30, 90, 180, 365];
const NYC_BOROUGHS = ['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND'];
const NOISE_COMPLAINT_TYPES = [
  'Noise - Commercial',
  'Noise - Street/Sidewalk',
  'Noise - Residential',
  'Noise - Park',
  'Noise - Vehicle'
];
const NIGHTLIFE_DESCRIPTORS = [
  'Loud Music/Party',
  'Loud Talking',
  'Banging/Pounding',
  'Car/Truck Music'
];

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function norm(value) {
  return clean(value).toLowerCase();
}

function numberFrom(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isNYCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.4774 && lat <= 40.9176 && lng >= -74.2591 && lng <= -73.7004;
}

function escapeSoql(value) {
  return String(value).replace(/'/g, "''");
}

function isoDateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysBetween(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

function isLateNight(date) {
  const hour = date.getHours();
  return hour >= 21 || hour < 5;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 5 || day === 6 || day === 0;
}

function distanceFeet(a, b) {
  const earthFeet = 20902231;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthFeet * Math.asin(Math.sqrt(h));
}

function gridKey(lat, lng) {
  return `${Math.floor(lat / GRID_SIZE_DEGREES)}:${Math.floor(lng / GRID_SIZE_DEGREES)}`;
}

function neighborGridKeys(lat, lng) {
  const y = Math.floor(lat / GRID_SIZE_DEGREES);
  const x = Math.floor(lng / GRID_SIZE_DEGREES);
  const keys = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) keys.push(`${y + dy}:${x + dx}`);
  }
  return keys;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readJsonArray(file) {
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${file} did not contain an array`);
  return parsed;
}

function normalizeVenue(row, index) {
  const lat = numberFrom(row.lat);
  const lng = numberFrom(row.lng);
  if (!isNYCoord(lat, lng)) {
    return { status: 'needs_review', reason: 'invalid_venue_coordinates', raw_source_id: row.id || row.raw_source_id || `venue-${index}`, raw: row };
  }

  return {
    status: 'ok',
    id: clean(row.id || row.raw_source_id || `venue-${index}`),
    title: clean(row.title || 'Nightlife spot'),
    address: clean(row.address),
    borough: clean(row.borough),
    lat,
    lng,
    subtype: clean(row.subtype),
    subtype_label: clean(row.subtype_label),
    group: Number(row.group || 0),
    license: clean(row.license),
    source_url: row.source_url || '',
    raw_source_id: clean(row.raw_source_id || row.id || `venue-${index}`)
  };
}

function normalizeComplaint(row) {
  const lat = numberFrom(row.latitude || row.lat || row.y);
  const lng = numberFrom(row.longitude || row.lng || row.lon || row.x);
  if (!isNYCoord(lat, lng)) return null;

  const createdAt = parseDate(row.created_date);
  if (!createdAt) return null;

  return {
    id: clean(row.unique_key || row.id),
    complaint_type: clean(row.complaint_type),
    descriptor: clean(row.descriptor),
    borough: clean(row.borough),
    incident_address: clean(row.incident_address),
    created_date: row.created_date,
    created_at: createdAt,
    lat,
    lng
  };
}

function complaintWhereClause(sinceIso) {
  const types = NOISE_COMPLAINT_TYPES.map(value => `'${escapeSoql(value)}'`).join(',');
  const descriptors = NIGHTLIFE_DESCRIPTORS.map(value => `'${escapeSoql(value)}'`).join(',');
  const boroughs = NYC_BOROUGHS.map(value => `'${escapeSoql(value)}'`).join(',');
  return [
    `created_date >= '${sinceIso}'`,
    `complaint_type in (${types})`,
    `descriptor in (${descriptors})`,
    `borough in (${boroughs})`,
    'latitude is not null',
    'longitude is not null'
  ].join(' AND ');
}

function buildComplaintUrl(offset, sinceIso) {
  const params = new URLSearchParams();
  params.set('$limit', String(FETCH_LIMIT));
  params.set('$offset', String(offset));
  params.set('$order', 'created_date DESC');
  params.set('$select', 'unique_key,created_date,complaint_type,descriptor,borough,incident_address,latitude,longitude');
  params.set('$where', complaintWhereClause(sinceIso));
  return `${SOURCE_URL}?${params}`;
}

async function fetchComplaints() {
  const sinceIso = isoDateDaysAgo(LOOKBACK_DAYS);
  const rows = [];

  for (let offset = 0; offset < MAX_ROWS; offset += FETCH_LIMIT) {
    const url = buildComplaintUrl(offset, sinceIso);
    console.log(`Fetching 311 noise complaints ${offset}-${offset + FETCH_LIMIT}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`311 fetch failed: HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('311 source did not return an array');
    rows.push(...batch);
    if (batch.length < FETCH_LIMIT) break;
  }

  return { rows, sinceIso };
}

function buildComplaintGrid(complaints) {
  const grid = new Map();
  for (const complaint of complaints) {
    const key = gridKey(complaint.lat, complaint.lng);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(complaint);
  }
  return grid;
}

function nearbyComplaints(venue, grid) {
  const output = [];
  for (const key of neighborGridKeys(venue.lat, venue.lng)) {
    for (const complaint of grid.get(key) || []) {
      const feet = distanceFeet(venue, complaint);
      if (feet <= 500) output.push({ ...complaint, distance_feet: Math.round(feet) });
    }
  }
  return output;
}

function topCounts(values, limit = 5) {
  const counts = new Map();
  for (const value of values.map(clean).filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function tierFor(score) {
  if (score >= 80) return 'very_high';
  if (score >= 40) return 'high';
  if (score >= 12) return 'moderate';
  return 'low';
}

function scoreVenue(venue, complaints, now) {
  const counts = {};
  for (const windowDays of WINDOWS_DAYS) {
    for (const radius of RADII_FEET) counts[`complaints_${windowDays}d_${radius}ft`] = 0;
  }

  let lateNightComplaints365d = 0;
  let weekendComplaints365d = 0;
  let lastComplaintDate = '';
  const descriptors = [];
  const complaintTypes = [];
  const matchedIds = [];

  for (const complaint of complaints) {
    const ageDays = daysBetween(now, complaint.created_at);
    if (ageDays < 0 || ageDays > 365) continue;

    for (const windowDays of WINDOWS_DAYS) {
      if (ageDays > windowDays) continue;
      for (const radius of RADII_FEET) {
        if (complaint.distance_feet <= radius) counts[`complaints_${windowDays}d_${radius}ft`] += 1;
      }
    }

    if (complaint.distance_feet <= 250) {
      descriptors.push(complaint.descriptor);
      complaintTypes.push(complaint.complaint_type);
      matchedIds.push(complaint.id);
      if (isLateNight(complaint.created_at)) lateNightComplaints365d += 1;
      if (isWeekend(complaint.created_at)) weekendComplaints365d += 1;
      if (!lastComplaintDate || complaint.created_date > lastComplaintDate) lastComplaintDate = complaint.created_date;
    }
  }

  const groupOneBonus = venue.group === 1 ? 8 : 0;
  const trendScore =
    counts.complaints_30d_100ft * 5 +
    counts.complaints_90d_100ft * 3 +
    counts.complaints_365d_100ft +
    lateNightComplaints365d +
    weekendComplaints365d +
    groupOneBonus;

  const include = trendScore >= MIN_TREND_SCORE || counts.complaints_365d_100ft >= MIN_365D_100FT || counts.complaints_90d_250ft >= MIN_90D_250FT;

  return {
    ...venue,
    ...counts,
    late_night_complaints_365d: lateNightComplaints365d,
    weekend_complaints_365d: weekendComplaints365d,
    top_noise_descriptors: topCounts(descriptors, 5),
    top_complaint_types: topCounts(complaintTypes, 5),
    last_complaint_date: lastComplaintDate ? lastComplaintDate.slice(0, 10) : '',
    nearby_complaint_ids_sample: matchedIds.slice(0, 10),
    trend_score: trendScore,
    trend_tier: tierFor(trendScore),
    include,
    include_reason: include ? 'meets_trending_threshold' : 'low_signal'
  };
}

function summarizeBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = clean(typeof key === 'function' ? key(item) : item[key]);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([value, count]) => ({ value, count }));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const rawVenues = await readJsonArray(VENUE_FILE);
  const normalizedVenues = rawVenues.map(normalizeVenue);
  const venueReview = normalizedVenues.filter(item => item.status === 'needs_review');
  const venues = normalizedVenues.filter(item => item.status === 'ok');

  const { rows: complaintRows, sinceIso } = await fetchComplaints();
  const complaints = complaintRows.map(normalizeComplaint).filter(Boolean);
  const complaintGrid = buildComplaintGrid(complaints);
  const now = new Date();

  const scored = venues.map((venue, index) => {
    if (index > 0 && index % 1000 === 0) console.log(`Scored ${index}/${venues.length} venues...`);
    return scoreVenue(venue, nearbyComplaints(venue, complaintGrid), now);
  });

  const output = scored
    .filter(item => item.include)
    .sort((a, b) => b.trend_score - a.trend_score || b.complaints_365d_100ft - a.complaints_365d_100ft || a.title.localeCompare(b.title));

  const lowSignal = scored.filter(item => !item.include);
  const needsReview = [
    ...venueReview,
    ...lowSignal.map(item => ({ status: 'rejected', reason: 'low_signal', ...item })).slice(0, 5000)
  ];

  const report = {
    venue_file: VENUE_FILE,
    source_url: SOURCE_URL,
    queried_since: sinceIso,
    source_venues: rawVenues.length,
    usable_venues: venues.length,
    invalid_venue_coordinates: venueReview.length,
    source_complaints: complaintRows.length,
    usable_complaints: complaints.length,
    matched_venues: scored.filter(item => item.complaints_365d_500ft > 0).length,
    output_venues: output.length,
    low_signal_excluded: lowSignal.length,
    threshold: {
      min_trend_score: MIN_TREND_SCORE,
      min_365d_100ft: MIN_365D_100FT,
      min_90d_250ft: MIN_90D_250FT
    },
    radius_feet: RADII_FEET,
    windows_days: WINDOWS_DAYS,
    top_boroughs: summarizeBy(output, 'borough'),
    top_subtypes: summarizeBy(output, 'subtype_label'),
    top_tiers: summarizeBy(output, 'trend_tier'),
    top_descriptors: topCounts(output.flatMap(item => toArray(item.top_noise_descriptors).map(entry => entry.value)), 20),
    top_venues_sample: output.slice(0, 25).map(item => ({
      title: item.title,
      address: item.address,
      borough: item.borough,
      trend_score: item.trend_score,
      trend_tier: item.trend_tier,
      complaints_365d_100ft: item.complaints_365d_100ft,
      complaints_365d_250ft: item.complaints_365d_250ft,
      last_complaint_date: item.last_complaint_date
    })),
    data_note: '311 complaints are public complaint records and an activity proxy, not proof of wrongdoing, venue popularity, or legal violation.',
    generated_at: new Date().toISOString()
  };

  await fs.writeFile(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
  await fs.writeFile(REVIEW_FILE, `${JSON.stringify(needsReview, null, 2)}\n`);
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`Wrote ${REVIEW_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
