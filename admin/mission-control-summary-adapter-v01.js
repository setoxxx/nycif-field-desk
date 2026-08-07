(() => {
  'use strict';

  const UNAVAILABLE = 'UNAVAILABLE_PENDING_READER_SAFE_AGGREGATE';
  const SCHEMA = 'nycif-mission-control-summary-v1';
  const ALLOWED_FIELDS = new Set([
    'schema_version', 'generated_at', 'release_id', 'release_sha', 'current_pointer',
    'data_health', 'sources', 'daily_event_count', 'new_event_count', 'projector_status',
    'reconciliation_status', 'silent_identity_loss', 'unsupported_exact_pins',
    'duplicate_exact_occurrences', 'daily_health', 'anonymous_audit_status', 'rollback_release',
  ]);
  const REQUIRED_FIELDS = new Set([
    'schema_version', 'generated_at', 'release_id', 'release_sha', 'data_health', 'sources',
    'projector_status', 'reconciliation_status', 'silent_identity_loss', 'unsupported_exact_pins',
    'duplicate_exact_occurrences', 'daily_health', 'anonymous_audit_status',
  ]);
  const SOURCE_FIELDS = new Set(['label', 'health', 'last_success_age_seconds', 'safe_event_count', 'last_release_id']);
  const SOURCE_LABELS = new Set(['Permitted Events', 'Citywide Calendar', 'Parks BigApps']);
  const HEALTH = new Set(['FRESH', 'STALE', 'BLOCKED', 'UNAVAILABLE']);
  const DATA_HEALTH = new Set(['READY', 'DEGRADED', 'BLOCKED', 'UNAVAILABLE']);
  const STATUS = new Set(['PASS', 'PENDING', 'BLOCKED', 'UNAVAILABLE']);
  const FORBIDDEN_TEXT = [
    'raw.githubusercontent.com',
    'github.com/',
    'localhost',
    '127.0.0.1',
    'private source',
    'private endpoint',
    'resolver internals',
    'ranking formula',
    'verification internals',
  ];
  const CREDENTIAL_RE = /(?:bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{8,}|api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|token\s*[:=])/i;

  const unavailable = (reason = UNAVAILABLE) => ({ status: UNAVAILABLE, reason, summary: null });
  const isNonNegativeIntOrNull = (v) => v === null || (Number.isInteger(v) && v >= 0);

  function configuredUrl() {
    const value = window.NYCIF_MISSION_CONTROL_SUMMARY_URL;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function isAllowedReaderSafeUrl(value) {
    if (!value || typeof value !== 'string') return false;
    if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/')) return true;
    let parsed;
    try { parsed = new URL(value, window.location?.href || 'https://nycinfocus.com/'); }
    catch { return false; }
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1') return false;
    if (host === 'raw.githubusercontent.com' || host === 'github.com' || host.endsWith('.github.com')) return false;
    return true;
  }

  function validateSummary(summary) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return false;
    const keys = Object.keys(summary);
    if (keys.some((key) => !ALLOWED_FIELDS.has(key))) return false;
    if ([...REQUIRED_FIELDS].some((key) => !(key in summary))) return false;
    if (summary.schema_version !== SCHEMA) return false;
    if (typeof summary.generated_at !== 'string' || !summary.generated_at) return false;
    if (typeof summary.release_id !== 'string' || !summary.release_id) return false;
    if (typeof summary.release_sha !== 'string' || !/^[0-9a-f]{7,64}$/.test(summary.release_sha)) return false;
    if (!DATA_HEALTH.has(summary.data_health) || !DATA_HEALTH.has(summary.daily_health)) return false;
    if (!STATUS.has(summary.projector_status) || !STATUS.has(summary.reconciliation_status) || !STATUS.has(summary.anonymous_audit_status)) return false;
    for (const key of ['daily_event_count', 'new_event_count', 'silent_identity_loss', 'unsupported_exact_pins', 'duplicate_exact_occurrences']) {
      if (!isNonNegativeIntOrNull(summary[key])) return false;
    }
    if (summary.current_pointer !== undefined && (typeof summary.current_pointer !== 'string' || !summary.current_pointer)) return false;
    if (summary.rollback_release !== undefined && (typeof summary.rollback_release !== 'string' || !summary.rollback_release)) return false;
    if (!Array.isArray(summary.sources)) return false;
    const seen = new Set();
    for (const row of summary.sources) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      if (Object.keys(row).some((key) => !SOURCE_FIELDS.has(key))) return false;
      if (!SOURCE_LABELS.has(row.label) || seen.has(row.label)) return false;
      seen.add(row.label);
      if (!HEALTH.has(row.health)) return false;
      if (!isNonNegativeIntOrNull(row.last_success_age_seconds)) return false;
      if (!isNonNegativeIntOrNull(row.safe_event_count)) return false;
      if (typeof row.last_release_id !== 'string' || !row.last_release_id) return false;
    }
    if (seen.size !== SOURCE_LABELS.size) return false;
    const encoded = JSON.stringify(summary).toLowerCase();
    if (FORBIDDEN_TEXT.some((token) => encoded.includes(token))) return false;
    if (CREDENTIAL_RE.test(encoded)) return false;
    return true;
  }

  async function load() {
    const url = configuredUrl();
    if (!url) return unavailable('NO_READER_SAFE_SUMMARY_URL_CONFIGURED');
    if (!isAllowedReaderSafeUrl(url)) return unavailable('INVALID_READER_SAFE_SUMMARY_URL');
    try {
      const response = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'error' });
      if (!response.ok) return unavailable(`HTTP_${response.status}`);
      const summary = await response.json();
      if (!validateSummary(summary)) return unavailable('INVALID_READER_SAFE_SUMMARY_CONTRACT');
      return { status: 'AVAILABLE', reason: null, summary };
    } catch {
      return unavailable('READER_SAFE_SUMMARY_FETCH_FAILED');
    }
  }

  window.NYCIF_MISSION_CONTROL_SUMMARY_ADAPTER = Object.freeze({
    load,
    validateSummary,
    isAllowedReaderSafeUrl,
    unavailableStatus: UNAVAILABLE,
  });
})();
