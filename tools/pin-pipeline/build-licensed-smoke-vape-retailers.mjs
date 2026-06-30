import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://data.cityofnewyork.us/resource/w7w3-xahh.json';
const FETCH_LIMIT = Number(process.env.NYCIF_LICENSED_SMOKE_FETCH_LIMIT || 50000);
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const OUT_FILE = path.join(OUT_DIR, 'nycif_licensed_smoke_vape_retailers.json');
const REVIEW_FILE = path.join(OUT_DIR, 'nycif_licensed_smoke_vape_retailers_needs_review.json');
const REPORT_FILE = path.join(REPORT_DIR, 'licensed_smoke_vape_retailers_report.json');

const LICENSE_TERMS = [
  'tobacco',
  'cigarette',
  'electronic cigarette',
  'e-cigarette',
  'e cigarette',
  'vape',
  'vaping',
  'smoke shop'
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

function get(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && clean(row[name])) return row[name];
  }
  return '';
}

function sourceFields(rows) {
  const fields = new Set();
  rows.slice(0, 25).forEach(row => Object.keys(row || {}).forEach(key => fields.add(key)));
  return [...fields].sort();
}

function countValues(rows, field, limit = 20) {
  const counts = new Map();
  for (const row of rows) {
    const value = clean(row[field] || '(blank)');
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count }));
}

function licenseText(row) {
  return clean(get(row, ['business_category', 'license_type', 'license_category', 'license_description', 'industry', 'license_type_description', 'detail']));
}

function rowMatches(row) {
  const text = [
    row.business_category,
    licenseText(row),
    row.license_type,
    row.business_name,
    row.business_name_2,
    row.dba,
    row.dba_trade_name,
    row.trade_name,
    row.detail,
    row.comments
  ].map(norm).join(' ');
  return LICENSE_TERMS.some(term => text.includes(term));
}

function subtypeFor(row) {
  const text = [row.business_category, licenseText(row), row.license_type, row.detail].map(norm).join(' ');
  if (/electronic cigarette|e-cigarette|e cigarette|vape|vaping/.test(text)) {
    return { subtype: 'licensed_electronic_cigarette_retailer', label: 'Licensed electronic cigarette / vape retailer', icon: '🏪' };
  }
  if (/tobacco|cigarette|cigar/.test(text)) {
    return { subtype: 'licensed_tobacco_retailer', label: 'Licensed tobacco retailer', icon: '🏪' };
  }
  return { subtype: 'licensed_smoke_vape_retailer', label: 'Licensed smoke / vape retailer', icon: '🏪' };
}

function coordsFrom(row) {
  const lat = numberFrom(get(row, ['latitude', 'lat', 'y_coordinate']));
  const lng = numberFrom(get(row, ['longitude', 'lng', 'lon', 'x_coordinate']));
  if (isNYCoord(lat, lng)) return { lat, lng, quality: 'source_coordinates' };
  const loc = row.location || row.the_geom || row.point;
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
  const raw = clean(get(row, ['borough', 'boro', 'address_borough', 'city']));
  const key = raw.toUpperCase().replace(/\s+/g, '_');
  return BORO_NAME[key] || raw;
}

function addressFrom(row) {
  const building = get(row, ['address_building', 'building_number', 'house_number', 'address_number']);
  const street = get(row, ['address_street_name', 'street_name', 'street', 'address_street']);
  const city = get(row, ['city', 'address_city']);
  const zip = get(row, ['zip_code', 'zipcode', 'zip', 'address_zip']);
  const direct = get(row, ['address', 'business_address', 'premise_address']);
  if (clean(direct)) return [direct, city, zip].map(clean).filter(Boolean).join(', ');
  return [[building, street].map(clean).filter(Boolean).join(' '), city, zip].map(clean).filter(Boolean).join(', ');
}

function businessName(row) {
  return clean(get(row, ['dba_trade_name', 'business_name', 'business_name_2', 'dba', 'trade_name', 'licensee_name', 'entity_name'])) || 'Licensed retailer';
}

function rawId(row, index) {
  return clean(get(row, ['license_number', 'license_nbr', 'license_no', 'license_id', 'dca_license_number', 'record_id', 'business_unique_id', 'id'])) || `licensed-smoke-vape-${index}`;
}

function normalizePin(row, index) {
  const sourceId = rawId(row, index);
  if (!rowMatches(row)) return { status: 'rejected', reason: 'no_licensed_smoke_vape_match', raw_source_id: sourceId, raw: row };

  const subtype = subtypeFor(row);
  const coords = coordsFrom(row);
  const address = addressFrom(row);
  const borough = boroughFrom(row);
  const license = licenseText(row);
  const name = businessName(row);
  const expiration = clean(get(row, ['lic_expir_dd', 'license_expiration_date', 'expiration_date', 'license_expire_date', 'end_date']));
  const licenseStatus = clean(get(row, ['license_status', 'status']));

  const base = {
    id: `licensed-smoke-vape-${sourceId}`,
    layer: 'licensed_smoke_vape_retailers',
    category: 'regulated_business_intel',
    subtype: subtype.subtype,
    subtype_label: subtype.label,
    icon: subtype.icon,
    title: name,
    address,
    borough,
    license,
    license_status: licenseStatus,
    license_expiration_date: expiration,
    source: 'NYC Open Data / DCWP business license records',
    source_url: SOURCE_URL,
    raw_source_id: sourceId,
    data_note: 'Official license/business record; confirm current license status with the source before publication or enforcement use.',
    updated_at: new Date().toISOString(),
    raw: row
  };

  if (!coords) {
    return { status: 'needs_review', reason: address ? 'needs_geocode' : 'missing_coordinates_and_address', ...base };
  }

  return { status: 'mapped', location_quality: coords.quality, lat: coords.lat, lng: coords.lng, ...base };
}

function dedupePins(pins) {
  const seen = new Set();
  const output = [];
  let duplicateCount = 0;
  for (const pin of pins) {
    const key = [pin.subtype, norm(pin.title), norm(pin.address), Number(pin.lat).toFixed(5), Number(pin.lng).toFixed(5)].join('|');
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    output.push(pin);
  }
  return { pins: output, duplicate_count: duplicateCount };
}

function countReasons(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.reason || 'unknown', (counts.get(item.reason || 'unknown') || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
}

function buildSourceUrl() {
  const where = [
    "lower(business_category) like '%tobacco%'",
    "lower(business_category) like '%cigarette%'",
    "lower(business_category) like '%vape%'",
    "lower(business_category) like '%smoke%'",
    "lower(detail) like '%tobacco%'",
    "lower(detail) like '%cigarette%'",
    "lower(detail) like '%vape%'",
    "lower(dba_trade_name) like '%tobacco%'",
    "lower(dba_trade_name) like '%cigarette%'",
    "lower(dba_trade_name) like '%vape%'",
    "lower(dba_trade_name) like '%smoke%'",
    "lower(business_name) like '%tobacco%'",
    "lower(business_name) like '%cigarette%'",
    "lower(business_name) like '%vape%'",
    "lower(business_name) like '%smoke%'",
    "lower(license_type) like '%tobacco%'",
    "lower(license_type) like '%cigarette%'",
    "lower(license_type) like '%vape%'"
  ].join(' OR ');
  const params = new URLSearchParams();
  params.set('$select', '*');
  params.set('$where', where);
  params.set('$limit', String(FETCH_LIMIT));
  return `${SOURCE_URL}?${params.toString()}`;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const url = buildSourceUrl();
  console.log(`Fetching ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Source fetch failed: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Source did not return an array');

  const normalized = rows.map(normalizePin);
  const mappedRaw = normalized.filter(item => item.status === 'mapped');
  const needsReview = normalized.filter(item => item.status === 'needs_review');
  const rejected = normalized.filter(item => item.status === 'rejected');
  const deduped = dedupePins(mappedRaw);

  const subtypeCounts = deduped.pins.reduce((acc, pin) => {
    acc[pin.subtype] = (acc[pin.subtype] || 0) + 1;
    return acc;
  }, {});

  const report = {
    source_url: SOURCE_URL,
    queried_url: url,
    source_rows: rows.length,
    fetch_limit: FETCH_LIMIT,
    matched_rows: mappedRaw.length + needsReview.length,
    mapped_total: deduped.pins.length,
    needs_review: needsReview.length,
    rejected: rejected.length,
    duplicate_count: deduped.duplicate_count,
    subtype_counts: subtypeCounts,
    business_category_sample: countValues(rows, 'business_category'),
    license_type_sample: countValues(rows, 'license_type'),
    license_status_sample: countValues(rows, 'license_status'),
    source_fields_sample: sourceFields(rows),
    top_review_reasons: countReasons(needsReview).slice(0, 10),
    top_rejection_reasons: countReasons(rejected).slice(0, 10),
    generated_at: new Date().toISOString(),
    data_note: 'Official license/business records; confirm current license status with the source before publication or enforcement use.'
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
