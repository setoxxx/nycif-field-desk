import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://data.cityofnewyork.us/resource/hdtn-j62g.json';
const FETCH_LIMIT = Number(process.env.NYCIF_FETCH_LIMIT || 50000);
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const OUT_FILE = path.join(OUT_DIR, 'nycif_nightlife_spots.json');
const REVIEW_FILE = path.join(OUT_DIR, 'nycif_nightlife_spots_needs_review.json');
const REPORT_FILE = path.join(REPORT_DIR, 'nightlife_pin_report.json');

const GROUP_ONE = [
  { key: 'bar_tavern', label: 'Bars / taverns', terms: ['bar', 'tavern', 'pub', 'sports bar'] },
  { key: 'lounge_club', label: 'Lounges / clubs', terms: ['lounge', 'nightclub', 'night club', 'club', 'cabaret', 'dance club', 'dance hall'] },
  { key: 'music_stage', label: 'Music / comedy / karaoke', terms: ['karaoke', 'comedy club', 'live music', 'music venue'] },
  { key: 'beer_wine', label: 'Beer / wine gathering spots', terms: ['beer garden', 'wine bar', 'brewery', 'taproom', 'microbrewery', 'micro brewer'] },
  { key: 'liquor_onprem', label: 'On-premises liquor', terms: ['on-premises liquor', 'on premises liquor', 'on premise liquor', 'tavern wine', 'club liquor', 'cabaret liquor', 'restaurant brewer'] },
  { key: 'hookah_billiards', label: 'Hookah / billiards', terms: ['hookah', 'billiards', 'pool hall'] }
];

const GROUP_TWO = [
  { key: 'restaurant_nightlife', label: 'Restaurants with nightlife potential', terms: ['restaurant', 'restaurant wine', 'eating place beer', 'cafe', 'café', 'rooftop restaurant'] },
  { key: 'hotel_event', label: 'Hotel / event spaces', terms: ['hotel liquor', 'hotel', 'event space', 'banquet hall', 'catering establishment', 'caterer'] },
  { key: 'social_private', label: 'Social / private clubs', terms: ['private club', 'social club', 'fraternal', 'members club'] },
  { key: 'entertainment', label: 'Entertainment venues', terms: ['theater', 'theatre', 'bowling alley', 'arcade'] }
];

const EXCLUDE_TERMS = [
  'liquor store', 'wine store', 'package store', 'grocery store', 'drug store', 'supermarket',
  'wholesale', 'wholesaler', 'distributor', 'importer', 'manufacturer', 'warehouse',
  'temporary permit', 'special event permit', 'one-day permit', 'one day permit', 'farm winery',
  'off-premises', 'off premises', 'off premise'
];

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function norm(value) {
  return clean(value).toLowerCase();
}

function allText(row) {
  return Object.entries(row || {})
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => `${key} ${value}`)
    .join(' ')
    .toLowerCase();
}

function field(row, names) {
  const keys = Object.keys(row || {});
  for (const wanted of names) {
    const wantedNorm = norm(wanted);
    if (row[wanted] !== undefined && clean(row[wanted])) return clean(row[wanted]);
    const hit = keys.find(key => {
      const keyNorm = norm(key);
      return keyNorm === wantedNorm || keyNorm.includes(wantedNorm) || wantedNorm.includes(keyNorm);
    });
    if (hit && clean(row[hit])) return clean(row[hit]);
  }
  return '';
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

function pairFromNumbers(a, b) {
  const x = numberFrom(a);
  const y = numberFrom(b);
  if (isNYCoord(x, y)) return { lat: x, lng: y, quality: 'source_coordinates' };
  if (isNYCoord(y, x)) return { lat: y, lng: x, quality: 'source_coordinates_reversed' };
  return null;
}

function coordsFromText(value) {
  const text = clean(value);
  if (!text) return null;

  const wkt = text.match(/POINT\s*\(\s*([\-0-9.]+)\s+([\-0-9.]+)\s*\)/i);
  if (wkt) return pairFromNumbers(wkt[1], wkt[2]);

  const latLng = text.match(/(?:lat(?:itude)?[^\-0-9.]{0,12})([\-0-9.]+).*?(?:lon(?:gitude)?|lng|long)[^\-0-9.]{0,12}([\-0-9.]+)/i);
  if (latLng) return pairFromNumbers(latLng[1], latLng[2]);

  const lngLat = text.match(/(?:lon(?:gitude)?|lng|long)[^\-0-9.]{0,12}([\-0-9.]+).*?(?:lat(?:itude)?)[^\-0-9.]{0,12}([\-0-9.]+)/i);
  if (lngLat) return pairFromNumbers(lngLat[1], lngLat[2]);

  const genericPair = text.match(/([\-]?(?:40|73|74)\.\d+)[,\s]+([\-]?(?:40|73|74)\.\d+)/);
  if (genericPair) return pairFromNumbers(genericPair[1], genericPair[2]);

  return null;
}

function coordsFromObject(value) {
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
    const parsed = pairFromNumbers(value.coordinates[0], value.coordinates[1]);
    if (parsed) return parsed;
  }

  const direct = pairFromNumbers(
    value.latitude ?? value.lat ?? value.y,
    value.longitude ?? value.lng ?? value.lon ?? value.long ?? value.x
  );
  if (direct) return direct;

  for (const child of Object.values(value)) {
    const parsed = typeof child === 'object' ? coordsFromObject(child) : coordsFromText(child);
    if (parsed) return parsed;
  }

  return null;
}

function coordsFrom(row) {
  const direct = pairFromNumbers(
    field(row, ['latitude', 'lat', 'y', 'geo_latitude']),
    field(row, ['longitude', 'lng', 'lon', 'long', 'x', 'geo_longitude'])
  );
  if (direct) return direct;

  for (const [key, value] of Object.entries(row || {})) {
    if (/location|geo|geom|point|coordinate|lat|lon|lng|x|y/i.test(key)) {
      const parsed = typeof value === 'object' ? coordsFromObject(value) : coordsFromText(value);
      if (parsed) return parsed;
    }
  }

  for (const value of Object.values(row || {})) {
    if (typeof value === 'object') {
      const parsed = coordsFromObject(value);
      if (parsed) return parsed;
    }
  }

  return null;
}

function ruleHit(text, rule) {
  return rule.terms.some(term => text.includes(term));
}

function matchCategory(row) {
  const text = allText(row);
  if (!text) return { accepted: false, reason: 'empty_text' };
  if (EXCLUDE_TERMS.some(term => text.includes(term))) return { accepted: false, reason: 'excluded_business_type' };

  const groupOne = GROUP_ONE.find(rule => ruleHit(text, rule));
  if (groupOne) return { accepted: true, group: 1, ...groupOne };

  const groupTwo = GROUP_TWO.find(rule => ruleHit(text, rule));
  if (groupTwo) return { accepted: true, group: 2, ...groupTwo };

  return { accepted: false, reason: 'no_nightlife_match' };
}

function titleFrom(row) {
  return field(row, ['dba', 'trade_name', 'business_name', 'premises_name', 'premise_name', 'entity_name', 'licensee_name', 'name', 'corporation_name']) || 'Nightlife spot';
}

function addressFrom(row) {
  const address = field(row, ['address', 'premises_address', 'premise_address', 'street_address', 'location_address', 'incident_address']);
  const city = field(row, ['city', 'premises_city', 'premise_city']);
  const zip = field(row, ['zip', 'zipcode', 'zip_code', 'premises_zip', 'incident_zip']);
  return [address, city, zip].filter(Boolean).join(', ');
}

function boroughFrom(row) {
  const raw = field(row, ['borough', 'boro', 'county']);
  const text = norm(raw);
  if (/new york|manhattan/.test(text)) return 'Manhattan';
  if (/kings|brooklyn/.test(text)) return 'Brooklyn';
  if (/queens/.test(text)) return 'Queens';
  if (/bronx/.test(text)) return 'Bronx';
  if (/richmond|staten/.test(text)) return 'Staten Island';
  return clean(raw);
}

function licenseText(row) {
  return field(row, ['license_type_name', 'license_type', 'license_class', 'license_class_code', 'license_category', 'license', 'type', 'category', 'industry', 'descriptor', 'complaint_type']);
}

function rawId(row, index) {
  return field(row, ['serial_number', 'license_number', 'record_id', 'id', 'objectid', 'license_id', 'unique_key']) || `row-${index}`;
}

function normalizePin(row, index) {
  const match = matchCategory(row);
  const sourceId = rawId(row, index);
  if (!match.accepted) return { status: 'rejected', reason: match.reason, raw_source_id: sourceId, raw: row };

  const coords = coordsFrom(row);
  const title = titleFrom(row);
  const address = addressFrom(row);
  const borough = boroughFrom(row);
  const license = licenseText(row);

  const base = {
    id: `nightlife-${sourceId}`,
    layer: 'nightlife',
    category: 'nightlife',
    group: match.group,
    subtype: match.key,
    subtype_label: match.label,
    title,
    address,
    borough,
    license,
    source: 'NYC Open Data',
    source_url: SOURCE_URL,
    raw_source_id: sourceId,
    updated_at: new Date().toISOString(),
    raw
  };

  if (!coords) {
    return { status: 'needs_review', reason: address ? 'needs_geocode' : 'missing_coordinates_and_address', ...base };
  }

  return {
    status: 'mapped',
    location_quality: coords.quality,
    lat: coords.lat,
    lng: coords.lng,
    ...base
  };
}

function dedupePins(pins) {
  const seen = new Set();
  const duplicateKeys = [];
  const output = [];
  for (const pin of pins) {
    const key = [norm(pin.title), norm(pin.address), Number(pin.lat).toFixed(5), Number(pin.lng).toFixed(5)].join('|');
    if (seen.has(key)) {
      duplicateKeys.push(key);
      continue;
    }
    seen.add(key);
    output.push(pin);
  }
  return { pins: output, duplicate_count: duplicateKeys.length };
}

function countReasons(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.reason || 'unknown', (counts.get(item.reason || 'unknown') || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
}

function sourceFields(rows) {
  const keys = new Set();
  rows.slice(0, 100).forEach(row => Object.keys(row || {}).forEach(key => keys.add(key)));
  return [...keys].sort();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const url = `${SOURCE_URL}?$limit=${FETCH_LIMIT}`;
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

  const report = {
    source_url: SOURCE_URL,
    source_rows: rows.length,
    category_matches: mappedRaw.length + needsReview.length,
    source_coordinate_matches: mappedRaw.length,
    geocoded_matches: 0,
    mapped_total: deduped.pins.length,
    needs_review: needsReview.length,
    rejected: rejected.length,
    duplicate_count: deduped.duplicate_count,
    group_one: deduped.pins.filter(pin => pin.group === 1).length,
    group_two: deduped.pins.filter(pin => pin.group === 2).length,
    top_review_reasons: countReasons(needsReview).slice(0, 10),
    top_rejection_reasons: countReasons(rejected).slice(0, 10),
    source_fields_sample: sourceFields(rows),
    generated_at: new Date().toISOString()
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
