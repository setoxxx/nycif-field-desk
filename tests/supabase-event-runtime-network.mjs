import { chromium } from 'playwright';

const BASE_URL = process.env.NYCIF_TEST_URL || 'http://127.0.0.1:4173/index.html?resetFilters=1';
const SUPABASE_ORIGIN = 'https://oggwpvdirkrnzoolparx.supabase.co';
const RPC_PATH = '/rest/v1/rpc/nycif_events_reader_v1';
const LEGACY_EVENT_REPO_PREFIX = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/';
const TIMEOUT_MS = 30_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  timezoneId: 'America/New_York',
  serviceWorkers: 'block'
});
const page = await context.newPage();

const requests = [];
const responses = [];
const consoleErrors = [];
const pageErrors = [];

page.on('request', request => requests.push(request.url()));
page.on('response', response => responses.push({ url: response.url(), status: response.status() }));
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => pageErrors.push(String(error)));

await page.route(/tile\.openstreetmap\.org/, route => route.abort());

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  await page.waitForFunction(() => {
    const runtime = window.NYCIF_SUPABASE_EVENTS_RUNTIME_V01;
    const metadata = runtime?.getMetadata?.();
    return metadata?.authority === 'supabase_event_authority'
      && metadata?.event_data_origin === 'supabase_only';
  }, null, { timeout: TIMEOUT_MS });

  const runtimeState = await page.evaluate(() => {
    const runtime = window.NYCIF_SUPABASE_EVENTS_RUNTIME_V01;
    return {
      version: runtime?.VERSION,
      authority: runtime?.authority,
      eventDataOrigin: runtime?.eventDataOrigin,
      supabaseOrigin: runtime?.supabaseOrigin,
      rpcPath: runtime?.rpcPath,
      metadata: runtime?.getMetadata?.(),
      interceptedLegacyRequests: runtime?.getInterceptedLegacyRequests?.() || []
    };
  });

  const supabaseRequests = requests.filter(url => url.startsWith(`${SUPABASE_ORIGIN}${RPC_PATH}`));
  const supabaseResponses = responses.filter(item => item.url.startsWith(`${SUPABASE_ORIGIN}${RPC_PATH}`));
  const legacyNetworkRequests = requests.filter(url => url.startsWith(LEGACY_EVENT_REPO_PREFIX));

  assert(runtimeState.authority === 'supabase_event_authority', 'Runtime authority marker is not Supabase');
  assert(runtimeState.eventDataOrigin === 'supabase_only', 'Runtime event-data origin marker is not supabase_only');
  assert(runtimeState.supabaseOrigin === SUPABASE_ORIGIN, 'Runtime points at the wrong Supabase project');
  assert(runtimeState.rpcPath === RPC_PATH, 'Runtime points at the wrong reader RPC');
  assert(runtimeState.metadata?.reader_safe_event_count > 0, 'Reader returned no safe events');
  assert(runtimeState.metadata?.reader_window_start, 'Reader window start is missing');
  assert(runtimeState.metadata?.reader_window_end, 'Reader window end is missing');
  assert(runtimeState.metadata?.resource_warning === false, 'Reader resource warning is active');
  assert(supabaseRequests.length === 1, `Expected exactly one Supabase reader request, saw ${supabaseRequests.length}`);
  assert(supabaseResponses.length === 1 && supabaseResponses[0].status === 200, 'Supabase reader did not return HTTP 200');
  assert(legacyNetworkRequests.length === 0, `Browser contacted GitHub event-data runtime: ${legacyNetworkRequests.join(', ')}`);
  assert(runtimeState.interceptedLegacyRequests.length > 0, 'Compatibility layer did not intercept the legacy feed contract');
  assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);

  console.log(JSON.stringify({
    status: 'PASS',
    supabase_request_count: supabaseRequests.length,
    legacy_event_repo_network_request_count: legacyNetworkRequests.length,
    intercepted_legacy_contract_requests: runtimeState.interceptedLegacyRequests.length,
    reader_window_start: runtimeState.metadata.reader_window_start,
    reader_window_end: runtimeState.metadata.reader_window_end,
    reader_safe_event_count: runtimeState.metadata.reader_safe_event_count,
    exact_marker_count: runtimeState.metadata.exact_marker_count,
    metadata_complete_count: runtimeState.metadata.reader_metadata_complete_count,
    metadata_fallback_count: runtimeState.metadata.reader_metadata_fallback_count,
    resource_warning: runtimeState.metadata.resource_warning,
    console_errors: consoleErrors
  }, null, 2));
} finally {
  await browser.close();
}
