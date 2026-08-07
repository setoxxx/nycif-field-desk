(() => {
  'use strict';
  const STATE_URL = './data/mission-control-launch-state-v01.json';
  const cards = document.getElementById('cards');
  const status = document.getElementById('status');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const card = (label, value, cls='') => `<article class="card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div></article>`;
  fetch(STATE_URL, { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((s) => {
      const green = (v) => v === 'PASS' || v === 'READY' || v === 0;
      cards.innerHTML = [
        card('Phase', s.phase || 'UNKNOWN', 'warn'),
        card('Canonical map', s.canonical_public_map || 'UNAVAILABLE'),
        card('Map engine', s.final_map_engine || 'UNAVAILABLE'),
        card('Projector V2', s.gates?.projector_v2 || 'UNKNOWN', green(s.gates?.projector_v2) ? 'ok' : 'warn'),
        card('Sonar', s.gates?.sonar || 'UNKNOWN', green(s.gates?.sonar) ? 'ok' : 'warn'),
        card('Hosted shadow', s.gates?.hosted_shadow || 'BLOCKED', 'warn'),
        card('Mission Control parity', s.gates?.mission_control_parity || 'NOT_PASS', 'warn'),
        card('Legacy public runtimes', s.cleanup?.public_runtime_count ?? 'UNKNOWN', s.cleanup?.public_runtime_count === 0 ? 'ok' : 'bad'),
        card('Legacy unknowns', s.cleanup?.unknown_count ?? 'UNKNOWN', s.cleanup?.unknown_count === 0 ? 'ok' : 'bad'),
        card('Daily events', s.metrics?.daily_events ?? 'UNAVAILABLE_UNTIL_READER_SAFE_AGGREGATE'),
        card('New events', s.metrics?.new_events ?? 'UNAVAILABLE_UNTIL_READER_SAFE_AGGREGATE'),
        card('Audience', s.metrics?.audience ?? 'UNAVAILABLE_UNTIL_APPROVED_ANALYTICS'),
        card('Assignment Desk', s.operator?.assignment_desk || 'AVAILABLE_VIA_EXISTING_ROUTE'),
        card('News Desk', s.operator?.news_desk || 'NOT_YET_INTEGRATED'),
        card('Rollback', s.rollback?.status || 'PRESERVED', 'ok'),
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
