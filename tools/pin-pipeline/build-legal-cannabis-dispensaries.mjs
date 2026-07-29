import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANONICAL_SOURCE_URL = 'https://data.ny.gov/resource/gttd-5u6y.json';
const SOURCE_LABEL = 'NYS Registered Retail Dealers of Adult-use Cannabis Products';
const DATA_NOTE = 'Official NYS registered adult-use cannabis retail dealer record; confirm current OCM/license/open status before publication.';
const DEFAULT_SOURCE_URL = process.env.NYCIF_CANNABIS_DISPENSARY_SOURCE_URL || CANONICAL_SOURCE_URL;
const SOURCE_NOTE = 'Official NYS registered adult-use cannabis retail dealer records from data.ny.gov dataset gttd-5u6y.';
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const OUT_FILE = path.join(OUT_DIR, 'nycif_legal_cannabis_dispensaries.json');
const REVIEW_FILE = path.join(OUT_DIR, 'nycif_legal_cannabis_dispensaries_needs_review.json');
const REPORT_FILE = path.join(REPORT_DIR, 'legal_cannabis_dispensaries_report.json');

const NYC_COUNTIES = new Set(['NEW YORK', 'KINGS', 'QUEENS', 'BRONX', 'RICHMOND']);
const LICENSE_TYPE = 'Registered adult-use cannabis retail dealer';
const LICENSE_STATUS = 'Registered';

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function norm(value) {
  return clean(value).toLowerCase();
}

function keyText(value) {
  return norm(value).replace(/[^a-z0-9]+/g, ' ').trim();
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

function countyRaw(row) {
  return clean(firstValue(row, ['physical_county', 'county', 'County'])).toUpperCase();
}

function isNycCounty(row) {
  return NYC_COUNTIES.has(countyRaw(row));
}

function boroughFrom(row) {
  const county = countyRaw(row);
  if (county === 'NEW YORK') return 'Manhattan';
  if (county === 'KINGS') return 'Brooklyn';
  if (county === 'QUEENS') return 'Queens';
  if (county === 'BRONX') return 'Bronx';
  if (county === 'RICHMOND') return 'Staten Island';
  return clean(firstValue(row, ['borough', 'city', 'physical_city', 'municipality']));
}

function addressFrom(row) {
  const address = firstValue(row, ['physical_address', 'address', 'street_address', 'premise_address', 'address_line_1']);
  const city = firstValue(row, ['physical_city', 'city', 'municipality']);
  const zip = firstValue(row, ['physical_zip', 'zip', 'zipcode', 'zip_code', 'postal_code']);
  return [address, city, zip].map(clean).filter(Boolean).join(', ');
}

function titleFrom(row) {
  return firstValue(row, ['dba_name', 'legal_name', 'dba', 'entity_name', 'name', 'business_name']) || 'Registered cannabis retail dealer';
}

function rawId(row, index) {
  return firstValue(row, ['ocm_license_number', 'external_tpid', 'license_number', 'license_id', 'id']) || `legal-dispensary-${index}`;
}

function coordsFrom(row) {
  const georef = row.georeference;
  if (georef && typeof georef === 'object' && Array.isArray(georef.coordinates) && georef.coordinates.length >= 2) {
    const lng = numberFrom(georef.coordinates[0]);
    const lat = numberFrom(georef.coordinates[1]);
    if (isNYCoord(lat, lng)) return { lat, lng, quality: 'source_georeference' };
  }

  const lat = numberFrom(firstValue(row, ['latitude', 'lat', 'y']));
  const lng = numberFrom(firstValue(row, ['longitude', 'lng', 'lon', 'x']));
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

function normalize(row, index) {
  const sourceId = rawId(row, index);
  const title = titleFrom(row);
  const address = addressFrom(row);
  const borough = boroughFrom(row);

  const base = {
    id: `legal-dispensary-${sourceId}`.replace(/\s+/g, '-'),
    layer: 'legal_cannabis_dispensaries',
    category: 'regulated_cannabis_location',
    title,
    address,
    borough,
    license_type: LICENSE_TYPE,
    license_status: LICENSE_STATUS,
    source: SOURCE_LABEL,
    source_url: CANONICAL_SOURCE_URL,
    raw_source_id: sourceId,
    data_note: DATA_NOTE,
    raw: row
  };

  if (!isNycCounty(row)) {
    return { status: 'rejected', reason: 'outside_nyc_county', ...base };
  }

  const coords = coordsFrom(row);
  if (!coords) {
    return { status: 'needs_review', reason: address ? 'needs_geocode' : 'missing_coordinates_and_address', ...base };
  }

  return { status: 'mapped', location_quality: coords.quality, lat: coords.lat, lng: coords.lng, ...base };
}

function semanticLocationKey(item) {
  return [
    keyText(item.title),
    keyText(item.address),
    Number(item.lat).toFixed(5),
    Number(item.lng).toFixed(5)
  ].join('|');
}

function qualityScore(item) {
  const rank = {
    source_georeference: 40,
    source_coordinates: 30,
    source_location_object: 20,
    source_coordinates_reversed: 10
  };
  return (rank[item.location_quality] || 0) + (clean(item.address) ? 4 : 0) + (clean(item.title) ? 2 : 0) + (clean(item.borough) ? 1 : 0);
}

function mergeTrace(keeper, removed) {
  const ids = new Set([
    keeper.raw_source_id,
    ...(keeper.duplicate_source_ids || []),
    removed.raw_source_id,
    ...(removed.duplicate_source_ids || [])
  ].map(clean).filter(Boolean));
  keeper.duplicate_source_ids = [...ids]
    .filter(id => id !== keeper.raw_source_id)
    .sort((a, b) => a.localeCompare(b));
  keeper.source_record_count = Number(keeper.source_record_count || 1) + Number(removed.source_record_count || 1);
  return keeper;
}

function chooseKeeper(a, b) {
  if (qualityScore(b) > qualityScore(a)) return mergeTrace({ ...b }, a);
  return mergeTrace({ ...a }, b);
}

function dedupeMappedLocations(items) {
  const byId = new Map();
  let duplicateIdRowsCollapsed = 0;
  for (const item of items) {
    const enriched = { ...item, source_record_count: 1, duplicate_source_ids: [] };
    const existing = byId.get(item.id);
    if (!existing) byId.set(item.id, enriched);
    else {
      duplicateIdRowsCollapsed += 1;
      byId.set(item.id, chooseKeeper(existing, enriched));
    }
  }

  const bySemantic = new Map();
  let duplicateSemanticLocationsCollapsed = 0;
  for (const item of byId.values()) {
    const key = semanticLocationKey(item);
    const existing = bySemantic.get(key);
    if (!existing) bySemantic.set(key, item);
    else {
      duplicateSemanticLocationsCollapsed += 1;
      bySemantic.set(key, chooseKeeper(existing, item));
    }
  }

  return {
    mapped: [...bySemantic.values()],
    duplicate_id_rows_collapsed: duplicateIdRowsCollapsed,
    duplicate_semantic_locations_collapsed: duplicateSemanticLocationsCollapsed
  };
}

async function fetchOfficialSource(sourceUrl) {
  if (!sourceUrl) {
    return {
      rows: [],
      limitation: 'No official machine-readable OCM/data.ny.gov dispensary source URL configured in NYCIF_CANNABIS_DISPENSARY_SOURCE_URL.'
    };
  }

  console.log(`Fetching ${sourceUrl}`);
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

function countReasons(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.reason || 'unknown', (counts.get(item.reason || 'unknown') || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const { rows, limitation } = await fetchOfficialSource(DEFAULT_SOURCE_URL);
  const normalized = rows.map((row, index) => normalize(row, index));
  const mappedBeforeDedupe = normalized.filter(item => item.status === 'mapped');
  const dedupe = dedupeMappedLocations(mappedBeforeDedupe);
  const mapped = dedupe.mapped;
  const needsReview = normalized.filter(item => item.status === 'needs_review');
  const rejected = normalized.filter(item => item.status === 'rejected');
  const ids = mapped.map(item => item.id);
  const semanticKeys = mapped.map(semanticLocationKey);
  const duplicateOutputIds = ids.length - new Set(ids).size;
  const duplicateOutputSemanticLocations = semanticKeys.length - new Set(semanticKeys).size;
  const qaPass = mapped.length > 0 && duplicateOutputIds === 0 && duplicateOutputSemanticLocations === 0;

  const report = {
    qa_pass: qaPass,
    source_url: CANONICAL_SOURCE_URL,
    queried_url: DEFAULT_SOURCE_URL,
    source_note: SOURCE_NOTE,
    source_rows: rows.length,
    nyc_county_filter: [...NYC_COUNTIES].sort(),
    mapped_before_dedupe: mappedBeforeDedupe.length,
    mapped_total: mapped.length,
    duplicate_id_rows_collapsed: dedupe.duplicate_id_rows_collapsed,
    duplicate_semantic_locations_collapsed: dedupe.duplicate_semantic_locations_collapsed,
    duplicate_output_ids: duplicateOutputIds,
    duplicate_output_semantic_locations: duplicateOutputSemanticLocations,
    needs_review: needsReview.length,
    rejected: rejected.length,
    borough_counts: countBy(mapped, 'borough'),
    license_status_counts: countBy(mapped, 'license_status'),
    top_rejection_reasons: countReasons(rejected).slice(0, 10),
    top_review_reasons: countReasons(needsReview).slice(0, 10),
    limitation: limitation || null,
    generated_at: new Date().toISOString(),
    data_note: DATA_NOTE
  };

  await fs.writeFile(OUT_FILE, `${JSON.stringify(mapped, null, 2)}\n`);
  await fs.writeFile(REVIEW_FILE, `${JSON.stringify(needsReview, null, 2)}\n`);
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`Wrote ${REVIEW_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);
  if (!qaPass) process.exitCode = 1;
}

export { semanticLocationKey, dedupeMappedLocations };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
