/* Admin "What's New" panel (operator-only, ?desk=1 / ?assignment=1).
 *
 * Reads the backend's refresh diff + category coverage and shows, at a glance,
 * how much data we already track vs. what newly arrived in the last refresh —
 * so Howard can confirm the pipeline is live and see exactly what came through.
 * Inert for public visitors: it only wires itself up behind the operator flag,
 * so nothing here changes the public map.
 *
 * Sources (backend main, where discovery-feed-refresh commits them):
 *   data/nycif_new_events.json            what's-new diff
 *   data/comprehensive_feed_report.json   category coverage
 */
(() => {
  const VERSION = 'admin-whats-new-v01';
  const isOperator = (() => {
    try {
      const q = new URL(location.href).searchParams;
      return q.get('desk') === '1' || q.get('assignment') === '1';
    } catch { return false; }
  })();
  if (!isOperator) return;

  const BASE = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main';
  const NEW_URL = `${BASE}/data/nycif_new_events.json`;
  const COVERAGE_URL = `${BASE}/data/comprehensive_feed_report.json`;

  const esc = v => String(v ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => Number.isFinite(Number(v)) ? Number(v).toLocaleString() : '0';
  const when = v => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v)
      : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  function injectStyles() {
    if (document.getElementById(`${VERSION}-style`)) return;
    const s = document.createElement('style');
    s.id = `${VERSION}-style`;
    s.textContent = `
      #whatsNewBtnV01 { display:block; width:100%; margin-top:8px; padding:9px 12px;
        border:1px solid #cdd6e2; border-radius:10px; background:#eef4ff; color:#20406b;
        font-weight:600; cursor:pointer; }
      #whatsNewPanelV01 { position:absolute; top:64px; right:12px; z-index:1200;
        width:min(360px,92vw); max-height:74vh; overflow:auto; background:#fff;
        border:1px solid #d9dee6; border-radius:14px; box-shadow:0 12px 34px rgba(20,32,54,.22);
        padding:14px 14px 16px; }
      #whatsNewPanelV01 header { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
      #whatsNewPanelV01 h2 { font-size:15px; margin:0; }
      #whatsNewPanelV01 .wn-close { border:0; background:transparent; font-size:20px; line-height:1; cursor:pointer; color:#6b7280; }
      #whatsNewPanelV01 .wn-stats { display:flex; gap:8px; margin:8px 0 10px; }
      #whatsNewPanelV01 .wn-stat { flex:1; background:#f4f7fb; border-radius:10px; padding:8px 10px; }
      #whatsNewPanelV01 .wn-stat b { display:block; font-size:20px; color:#1c2b45; }
      #whatsNewPanelV01 .wn-stat span { font-size:11px; color:#5b6472; text-transform:uppercase; letter-spacing:.03em; }
      #whatsNewPanelV01 .wn-note { font-size:12px; color:#6b7280; margin:0 0 8px; }
      #whatsNewPanelV01 .wn-card { border:1px solid #eef1f5; border-radius:10px; padding:8px 10px; margin-bottom:7px; }
      #whatsNewPanelV01 .wn-card strong { display:block; font-size:13px; }
      #whatsNewPanelV01 .wn-card small { display:block; color:#6b7280; font-size:11px; }
      #whatsNewPanelV01 .wn-cov { font-size:11px; color:#4b5563; margin-top:10px; }
      #whatsNewPanelV01 .wn-cov code { background:#f4f7fb; border-radius:5px; padding:1px 5px; }
      #whatsNewPanelV01 .wn-empty-lane { color:#9aa0a6; }
    `;
    document.head.appendChild(s);
  }

  function ensurePanel() {
    let panel = document.getElementById('whatsNewPanelV01');
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.id = 'whatsNewPanelV01';
    panel.hidden = true;
    panel.setAttribute('aria-label', "What's new since last refresh");
    panel.innerHTML = `<header><h2>🆕 What’s New</h2>
      <button class="wn-close" type="button" aria-label="Close">×</button></header>
      <div id="whatsNewBodyV01"><p class="wn-note">Loading…</p></div>`;
    (document.querySelector('.map-shell') || document.body).appendChild(panel);
    panel.querySelector('.wn-close').addEventListener('click', () => { panel.hidden = true; });
    return panel;
  }

  async function loadInto(body) {
    body.innerHTML = '<p class="wn-note">Loading…</p>';
    try {
      const [nw, cov] = await Promise.all([
        fetch(`${NEW_URL}?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`${COVERAGE_URL}?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      ]);
      const events = Array.isArray(nw.events) ? nw.events : [];
      const stats = `<div class="wn-stats">
        <div class="wn-stat"><b>${num(nw.total_tracked)}</b><span>Already tracked</span></div>
        <div class="wn-stat"><b>${num(nw.new_this_run)}</b><span>New this run</span></div></div>`;
      const note = `<p class="wn-note">Refreshed ${esc(when(nw.generated_at_utc))}${
        nw.baseline_run ? ' · baseline run (deltas start next refresh)' : ''}.</p>`;
      const cards = events.length
        ? events.map(e => `<article class="wn-card">
            <strong>${esc(e.title || 'Untitled event')}</strong>
            <small>${esc(e.start_date || '')}${e.end_date && e.end_date !== e.start_date ? `–${esc(e.end_date)}` : ''} · ${esc(e.event_type || e.category || 'event')} · ${esc(e.borough || '')}</small>
          </article>`).join('')
        : `<p class="wn-note">No new permits since the last refresh.</p>`;
      let coverage = '';
      if (cov && cov.category_coverage) {
        const rows = Object.entries(cov.category_coverage)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([cat, info]) => `<div class="${info.count ? '' : 'wn-empty-lane'}"><code>${esc(cat)}</code> ${num(info.count)}${info.count ? '' : ' · not ready'}</div>`)
          .join('');
        coverage = `<div class="wn-cov"><strong>Category coverage</strong>${rows}</div>`;
      }
      body.innerHTML = stats + note + cards + coverage;
    } catch (err) {
      body.innerHTML = `<p class="wn-note">Could not load the refresh diff right now.</p>`;
    }
  }

  function addButton() {
    const layers = document.getElementById('layersPanel');
    if (!layers || document.getElementById('whatsNewBtnV01')) return;
    const btn = document.createElement('button');
    btn.id = 'whatsNewBtnV01';
    btn.type = 'button';
    btn.textContent = '🆕 What’s New (admin)';
    layers.appendChild(btn);
    btn.addEventListener('click', () => {
      const panel = ensurePanel();
      panel.hidden = false;
      loadInto(panel.querySelector('#whatsNewBodyV01'));
    });
  }

  function init() {
    injectStyles();
    ensurePanel();
    addButton();
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
