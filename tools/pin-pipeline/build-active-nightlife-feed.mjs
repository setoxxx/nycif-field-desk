import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_FILE = 'data/nycif_nightlife_noise_correlation.json';
const OUT_DIR = 'data';
const REPORT_DIR = 'data/reports';
const FEED_FILE = path.join(OUT_DIR, 'nycif_active_nightlife_feed.json');
const DIGEST_FILE = path.join(OUT_DIR, 'nycif_active_nightlife_digest.json');
const REPORT_FILE = path.join(REPORT_DIR, 'active_nightlife_feed_report.json');

const MAX_FEED_ITEMS = Number(process.env.NYCIF_ACTIVE_NIGHTLIFE_MAX_ITEMS || 500);
const MAX_CITYWIDE = Number(process.env.NYCIF_ACTIVE_NIGHTLIFE_CITYWIDE || 50);
const MAX_PER_BOROUGH = Number(process.env.NYCIF_ACTIVE_NIGHTLIFE_PER_BOROUGH || 25);
const MAX_BUCKET_ITEMS = Number(process.env.NYCIF_ACTIVE_NIGHTLIFE_BUCKET_ITEMS || 100);

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const EDITORIAL_NOTE = 'Public complaint activity proxy only; verify before publication or field assignment.';
const DATA_NOTE = 'This active feed is generated from public 311 complaint records matched against the NYCIF nightlife correlation layer. It is not proof of crowd size, popularity, wrongdoing, violation, or unsafe conditions.';

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function numberFrom(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysSince(value, now = new Date()) {
  const date = parseDate(value);
  if (!date) return 9999;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

async function readJsonArray(file) {
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${file} did not contain an array`);
  return parsed;
}

function descriptorNames(item) {
  return Array.isArray(item.top_noise_descriptors)
    ? item.top_noise_descriptors.map(entry => clean(entry.value || entry)).filter(Boolean)
    : [];
}

function classifyBuckets(item, now = new Date()) {
  const score = numberFrom(item.trend_score);
  const tier = clean(item.trend_tier);
  const recentDays = daysSince(item.last_complaint_date, now);
  const complaints30d100ft = numberFrom(item.complaints_30d_100ft);
  const complaints90d100ft = numberFrom(item.complaints_90d_100ft);
  const complaints90d250ft = numberFrom(item.complaints_90d_250ft);
  const lateNight = numberFrom(item.late_night_complaints_365d);
  const weekend = numberFrom(item.weekend_complaints_365d);
  const group = numberFrom(item.group);
  const buckets = new Set();

  if ((tier === 'very_high' || score >= 80) && recentDays <= 45) buckets.add('hot_now');
  if ((complaints30d100ft >= 1 || complaints90d100ft >= 2 || complaints90d250ft >= 8) && recentDays <= 90) buckets.add('rising');
  if (lateNight >= 12 && recentDays <= 180) buckets.add('late_night_pressure');
  if (weekend >= 12 && recentDays <= 180) buckets.add('weekend_pressure');
  if (score >= 40 || tier === 'high' || tier === 'very_high') buckets.add('watchlist');
  if (group === 1 && score >= 25) buckets.add('group_one_watchlist');
  if (score >= 120 || lateNight >= 30 || weekend >= 30) buckets.add('needs_editor_review');

  if (!buckets.size && score >= 12 && recentDays <= 365) buckets.add('background_signal');
  return [...buckets];
}

function feedPriority(item, buckets) {
  let priority = numberFrom(item.trend_score);
  if (buckets.includes('hot_now')) priority += 80;
  if (buckets.includes('rising')) priority += 50;
  if (buckets.includes('needs_editor_review')) priority += 35;
  if (buckets.includes('late_night_pressure')) priority += 20;
  if (buckets.includes('weekend_pressure')) priority += 15;
  if (numberFrom(item.group) === 1) priority += 10;
  priority += Math.max(0, 30 - daysSince(item.last_complaint_date));
  return priority;
}

function normalizeFeedItem(item, now = new Date()) {
  const buckets = classifyBuckets(item, now);
  const primaryBucket = buckets[0] || 'background_signal';
  return {
    id: clean(item.id),
    title: clean(item.title),
    address: clean(item.address),
    borough: clean(item.borough),
    lat: numberFrom(item.lat),
    lng: numberFrom(item.lng),
    subtype: clean(item.subtype),
    subtype_label: clean(item.subtype_label),
    group: numberFrom(item.group),
    trend_score: numberFrom(item.trend_score),
    trend_tier: clean(item.trend_tier),
    last_complaint_date: clean(item.last_complaint_date),
    days_since_last_complaint: daysSince(item.last_complaint_date, now),
    complaints_30d_100ft: numberFrom(item.complaints_30d_100ft),
    complaints_90d_100ft: numberFrom(item.complaints_90d_100ft),
    complaints_365d_100ft: numberFrom(item.complaints_365d_100ft),
    complaints_365d_250ft: numberFrom(item.complaints_365d_250ft),
    complaints_365d_500ft: numberFrom(item.complaints_365d_500ft),
    late_night_complaints_365d: numberFrom(item.late_night_complaints_365d),
    weekend_complaints_365d: numberFrom(item.weekend_complaints_365d),
    top_noise_descriptors: descriptorNames(item),
    feed_bucket: primaryBucket,
    feed_buckets: buckets,
    feed_priority: feedPriority(item, buckets),
    editorial_note: EDITORIAL_NOTE,
    data_note: DATA_NOTE
  };
}

function byPriority(a, b) {
  return b.feed_priority - a.feed_priority || b.trend_score - a.trend_score || a.title.localeCompare(b.title);
}

function uniqueById(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    output.push(item);
  }
  return output;
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = clean(typeof key === 'function' ? key(item) : item[key]);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }));
}

function bucketItems(items, bucket, limit = MAX_BUCKET_ITEMS) {
  return items.filter(item => item.feed_buckets.includes(bucket)).sort(byPriority).slice(0, limit);
}

function compactItem(item) {
  return {
    id: item.id,
    title: item.title,
    address: item.address,
    borough: item.borough,
    subtype_label: item.subtype_label,
    trend_score: item.trend_score,
    trend_tier: item.trend_tier,
    feed_bucket: item.feed_bucket,
    feed_priority: item.feed_priority,
    last_complaint_date: item.last_complaint_date,
    days_since_last_complaint: item.days_since_last_complaint,
    complaints_30d_100ft: item.complaints_30d_100ft,
    complaints_90d_100ft: item.complaints_90d_100ft,
    complaints_365d_100ft: item.complaints_365d_100ft,
    late_night_complaints_365d: item.late_night_complaints_365d,
    weekend_complaints_365d: item.weekend_complaints_365d,
    top_noise_descriptors: item.top_noise_descriptors
  };
}

function topByBorough(items) {
  const output = {};
  for (const borough of BOROUGHS) {
    output[borough] = items.filter(item => item.borough === borough).sort(byPriority).slice(0, MAX_PER_BOROUGH).map(compactItem);
  }
  return output;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const now = new Date();
  const source = await readJsonArray(SOURCE_FILE);
  const feedCandidates = source.map(item => normalizeFeedItem(item, now));
  const selected = uniqueById([
    ...bucketItems(feedCandidates, 'hot_now'),
    ...bucketItems(feedCandidates, 'rising'),
    ...bucketItems(feedCandidates, 'needs_editor_review'),
    ...bucketItems(feedCandidates, 'late_night_pressure'),
    ...bucketItems(feedCandidates, 'weekend_pressure'),
    ...bucketItems(feedCandidates, 'group_one_watchlist'),
    ...bucketItems(feedCandidates, 'watchlist')
  ]).sort(byPriority).slice(0, MAX_FEED_ITEMS);

  const buckets = {
    hot_now: bucketItems(selected, 'hot_now'),
    rising: bucketItems(selected, 'rising'),
    late_night_pressure: bucketItems(selected, 'late_night_pressure'),
    weekend_pressure: bucketItems(selected, 'weekend_pressure'),
    watchlist: bucketItems(selected, 'watchlist'),
    group_one_watchlist: bucketItems(selected, 'group_one_watchlist'),
    needs_editor_review: bucketItems(selected, 'needs_editor_review')
  };

  const digest = {
    generated_at: now.toISOString(),
    source_file: SOURCE_FILE,
    summary: {
      source_records: source.length,
      feed_records: selected.length,
      hot_now_count: buckets.hot_now.length,
      rising_count: buckets.rising.length,
      late_night_pressure_count: buckets.late_night_pressure.length,
      weekend_pressure_count: buckets.weekend_pressure.length,
      watchlist_count: buckets.watchlist.length,
      needs_editor_review_count: buckets.needs_editor_review.length
    },
    top_citywide: selected.slice(0, MAX_CITYWIDE).map(compactItem),
    top_by_borough: topByBorough(selected),
    buckets: Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, value.slice(0, 25).map(compactItem)])),
    editorial_warnings: [
      'Use as public-record activity signal only.',
      'Verify before publication, field assignment, or direct venue characterization.',
      'Do not describe as live crowd size, verified popularity, wrongdoing, violation, or safety condition.'
    ],
    data_note: DATA_NOTE
  };

  const report = {
    source_file: SOURCE_FILE,
    output_feed_file: FEED_FILE,
    output_digest_file: DIGEST_FILE,
    source_records: source.length,
    feed_records: selected.length,
    max_feed_items: MAX_FEED_ITEMS,
    excluded_records: source.length - selected.length,
    bucket_counts: Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, value.length])),
    borough_counts: countBy(selected, 'borough'),
    subtype_counts: countBy(selected, 'subtype_label'),
    tier_counts: countBy(selected, 'trend_tier'),
    top_feed_sample: selected.slice(0, 25).map(compactItem),
    data_note: DATA_NOTE,
    generated_at: now.toISOString()
  };

  await fs.writeFile(FEED_FILE, `${JSON.stringify(selected, null, 2)}\n`);
  await fs.writeFile(DIGEST_FILE, `${JSON.stringify(digest, null, 2)}\n`);
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${FEED_FILE}`);
  console.log(`Wrote ${DIGEST_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
