import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://data.ny.gov/resource/knqy-j52b.json';
const SOURCE_LABEL = 'NY SLA liquor licenses';
const FETCH_LIMIT = Number(process.env.NYCIF_FETCH_LIMIT || 50000);
const GEOCODE_CONCURRENCY = Number(process.env.NYCIF_GEOCODE_CONCURRENCY || 12);
const GEOCODE_DELAY_MS = Number(process.env.NYCIF_GEOCODE_DELAY_MS || 25);
const GEOSEARCH_URL = 'https://geosearch.planninglabs.nyc/v2/search';
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const CACHE_FILE = path.join(OUT_DIR, 'location_cache.json');
const OUT_FILE = path.join(OUT_DIR, 'nycif_nightlife_spots.json');
const REVIEW_FILE = path.join(OUT_DIR, 'nycif_nightlife_spots_needs_review.json');
const REPORT_FILE = path.join(REPORT_DIR, 'nightlife_pin_report.json');

const NYC_COUNTIES = ['NEW YORK', 'KINGS', 'QUEENS', 'BRONX', 'RICHMOND'];

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
  return field(row, ['dba', 'premise_name', 'premises_name', 'trade_name', 'business_name', 'entity_name', 'licensee_name', 'name', 'corporation_name']) || 'Nightlife spot';
}

function addressFrom(row) {
  const line1 = field(row, ['premise_address', 'premises_address', 'address', 'street_address', 'location_address', 'incident_address']);
  const line2 = field(row, ['premise_address_2', 'premises_address_2']);
  const city = field(row, ['premise_city', 'premises_city', 'city']);
  const zip = field(row, ['zip', 'zipcode', 'zip_code', 'premises_zip', 'incident_zip']);
  return [line1, line2, city, zip].filter(Boolean).join(', ');
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
  const code = field(row, ['license_type_code', 'license_type_name', 'license_type', 'license_class', 'license_class_code']);
  const method = field(row, ['method_of_operation', 'license_category', 'descriptor']);
  const fallback = field(row, ['license', 'type', 'category', 'industry', 'complaint_type']);
  return [code, method].filter(Boolean).join(' · ') || fallback;
}

function rawId(row, index) {
  return field(row, ['serial_number', 'license_number', 'record_id', 'id', 'objectid', 'license_id', 'unique_key']) || `row-${index}`;
}

function cacheKey(address, borough, zip = '') {
  return [norm(address), norm(borough), norm(zip)].join('|');
}

function geocodeQuery(address, borough) {
  return [address, borough, 'NY'].filter(Boolean).join(', ');
}

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await fs.writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
}

async function geocodeAddress(query) {
  const url = `${GEOSEARCH_URL}?${new URLSearchParams({ text: query, size: '1' })}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const feature = data?.features?.[0];
  if (!feature?.geometry?.coordinates) return null;
  const [lng, lat] = feature.geometry.coordinates;
  if (!isNYCoord(lat, lng)) return { outside_nyc: true, lat, lng, label: feature.properties?.label || query };
  return { lat, lng, label: feature.properties?.label || query };
}

async function resolveGeocodes(items, cache) {
  const pending = new Map();
  for (const item of items) {
    if (item.reason !== 'needs_geocode') continue;
    const key = cacheKey(item.address, item.borough);
    const cached = cache[key];
    if (cached?.lat !== undefined && cached?.lng !== undefined) continue;
    if (cached?.quality === 'geocode_outside_nyc' || cached?.quality === 'geocode_failed') continue;
    if (!pending.has(key)) pending.set(key, geocodeQuery(item.address, item.borough));
  }

  const keys = [...pending.keys()];
  let cacheDirty = false;
  let geocodedMatches = 0;
  let geocodeFailures = 0;

  for (let index = 0; index < keys.length; index += GEOCODE_CONCURRENCY) {
    const batch = keys.slice(index, index + GEOCODE_CONCURRENCY);
    const results = await Promise.all(batch.map(async key => {
      const query = pending.get(key);
      try {
        const result = await geocodeAddress(query);
        return { key, query, result };
      } catch {
        return { key, query, result: null };
      }
    }));

    for (const { key, query, result } of results) {
      if (result && Number.isFinite(result.lat) && Number.isFinite(result.lng) && !result.outside_nyc) {
        cache[key] = {
          query,
          lat: result.lat,
          lng: result.lng,
          quality: 'geocoded',
          provider: 'nyc_geosearch',
          updated_at: new Date().toISOString()
        };
        cacheDirty = true;
        geocodedMatches += 1;
        continue;
      }

      cache[key] = {
        query,
        quality: result?.outside_nyc ? 'geocode_outside_nyc' : 'geocode_failed',
        provider: 'nyc_geosearch',
        updated_at: new Date().toISOString()
      };
      cacheDirty = true;
      geocodeFailures += 1;
    }

    if (GEOCODE_DELAY_MS > 0 && index + GEOCODE_CONCURRENCY < keys.length) {
      await new Promise(resolve => setTimeout(resolve, GEOCODE_DELAY_MS));
    }

    if ((index / GEOCODE_CONCURRENCY) % 25 === 0 && index > 0) {
      console.log(`Geocoded ${Math.min(index + GEOCODE_CONCURRENCY, keys.length)}/${keys.length} unique addresses...`);
    }
  }

  return { cache, cacheDirty, geocodedMatches, geocodeFailures, geocode_lookups: keys.length };
}

function applyGeocodes(sourceMapped, needsReview, cache) {
  const mapped = [...sourceMapped];
  const stillReview = [];
  let geocodedMatches = 0;

  for (const item of needsReview) {
    if (item.reason !== 'needs_geocode') {
      stillReview.push(item);
      continue;
    }

    const key = cacheKey(item.address, item.borough);
    const cached = cache[key];
    if (cached?.lat !== undefined && cached?.lng !== undefined && isNYCoord(cached.lat, cached.lng)) {
      const { status, reason, ...pin } = item;
      mapped.push({
        ...pin,
        status: 'mapped',
        lat: cached.lat,
        lng: cached.lng,
        location_quality: cached.quality || 'geocoded'
      });
      geocodedMatches += 1;
      continue;
    }

    if (cached?.quality === 'geocode_outside_nyc') {
      stillReview.push({ ...item, reason: 'geocode_outside_nyc' });
      continue;
    }

    if (cached?.quality === 'geocode_failed') {
      stillReview.push({ ...item, reason: 'geocode_failed' });
      continue;
    }

    stillReview.push(item);
  }

  return { mapped, stillReview, geocodedMatches };
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
    source: SOURCE_LABEL,
    source_url: SOURCE_URL,
    raw_source_id: sourceId,
    updated_at: new Date().toISOString(),
    raw: row
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

function buildSourceUrl() {
  const params = new URLSearchParams();
  params.set('$limit', String(FETCH_LIMIT));
  params.set('$where', `county in (${NYC_COUNTIES.map(county => `'${county}'`).join(',')})`);
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
  const sourceMapped = normalized.filter(item => item.status === 'mapped');
  const needsGeocode = normalized.filter(item => item.status === 'needs_review' && item.reason === 'needs_geocode');
  const otherReview = normalized.filter(item => item.status === 'needs_review' && item.reason !== 'needs_geocode');
  const rejected = normalized.filter(item => item.status === 'rejected');

  let cache = await loadCache();
  const geocodeStats = await resolveGeocodes(needsGeocode, cache);
  cache = geocodeStats.cache;
  if (geocodeStats.cacheDirty) await saveCache(cache);

  const applied = applyGeocodes(sourceMapped, [...needsGeocode, ...otherReview], cache);
  const deduped = dedupePins(applied.mapped);
  const matchedRows = sourceMapped.length + needsGeocode.length + otherReview.length;

  const report = {
    source_url: SOURCE_URL,
    queried_url: url,
    source_rows: rows.length,
    matched_rows: matchedRows,
    category_matches: matchedRows,
    source_coordinate_matches: sourceMapped.length,
    geocoded_matches: applied.geocodedMatches,
    geocode_lookups: geocodeStats.geocode_lookups,
    geocode_failures: geocodeStats.geocodeFailures,
    cache_file: CACHE_FILE,
    mapped_total: deduped.pins.length,
    needs_review: applied.stillReview.length,
    rejected: rejected.length,
    duplicate_count: deduped.duplicate_count,
    group_one: deduped.pins.filter(pin => pin.group === 1).length,
    group_two: deduped.pins.filter(pin => pin.group === 2).length,
    top_review_reasons: countReasons(applied.stillReview).slice(0, 10),
    top_rejection_reasons: countReasons(rejected).slice(0, 10),
    source_fields_sample: sourceFields(rows),
    generated_at: new Date().toISOString()
  };

  await fs.writeFile(OUT_FILE, `${JSON.stringify(deduped.pins, null, 2)}\n`);
  await fs.writeFile(REVIEW_FILE, `${JSON.stringify(applied.stillReview, null, 2)}\n`);
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
