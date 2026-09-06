(() => {
  'use strict';
  const STATE_URL = './data/mission-control-launch-state-v01.json';
  const cards = document.getElementById('cards');
  const status = document.getElementById('status');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const card = (label, value, cls='') => `<article class="card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div></article>`;
  const green = (v) => v === 'PASS' || v === 'READY' || v === 'AVAILABLE' || v === 'PRESERVED' || v === 0;
  const warn = (v) => String(v ?? '').includes('PENDING') || String(v ?? '').includes('PARTIAL') || String(v ?? '').includes('UNAVAILABLE') || String(v ?? '').includes('BLOCKED') || String(v ?? '').includes('NOT_');
  fetch(STATE_URL, { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((s) => {
      const sourceRows = Array.isArray(s.source_health) ? s.source_health : [];
      const sourceSummary = sourceRows.length
        ? sourceRows.map((row) => `${row.source}: ${row.status}`).join(' | ')
        : 'UNAVAILABLE';
      cards.innerHTML = [
        card('Phase', s.phase || 'UNKNOWN', 'warn'),
        card('Canonical map', s.canonical_public_map || 'UNAVAILABLE'),
        card('Map engine', s.final_map_engine || 'UNAVAILABLE'),
        card('Projector authority', s.pipeline?.authority_status || 'UNKNOWN', green(s.pipeline?.authority_status) ? 'ok' : 'warn'),
        card('Projector splice', s.pipeline?.projector_splice_status || 'UNKNOWN', 'warn'),
        card('Reconciliation', s.pipeline?.reconciliation_status || 'UNKNOWN', 'warn'),
        card('Silent-loss gate', s.pipeline?.silent_identity_loss_status || 'UNKNOWN', 'warn'),
        card('Exact-pin gate', s.pipeline?.unsupported_exact_pin_status || 'UNKNOWN', 'warn'),
        card('Sonar', s.release?.sonar_quality_gate || s.gates?.sonar || 'UNKNOWN', green(s.release?.sonar_quality_gate || s.gates?.sonar) ? 'ok' : 'warn'),
        card('Reader-safe producer', s.release?.reader_safe_producer_status || 'UNKNOWN', green(s.release?.reader_safe_producer_status) ? 'ok' : 'warn'),
        card('Shadow runtime', s.release?.shadow_runtime_status || 'UNKNOWN', green(s.release?.shadow_runtime_status) ? 'ok' : 'warn'),
        card('Hosted endpoint', s.release?.hosted_endpoint_status || 'BLOCKED', 'warn'),
        card('Anonymous browser audit', s.release?.anonymous_browser_audit || 'NOT_RUN', 'warn'),
        card('Release pointer', s.release?.current_release_pointer || 'UNAVAILABLE', 'warn'),
        card('Source health', sourceSummary, sourceRows.every((row) => green(row.status)) ? 'ok' : 'warn'),
        card('Daily events', s.metrics?.daily_events ?? 'UNAVAILABLE_PENDING_READER_SAFE_AGGREGATE', warn(s.metrics?.daily_events) ? 'warn' : ''),
        card('New events', s.metrics?.new_events ?? 'UNAVAILABLE_PENDING_READER_SAFE_AGGREGATE', warn(s.metrics?.new_events) ? 'warn' : ''),
        card('Audience', s.metrics?.audience ?? 'UNAVAILABLE_UNTIL_APPROVED_ANALYTICS', 'warn'),
        card('Assignment Desk', s.operator?.assignment_desk?.status || 'UNKNOWN', green(s.operator?.assignment_desk?.status) ? 'ok' : 'warn'),
        card('Assignment freshness', s.operator?.assignment_desk?.freshness || 'UNAVAILABLE', 'warn'),
        card('News Desk', s.operator?.news_desk?.status || 'NOT_READY', 'warn'),
        card('Mission Control parity', s.gates?.mission_control_parity || 'NOT_PASS', 'warn'),
        card('Legacy public runtimes', s.cleanup?.public_runtime_count ?? 'UNKNOWN', s.cleanup?.public_runtime_count === 0 ? 'ok' : 'bad'),
        card('Legacy unknowns', s.cleanup?.unknown_count ?? 'UNKNOWN', s.cleanup?.unknown_count === 0 ? 'ok' : 'bad'),
        card('Rollback', s.rollback?.status || 'PRESERVED', green(s.rollback?.status) ? 'ok' : 'warn'),
        card('God View recovery', s.rollback?.god_view_recovery_status || 'UNKNOWN', green(s.rollback?.god_view_recovery_status) ? 'ok' : 'warn'),
      ].join('');
      status.textContent = s.summary || 'Launch state loaded.';
      status.className = 'notice';
    })
    .catch(() => {
      status.textContent = 'Mission Control launch state unavailable. No launch status is being inferred.';
      status.className = 'notice';
      cards.innerHTML = card('State', 'UNAVAILABLE', 'bad');
    });
})();
