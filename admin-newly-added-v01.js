(() => {
  const VERSION = 'admin-newly-added-v01';
  const DELTA_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/live_delta_report.json';
  const REPORT_URL = 'https://github.com/setoxxx/nycif-live-feeds/blob/main/data/live_delta_report.json';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function fmtNum(value) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '0';
  }

  function fmtTime(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function shortLocation(value) {
    const text = String(value || 'Location TBA').trim();
    return text.length > 220 ? `${text.slice(0, 220)}...` : text;
  }

  function eventCard(event) {
    const title = event.title || event.event_name || 'Untitled event';
    const date = event.date || String(event.start_date_time || '').slice(0, 10) || 'Date TBA';
    const time = event.display_time || event.start_date_time || 'Time TBA';
    const borough = event.borough || event.event_borough || 'Borough TBA';
    const location = event.display_location || event.location || event.event_location || 'Location TBA';
    const sourceId = event.source_event_id || event.event_id || '';
    const type = event.event_type || event.category || 'event';
    return `
      <article class="admin-new-event-card-v01">
        <strong>${esc(title)}</strong>
        <span>${esc(date)} · ${esc(time)} · ${esc(borough)}</span>
        <small>${esc(shortLocation(location))}</small>
        <small>${esc(type)}${sourceId ? ` · Event ID ${esc(sourceId)}` : ''}</small>
      </article>
    `;
  }

  function injectStyles() {
    if (document.getElementById('admin-newly-added-v01-style')) return;
    const style = document.createElement('style');
    style.id = 'admin-newly-added-v01-style';
    style.textContent = `
      #adminNewlyAddedBtnV01 {
        width: 100%;
        min-height: 40px;
        border: 0;
        border-radius: 13px;
        background: #d40000;
        color: #fff;
        font-weight: 1000;
        cursor: pointer;
        margin: 7px 0;
      }
      #adminNewlyAddedPanelV01 {
        position: absolute;
        z-index: 1250;
        right: calc(env(safe-area-inset-right, 0px) + 10px);
        top: calc(env(safe-area-inset-top, 0px) + 118px);
        width: min(390px, calc(100vw - 20px));
        max-height: 68dvh;
        overflow: auto;
        padding: 13px;
        border-radius: 18px;
        background: rgba(255,255,255,.98);
        color: #111827;
        box-shadow: 0 18px 55px rgba(0,0,0,.34);
        -webkit-overflow-scrolling: touch;
      }
      #adminNewlyAddedPanelV01[hidden] { display: none !important; }
      .admin-new-header-v01 { display: flex; align-items: start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
      .admin-new-header-v01 p { margin: 0; color: #d40000; font-size: 11px; font-weight: 1000; letter-spacing: .07em; text-transform: uppercase; }
      .admin-new-header-v01 h2 { margin: 2px 0 0; font-size: 19px; line-height: 1.05; }
      #adminNewlyAddedCloseV01 { width: 30px; height: 30px; border: 0; border-radius: 999px; background: #111827; color: #fff; font-size: 18px; cursor: pointer; }
      .admin-new-metrics-v01 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-bottom: 10px; }
      .admin-new-metric-v01 { border: 1px solid rgba(17,24,39,.08); border-radius: 13px; background: rgba(17,24,39,.04); padding: 8px; }
      .admin-new-metric-v01 strong { display: block; font-size: 18px; line-height: 1; }
      .admin-new-metric-v01 span { display: block; margin-top: 3px; color: #4b5563; font-size: 10px; font-weight: 900; text-transform: uppercase; }
      .admin-new-event-list-v01 { display: grid; gap: 8px; }
      .admin-new-event-card-v01 { border: 1px solid rgba(17,24,39,.10); border-radius: 13px; padding: 8px; background: #fff; box-shadow: 0 6px 16px rgba(17,24,39,.05); }
      .admin-new-event-card-v01 strong { display: block; margin-bottom: 3px; font-size: 12px; line-height: 1.18; }
      .admin-new-event-card-v01 span, .admin-new-event-card-v01 small { display: block; color: #4b5563; font-size: 10px; line-height: 1.28; }
      .admin-new-note-v01 { margin: 8px 0; color: #4b5563; font-size: 11px; line-height: 1.35; }
      .admin-new-actions-v01 { display: flex; flex-wrap: wrap; gap: 7px; margin: 10px 0 0; }
      .admin-new-actions-v01 button, .admin-new-actions-v01 a { border: 0; border-radius: 999px; padding: 8px 10px; background: #111827; color: #fff; font-size: 11px; font-weight: 900; text-decoration: none; cursor: pointer; }
      @media (max-width: 700px) { #adminNewlyAddedPanelV01 { left: 8px; right: 8px; width: auto; max-height: 64dvh; } }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (document.getElementById('adminNewlyAddedPanelV01')) return;
    const panel = document.createElement('aside');
    panel.id = 'adminNewlyAddedPanelV01';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Admin newly added events');
    panel.innerHTML = `
      <header class="admin-new-header-v01">
        <div><p>Admin only</p><h2>Newly Added Events</h2></div>
        <button id="adminNewlyAddedCloseV01" type="button" aria-label="Close newly added panel">×</button>
      </header>
      <div id="adminNewlyAddedBodyV01"><p class="admin-new-note-v01">Open this after each permit refresh to review newly added rows.</p></div>
    `;
    (document.querySelector('.map-shell') || document.body).appendChild(panel);
    document.getElementById('adminNewlyAddedCloseV01')?.addEventListener('click', () => { panel.hidden = true; });
  }

  function ensureButton() {
    const layers = document.getElementById('layersPanel');
    if (!layers || document.getElementById('adminNewlyAddedBtnV01')) return;
    const button = document.createElement('button');
    button.id = 'adminNewlyAddedBtnV01';
    button.type = 'button';
    button.textContent = 'Newly Added';
    const loadAll = document.getElementById('loadAllBtn');
    if (loadAll?.parentNode) loadAll.parentNode.insertBefore(button, loadAll.nextSibling);
    else layers.insertBefore(button, layers.firstChild);
    button.addEventListener('click', () => {
      const panel = document.getElementById('adminNewlyAddedPanelV01');
      if (!panel) return;
      panel.hidden = false;
      loadDelta();
    });
  }

  async function loadDelta() {
    const body = document.getElementById('adminNewlyAddedBodyV01');
    if (!body) return;
    body.innerHTML = '<p class="admin-new-note-v01">Loading latest delta report...</p>';
    try {
      const res = await fetch(`${DELTA_URL}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const report = await res.json();
      const added = Array.isArray(report.added_events) ? report.added_events : [];
      const textList = added.map(event => `${event.date || ''} | ${event.borough || ''} | ${event.title || event.event_name || 'Untitled'} | ${event.display_location || event.location || event.event_location || ''}`).join('\n');
      body.innerHTML = `
        <div class="admin-new-metrics-v01">
          <div class="admin-new-metric-v01"><strong>${fmtNum(report.added_count ?? added.length)}</strong><span>Added</span></div>
          <div class="admin-new-metric-v01"><strong>${fmtNum(report.current_staged_count)}</strong><span>Current staged</span></div>
          <div class="admin-new-metric-v01"><strong>${fmtNum(report.changed_count)}</strong><span>Changed</span></div>
          <div class="admin-new-metric-v01"><strong>${fmtNum(report.removed_count)}</strong><span>Removed</span></div>
        </div>
        <p class="admin-new-note-v01">Current feed: ${esc(fmtTime(report.current_feed_generated_at_utc))}. Previous snapshot: ${esc(fmtTime(report.previous_snapshot_generated_at_utc))}.</p>
        <div class="admin-new-event-list-v01">
          ${added.length ? added.map(eventCard).join('') : '<p class="admin-new-note-v01">No newly added events in the latest staged delta. The updated permit feed was pulled, but the current staged snapshot did not add new public-ready rows since the previous snapshot.</p>'}
        </div>
        <div class="admin-new-actions-v01">
          <button id="adminNewlyAddedCopyV01" type="button">Copy list</button>
          <a href="${REPORT_URL}" target="_blank" rel="noopener">Open report</a>
        </div>
      `;
      document.getElementById('adminNewlyAddedCopyV01')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(textList || 'No newly added events in latest delta.');
          document.getElementById('adminNewlyAddedCopyV01').textContent = 'Copied';
        } catch {
          window.prompt('Copy newly added events:', textList || 'No newly added events in latest delta.');
        }
      });
    } catch (error) {
      body.innerHTML = '<p class="admin-new-note-v01">Could not load the delta report. Check data/live_delta_report.json in the live-feeds repo.</p>';
    }
  }

  function init() {
    injectStyles();
    ensurePanel();
    ensureButton();
    window.NYCIF_ADMIN_NEWLY_ADDED = { version: VERSION, active: true };
  }

  window.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();
