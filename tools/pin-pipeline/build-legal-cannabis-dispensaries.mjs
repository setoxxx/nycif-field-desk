import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOURCE_URL = process.env.NYCIF_CANNABIS_DISPENSARY_SOURCE_URL || '';
const SOURCE_NOTE = 'Use an official NYS Office of Cannabis Management or data.ny.gov source. If no official machine-readable source is configured, this builder writes empty outputs with a limitation note.';
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const OUT_FILE = path.join(OUT_DIR, 'nycif_legal_cannabis_dispensaries.json');
const REVIEW_FILE = path.join(OUT_DIR, 'nycif_legal_cannabis_dispensaries_needs_review.json');
const REPORT_FILE = path.join(REPORT_DIR, 'legal_cannabis_dispensaries_report.json');

const NYC_BOROUGH_TERMS = ['new york', 'manhattan', 'brooklyn', 'kings', 'queens', 'bronx', 'richmond', 'staten island'];

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function norm(value) {
  return clean(value).toLowerCase();
}

function numberFrom(value) {
  if (value === null || value === undefined) return NaN;
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isNYCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.4774 && lat <= 40.9176 && lng >= -74.2591 && lng <= -73.7004;
}

function firstValue(row, names) {
  for (const name of names) {
    if (row && Object.prototype.hasOwnProperty.call(row, name) && clean(row[name])) return clean(row[name]);
  }
  return '';
}

function coordsFrom(row) {
  const lat = numberFrom(firstValue(row, ['latitude', 'lat', 'Latitude', 'LATITUDE', 'y']));
  const lng = numberFrom(firstValue(row, ['longitude', 'lng', 'lon', 'Longitude', 'LONGITUDE', 'x']));
  if (isNYCoord(lat, lng)) return { lat, lng, quality: 'source_coordinates' };
  const location = row.location || row.Location || row.geocoded_column;
  if (location && typeof location === 'object') {
    const objectLat = numberFrom(location.latitude || location.lat);
    const objectLng = numberFrom(location.longitude || location.lng || location.lon);
    if (isNYCoord(objectLat, objectLng)) return { lat: objectLat, lng: objectLng, quality: 'source_location_object' };
    if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
      const a = numberFrom(location.coordinates[0]);
      const b = numberFrom(location.coordinates[1]);
      if (isNYCoord(a, b)) return { lat: a, lng: b, quality: 'source_coordinates' };
      if (isNYCoord(b, a)) return { lat: b, lng: a, quality: 'source_coordinates_reversed' };
    }
  }
  return null;
}

function boroughFrom(row) {
  const raw = firstValue(row, ['borough', 'county', 'city', 'municipality', 'Borough', 'County', 'City']);
  const value = norm(raw);
  if (value === 'new york') return 'Manhattan';
  if (value === 'kings') return 'Brooklyn';
  if (value === 'richmond') return 'Staten Island';
  if (value.includes('manhattan')) return 'Manhattan';
  if (value.includes('brooklyn')) return 'Brooklyn';
  if (value.includes('queens')) return 'Queens';
  if (value.includes('bronx')) return 'Bronx';
  if (value.includes('staten island')) return 'Staten Island';
  return clean(raw);
}

function addressFrom(row) {
  const address = firstValue(row, ['address', 'street_address', 'premise_address', 'physical_address', 'Address', 'Street Address']);
  const city = firstValue(row, ['city', 'municipality', 'City']);
  const zip = firstValue(row, ['zip', 'zipcode', 'postal_code', 'ZIP', 'Zip']);
  return [address, city, zip].map(clean).filter(Boolean).join(', ');
}

function isNycRow(row) {
  const haystack = [boroughFrom(row), addressFrom(row), firstValue(row, ['county', 'County'])].join(' ').toLowerCase();
  return NYC_BOROUGH_TERMS.some(term => haystack.includes(term));
}

function normalize(row, index, sourceUrl) {
  const coords = coordsFrom(row);
  const name = firstValue(row, ['name', 'business_name', 'licensee_name', 'dba', 'trade_name', 'Name', 'DBA']) || `Legal cannabis dispensary ${index + 1}`;
  const address = addressFrom(row);
  const borough = boroughFrom(row);
  const licenseType = firstValue(row, ['license_type', 'license_category', 'type', 'License Type']);
  const licenseStatus = firstValue(row, ['license_status', 'status', 'Status']) || 'Unknown';
  const sourceId = firstValue(row, ['license_number', 'license_id', 'id', 'serial_number', 'License Number']) || `legal-dispensary-${index}`;

  const base = {
    id: `legal-dispensary-${sourceId}`.replace(/\s+/g, '-'),
    layer: 'legal_cannabis_dispensaries',
    category: 'regulated_cannabis_location',
    title: name,
    address,
    borough,
    license_type: licenseType || 'Adult-use cannabis dispensary',
    license_status: licenseStatus,
    source: 'NYS Office of Cannabis Management / official configured source',
    source_url: sourceUrl,
    raw_source_id: sourceId,
    data_note: 'Official regulated cannabis location record where source data is available; confirm current status before publication.',
    raw: row
  };

  if (!isNycRow(row) && !coords) return { status: 'rejected', reason: 'not_nyc_or_missing_location', ...base };
  if (!coords) return { status: 'needs_review', reason: address ? 'needs_geocode' : 'missing_coordinates_and_address', ...base };
  return { status: 'mapped', location_quality: coords.quality, lat: coords.lat, lng: coords.lng, ...base };
}

async function fetchOfficialSource(sourceUrl) {
  if (!sourceUrl) return { rows: [], limitation: 'No official machine-readable OCM/data.ny.gov dispensary source URL configured in NYCIF_CANNABIS_DISPENSARY_SOURCE_URL.' };
  const response = await fetch(sourceUrl, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Dispensary source fetch failed: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Dispensary source did not return a JSON array');
  return { rows, limitation: '' };
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

  const { rows, limitation } = await fetchOfficialSource(DEFAULT_SOURCE_URL);
  const normalized = rows.map((row, index) => normalize(row, index, DEFAULT_SOURCE_URL));
  const mapped = normalized.filter(item => item.status === 'mapped');
  const needsReview = normalized.filter(item => item.status === 'needs_review');
  const rejected = normalized.filter(item => item.status === 'rejected');

  const report = {
    source_url: DEFAULT_SOURCE_URL || null,
    source_note: SOURCE_NOTE,
    source_rows: rows.length,
    mapped_total: mapped.length,
    needs_review: needsReview.length,
    rejected: rejected.length,
    borough_counts: countBy(mapped, 'borough'),
    license_status_counts: countBy(mapped, 'license_status'),
    limitation: limitation || null,
    generated_at: new Date().toISOString(),
    data_note: 'Legal cannabis dispensary records are regulated-location records only; confirm current status before publication.'
  };

  await fs.writeFile(OUT_FILE, `${JSON.stringify(mapped, null, 2)}\n`);
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
