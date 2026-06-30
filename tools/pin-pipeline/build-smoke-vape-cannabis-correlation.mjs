import fs from 'node:fs/promises';
import path from 'node:path';

const COMPLAINT_FILE = 'data/nycif_smoke_cannabis_vape_intel.json';
const DISPENSARY_FILE = 'data/nycif_legal_cannabis_dispensaries.json';
const RETAILER_FILE = 'data/nycif_licensed_smoke_vape_retailers_slim.json';
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const OUT_FILE = path.join(OUT_DIR, 'nycif_smoke_vape_cannabis_correlation.json');
const REVIEW_FILE = path.join(OUT_DIR, 'nycif_smoke_vape_cannabis_correlation_needs_review.json');
const REPORT_FILE = path.join(REPORT_DIR, 'smoke_vape_cannabis_correlation_report.json');

const RADII_FEET = [100, 250, 500];
const WINDOWS_DAYS = [30, 90, 180, 365];
const GRID_SIZE_DEGREES = Number(process.env.NYCIF_SMOKE_CORRELATION_GRID_SIZE_DEGREES || 0.004);
const MIN_SIGNAL_SCORE = Number(process.env.NYCIF_SMOKE_CORRELATION_MIN_SCORE || 3);

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function numberFrom(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNYCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.4774 && lat <= 40.9176 && lng >= -74.2591 && lng <= -73.7004;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysBetween(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
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

async function readJsonArray(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error(`${file} did not contain an array`);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function normalizeLocation(row, index, kind) {
  const lat = Number.parseFloat(row.lat);
  const lng = Number.parseFloat(row.lng);
  if (!isNYCoord(lat, lng)) return null;
  return {
    id: clean(row.id || row.raw_source_id || `${kind}-${index}`),
    location_kind: kind,
    title: clean(row.title || row.dba || row.name || `${kind} ${index + 1}`),
    address: clean(row.address),
    borough: clean(row.borough),
    lat,
    lng,
    license_status: clean(row.license_status),
    license_type: clean(row.license_type || row.license),
    source_url: clean(row.source_url),
    raw: row
  };
}

function normalizeComplaint(row, index) {
  const lat = Number.parseFloat(row.lat);
  const lng = Number.parseFloat(row.lng);
  if (!isNYCoord(lat, lng)) return null;
  const createdAt = parseDate(row.created_date);
  return {
    id: clean(row.id || row.raw_source_id || `complaint-${index}`),
    subtype: clean(row.subtype),
    subtype_label: clean(row.subtype_label),
    complaint_type: clean(row.complaint_type),
    descriptor: clean(row.descriptor),
    created_date: clean(row.created_date),
    created_at: createdAt,
    address: clean(row.address),
    borough: clean(row.borough),
    lat,
    lng
  };
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

function nearbyComplaints(location, grid) {
  const output = [];
  for (const key of neighborGridKeys(location.lat, location.lng)) {
    for (const complaint of grid.get(key) || []) {
      const feet = distanceFeet(location, complaint);
      if (feet <= 500) output.push({ ...complaint, distance_feet: Math.round(feet) });
    }
  }
  return output;
}

function topCounts(values, limit = 8) {
  const counts = new Map();
  for (const value of values.map(clean).filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([value, count]) => ({ value, count }));
}

function tierFor(score) {
  if (score >= 50) return 'very_high';
  if (score >= 20) return 'high';
  if (score >= 3) return 'moderate';
  return 'low';
}

function scoreLocation(location, complaints, now) {
  const counts = {};
  for (const days of WINDOWS_DAYS) {
    for (const feet of RADII_FEET) counts[`complaints_${days}d_${feet}ft`] = 0;
  }

  let lastComplaintDate = '';
  const subtypes = [];
  const descriptors = [];
  const complaintIds = [];

  for (const complaint of complaints) {
    if (!complaint.created_at) continue;
    const ageDays = daysBetween(now, complaint.created_at);
    if (ageDays < 0 || ageDays > 365) continue;

    for (const days of WINDOWS_DAYS) {
      if (ageDays > days) continue;
      for (const feet of RADII_FEET) {
        if (complaint.distance_feet <= feet) counts[`complaints_${days}d_${feet}ft`] += 1;
      }
    }

    if (complaint.distance_feet <= 250) {
      subtypes.push(complaint.subtype_label || complaint.subtype);
      descriptors.push(complaint.descriptor);
      complaintIds.push(complaint.id);
      if (!lastComplaintDate || complaint.created_date > lastComplaintDate) lastComplaintDate = complaint.created_date;
    }
  }

  const regulatedBonus = location.location_kind === 'legal_cannabis_dispensary' ? 2 : 1;
  const signalScore =
    counts.complaints_30d_100ft * 5 +
    counts.complaints_90d_100ft * 3 +
    counts.complaints_365d_100ft +
    counts.complaints_365d_250ft +
    regulatedBonus;

  return {
    ...location,
    ...counts,
    top_complaint_subtypes: topCounts(subtypes),
    top_complaint_descriptors: topCounts(descriptors),
    last_complaint_date: lastComplaintDate ? lastComplaintDate.slice(0, 10) : '',
    nearby_complaint_ids_sample: complaintIds.slice(0, 10),
    signal_score: signalScore,
    signal_tier: tierFor(signalScore),
    include: signalScore >= MIN_SIGNAL_SCORE,
    data_note: 'Complaint activity near regulated location; not proof of causation, illegal activity, or wrongdoing.'
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = clean(item[key]) || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const complaintsRaw = await readJsonArray(COMPLAINT_FILE);
  const dispensariesRaw = await readJsonArray(DISPENSARY_FILE);
  const retailersRaw = await readJsonArray(RETAILER_FILE);

  const complaints = complaintsRaw.map(normalizeComplaint).filter(Boolean);
  const locations = [
    ...dispensariesRaw.map((row, index) => normalizeLocation(row, index, 'legal_cannabis_dispensary')).filter(Boolean),
    ...retailersRaw.map((row, index) => normalizeLocation(row, index, 'licensed_smoke_vape_retailer')).filter(Boolean)
  ];

  const grid = buildComplaintGrid(complaints);
  const now = new Date();
  const scored = locations.map(location => scoreLocation(location, nearbyComplaints(location, grid), now));
  const output = scored.filter(item => item.include).sort((a, b) => b.signal_score - a.signal_score || a.title.localeCompare(b.title));
  const needsReview = scored.filter(item => !item.include).map(item => ({ status: 'rejected', reason: 'low_signal', ...item })).slice(0, 5000);

  const report = {
    complaint_file: COMPLAINT_FILE,
    dispensary_file: DISPENSARY_FILE,
    retailer_file: RETAILER_FILE,
    source_complaints: complaintsRaw.length,
    usable_complaints: complaints.length,
    source_dispensaries: dispensariesRaw.length,
    source_retailers: retailersRaw.length,
    correlation_locations: locations.length,
    output_locations: output.length,
    low_signal_excluded: scored.length - output.length,
    radius_feet: RADII_FEET,
    windows_days: WINDOWS_DAYS,
    min_signal_score: MIN_SIGNAL_SCORE,
    location_kind_counts: countBy(output, 'location_kind'),
    borough_counts: countBy(output, 'borough'),
    signal_tier_counts: countBy(output, 'signal_tier'),
    top_locations_sample: output.slice(0, 25).map(item => ({
      title: item.title,
      location_kind: item.location_kind,
      address: item.address,
      borough: item.borough,
      signal_score: item.signal_score,
      signal_tier: item.signal_tier,
      complaints_365d_100ft: item.complaints_365d_100ft,
      complaints_365d_250ft: item.complaints_365d_250ft,
      last_complaint_date: item.last_complaint_date
    })),
    generated_at: new Date().toISOString(),
    data_note: 'Complaint activity near regulated location; not proof of causation, illegal activity, or wrongdoing.'
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
