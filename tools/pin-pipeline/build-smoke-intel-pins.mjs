import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json';
const FETCH_LIMIT = Number(process.env.NYCIF_SMOKE_FETCH_LIMIT || 50000);
const MAX_ROWS = Number(process.env.NYCIF_SMOKE_MAX_ROWS || 300000);
const LOOKBACK_DAYS = Number(process.env.NYCIF_SMOKE_LOOKBACK_DAYS || 365);
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const OUT_FILE = path.join(OUT_DIR, 'nycif_smoke_cannabis_vape_intel.json');
const REVIEW_FILE = path.join(OUT_DIR, 'nycif_smoke_cannabis_vape_intel_needs_review.json');
const REPORT_FILE = path.join(REPORT_DIR, 'smoke_cannabis_vape_intel_report.json');

const MATCH_RULES = [
  {
    subtype: 'vape_complaint',
    label: 'Vape / e-cigarette complaint',
    icon: '💨',
    bucket: 'vape_electronic_cigarette',
    terms: ['vape', 'vaping', 'e-cigarette', 'e cigarette', 'ecigarette', 'electronic cigarette', 'electronic cig']
  },
  {
    subtype: 'smoke_shop_complaint',
    label: 'Smoke shop / tobacco retail complaint',
    icon: '⚠️',
    bucket: 'smoke_tobacco_retail',
    terms: ['smoke shop', 'smokeshop', 'tobacco shop', 'tobacco store', 'cigar', 'hookah', 'bodega smoke', 'smoking store']
  },
  {
    subtype: 'cannabis_related_complaint',
    label: 'Cannabis-related complaint',
    icon: '🌿',
    bucket: 'cannabis_marijuana_weed',
    terms: ['cannabis', 'marijuana', 'marihuana', 'weed', 'pot shop', 'dispensary', 'unlicensed cannabis', 'illegal cannabis']
  },
  {
    subtype: 'smoke_odor_complaint',
    label: 'Smoke / cannabis odor complaint',
    icon: '💨',
    bucket: 'odor_smoke_marijuana',
    terms: ['smoke odor', 'smell of smoke', 'odor of smoke', 'marijuana odor', 'marihuana odor', 'cannabis odor', 'weed odor', 'smell of marijuana', 'smell of weed']
  },
  {
    subtype: 'public_smoking_complaint',
    label: 'Public / secondhand smoking complaint',
    icon: '🚬',
    bucket: 'public_secondhand_smoking',
    terms: ['public smoking', 'smoking complaint', 'secondhand smoke', 'smoke free', 'smoke-free', 'smoking ban', 'clean indoor air', 'smoking in front']
  },
  {
    subtype: 'unlicensed_sale_complaint',
    label: 'Unlicensed sale complaint',
    icon: '🔎',
    bucket: 'unlicensed_illegal_sale',
    terms: ['illegal sale', 'unlicensed sale', 'selling weed', 'selling cannabis', 'illegal smoke shop', 'unlicensed smoke shop']
  }
];

const BORO_NAME = {
  MANHATTAN: 'Manhattan',
  NEW_YORK: 'Manhattan',
  BRONX: 'Bronx',
  BROOKLYN: 'Brooklyn',
  QUEENS: 'Queens',
  STATEN_ISLAND: 'Staten Island'
};

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

function allText(row) {
  return [
    row.complaint_type,
    row.descriptor,
    row.location_type,
    row.incident_address,
    row.street_name,
    row.cross_street_1,
    row.cross_street_2,
    row.resolution_description,
    row.agency_name,
    row.status
  ].map(clean).join(' ').toLowerCase();
}

function matchRule(row) {
  const text = allText(row);
  return MATCH_RULES.find(rule => rule.terms.some(term => text.includes(term))) || null;
}

function coordsFrom(row) {
  const lat = numberFrom(row.latitude);
  const lng = numberFrom(row.longitude);
  if (isNYCoord(lat, lng)) return { lat, lng, quality: 'source_coordinates' };
  const loc = row.location;
  if (loc && typeof loc === 'object') {
    const objectLat = numberFrom(loc.latitude || loc.lat);
    const objectLng = numberFrom(loc.longitude || loc.lng || loc.lon);
    if (isNYCoord(objectLat, objectLng)) return { lat: objectLat, lng: objectLng, quality: 'source_location_object' };
    if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const a = numberFrom(loc.coordinates[0]);
      const b = numberFrom(loc.coordinates[1]);
      if (isNYCoord(a, b)) return { lat: a, lng: b, quality: 'source_coordinates' };
      if (isNYCoord(b, a)) return { lat: b, lng: a, quality: 'source_coordinates_reversed' };
    }
  }
  return null;
}

function boroughFrom(row) {
  const raw = clean(row.borough || row.boro || '');
  const key = raw.toUpperCase().replace(/\s+/g, '_');
  return BORO_NAME[key] || raw;
}

function addressFrom(row) {
  return [row.incident_address, row.city, row.incident_zip].map(clean).filter(Boolean).join(', ');
}

function rawId(row, index) {
  return clean(row.unique_key || row.id || `smoke-intel-${index}`);
}

function normalizePin(row, index) {
  const rule = matchRule(row);
  const sourceId = rawId(row, index);
  if (!rule) return { status: 'rejected', reason: 'no_smoke_vape_cannabis_match', raw_source_id: sourceId, raw: row };

  const coords = coordsFrom(row);
  const address = addressFrom(row);
  const borough = boroughFrom(row);
  const complaintType = clean(row.complaint_type || '311 complaint');
  const descriptor = clean(row.descriptor || rule.label);
  const createdDate = clean(row.created_date || '');
  const titleParts = [rule.label, address || borough].filter(Boolean);

  const base = {
    id: `smoke-intel-${sourceId}`,
    layer: 'smoke_cannabis_vape_intel',
    category: 'public_complaint_intel',
    subtype: rule.subtype,
    subtype_label: rule.label,
    match_bucket: rule.bucket,
    icon: rule.icon,
    title: titleParts.join(' — ') || rule.label,
    address,
    borough,
    complaint_type: complaintType,
    descriptor,
    location_type: clean(row.location_type || ''),
    created_date: createdDate,
    source: 'NYC 311 Service Requests',
    source_url: SOURCE_URL,
    raw_source_id: sourceId,
    data_note: '311 complaint record; public complaint activity only, not proof of illegal activity, causation, or wrongdoing.',
    updated_at: new Date().toISOString(),
    raw: row
  };

  if (!coords) {
    return { status: 'needs_review', reason: address ? 'needs_geocode' : 'missing_coordinates_and_address', ...base };
  }

  return { status: 'mapped', location_quality: coords.quality, lat: coords.lat, lng: coords.lng, ...base };
}

function dedupeBySourceId(pins) {
  const seen = new Set();
  const output = [];
  let duplicateCount = 0;
  for (const pin of pins) {
    if (seen.has(pin.raw_source_id)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(pin.raw_source_id);
    output.push(pin);
  }
  return { pins: output, duplicate_count: duplicateCount };
}

function countReasons(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.reason || 'unknown', (counts.get(item.reason || 'unknown') || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = clean(typeof key === 'function' ? key(item) : item[key]) || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function sinceDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - LOOKBACK_DAYS);
  return date.toISOString().slice(0, 10);
}

function buildFetchUrl(since, offset) {
  const where = encodeURIComponent(`created_date >= '${since}T00:00:00'`);
  const order = encodeURIComponent('created_date DESC');
  const select = encodeURIComponent([
    'unique_key', 'created_date', 'complaint_type', 'descriptor', 'location_type', 'incident_address',
    'street_name', 'city', 'incident_zip', 'borough', 'latitude', 'longitude', 'location',
    'resolution_description', 'agency_name', 'status', 'cross_street_1', 'cross_street_2'
  ].join(','));
  return `${SOURCE_URL}?$select=${select}&$where=${where}&$order=${order}&$limit=${FETCH_LIMIT}&$offset=${offset}`;
}

async function fetchRows() {
  const since = sinceDate();
  const rows = [];
  for (let offset = 0; offset < MAX_ROWS; offset += FETCH_LIMIT) {
    const url = buildFetchUrl(since, offset);
    console.log(`Fetching 311 smoke/vape/cannabis candidate rows ${offset}-${offset + FETCH_LIMIT}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Source fetch failed: HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Source did not return an array');
    rows.push(...batch);
    if (batch.length < FETCH_LIMIT) break;
  }
  return { rows, since };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const { rows, since } = await fetchRows();
  const normalized = rows.map(normalizePin);
  const mappedRaw = normalized.filter(item => item.status === 'mapped');
  const needsReview = normalized.filter(item => item.status === 'needs_review');
  const rejected = normalized.filter(item => item.status === 'rejected');
  const deduped = dedupeBySourceId(mappedRaw);

  const report = {
    source_url: SOURCE_URL,
    source_rows: rows.length,
    fetch_limit: FETCH_LIMIT,
    max_rows: MAX_ROWS,
    lookback_days: LOOKBACK_DAYS,
    since_date: since,
    matched_rows: mappedRaw.length + needsReview.length,
    mapped_total: deduped.pins.length,
    needs_review: needsReview.length,
    rejected: rejected.length,
    duplicate_count: deduped.duplicate_count,
    subtype_counts: countBy(deduped.pins, 'subtype'),
    match_bucket_counts: countBy(deduped.pins, 'match_bucket'),
    complaint_type_counts: countBy(deduped.pins, 'complaint_type'),
    descriptor_counts: countBy(deduped.pins, 'descriptor'),
    top_review_reasons: countReasons(needsReview).slice(0, 10),
    top_rejection_reasons: countReasons(rejected).slice(0, 10),
    generated_at: new Date().toISOString(),
    data_note: '311 complaint records are public complaint intel, not proof of illegal activity, causation, or wrongdoing.'
  };

  await fs.writeFile(OUT_FILE, `${JSON.stringify(deduped.pins, null, 2)}\n`);
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
