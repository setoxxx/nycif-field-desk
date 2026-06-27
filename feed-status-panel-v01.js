(() => {
  const VERSION = 'feed-status-panel-v01';
  const REPORT_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/live_delta_report.json';
  const RAW_REPORT_URL = 'https://github.com/setoxxx/nycif-live-feeds/blob/main/data/live_delta_report.json';

  const fmtNum = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '0';

  function qs(selector) { return document.querySelector(selector); }

  function safeText(value, fallback = '') {
    return String(value ?? fallback).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function formatDateTime(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function eventLine(event) {
    const title = safeText(event.title || 'Untitled event');
    const date = safeText(event.date || 'Date TBA');
    const time = safeText(event.display_time || event.start_date_time || 'Time TBA');
    const borough = safeText(event.borough || 'Borough TBA');
    const location = safeText(event.display_location || event.location || 'Location TBA');
    const type = safeText(event.event_type || event.category || 'event');
    const score = event.outreach_score ? `<span class="feed-status-badge-v01">PR lead score ${safeText(event.outreach_score)}</span>` : '';
    return `
      <article class="feed-status-event-v01">
        <strong>${title}</strong>
        <span>${date} · ${time} · ${borough}</span>
        <small>${location}</small>
        <small>${type}</small>
        ${score}
      </article>
    `;
  }

  function panelShell() {
    if (qs('#feedStatusPanelV01')) return;
    const button = document.createElement('button');
    button.id = 'feedStatusToggleV01';
    button.type = 'button';
    button.textContent = 'Feed Status';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'feedStatusPanelV01');

    const panel = document.createElement('aside');
    panel.id = 'feedStatusPanelV01';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Feed status and new events');
    panel.innerHTML = `
      <header class="feed-status-header-v01">
        <div>
          <p>NYCIF Live Feed</p>
          <h2>Feed Status</h2>
        </div>
        <button id="feedStatusCloseV01" type="button" aria-label="Close feed status">×</button>
      </header>
      <div id="feedStatusBodyV01"><p class="feed-status-note-v01">Open to load latest feed report.</p></div>
    `;

    const shell = qs('.map-shell') || document.body;
    shell.appendChild(button);
    shell.appendChild(panel);

    button.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) loadReport();
    });
    qs('#feedStatusCloseV01')?.addEventListener('click', () => {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function renderReport(report) {
    const body = qs('#feedStatusBodyV01');
    const toggle = qs('#feedStatusToggleV01');
    if (!body) return;

    const summary = report.summary || {};
    const added = Number(report.added_count ?? summary.added ?? 0);
    const removed = Number(report.removed_count ?? summary.removed ?? 0);
    const changed = Number(report.changed_count ?? summary.changed ?? 0);
    const leads = Number(report.pr_outreach_candidate_count ?? summary.pr_outreach_candidates ?? 0);
    const current = Number(report.current_staged_count ?? 0);
    const net = Number(report.net_change ?? summary.net_change ?? 0);
    const candidates = Array.isArray(report.pr_outreach_candidates) ? report.pr_outreach_candidates.slice(0, 5) : [];
    const addedEvents = Array.isArray(report.added_events) ? report.added_events.slice(0, 5) : [];

    if (toggle) {
      toggle.textContent = added > 0 ? `New: ${fmtNum(added)}` : 'Feed Status';
      toggle.classList.toggle('has-new', added > 0);
    }

    body.innerHTML = `
      <div class="feed-status-grid-v01">
        <div class="feed-status-metric-v01"><strong>${fmtNum(current)}</strong><span>Current staged</span></div>
        <div class="feed-status-metric-v01"><strong>${fmtNum(added)}</strong><span>New added</span></div>
        <div class="feed-status-metric-v01"><strong>${fmtNum(leads)}</strong><span>PR leads</span></div>
        <div class="feed-status-metric-v01"><strong>${safeText(net > 0 ? '+' + net : net)}</strong><span>Net change</span></div>
      </div>
      <p class="feed-status-note-v01">Last feed: ${safeText(formatDateTime(report.current_feed_generated_at_utc || report.generated_at_utc))}. Removed/expired: ${fmtNum(removed)}. Changed: ${fmtNum(changed)}.</p>
      <section class="feed-status-section-v01">
        <h3>Best PR outreach leads</h3>
        <div class="feed-status-list-v01">
          ${candidates.length ? candidates.map(eventLine).join('') : '<p class="feed-status-note-v01">No PR outreach leads in the latest delta yet.</p>'}
        </div>
      </section>
      <section class="feed-status-section-v01">
        <h3>Newly added events</h3>
        <div class="feed-status-list-v01">
          ${addedEvents.length ? addedEvents.map(eventLine).join('') : '<p class="feed-status-note-v01">No newly added events in the latest report.</p>'}
        </div>
      </section>
      <button id="feedStatusRefreshV01" type="button">Refresh</button>
      <p class="feed-status-note-v01"><a href="${RAW_REPORT_URL}" target="_blank" rel="noopener">Open full backend report</a></p>
    `;
    qs('#feedStatusRefreshV01')?.addEventListener('click', loadReport);
  }

  async function loadReport() {
    const body = qs('#feedStatusBodyV01');
    if (body) body.innerHTML = '<p class="feed-status-note-v01">Loading latest feed status...</p>';
    try {
      const url = `${REPORT_URL}?v=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const report = await response.json();
      renderReport(report);
    } catch (error) {
      if (body) {
        body.innerHTML = `
          <div class="feed-status-error-v01">Feed status report is not available yet. The backend may need one more hourly run to create data/live_delta_report.json.</div>
          <button id="feedStatusRefreshV01" type="button">Try again</button>
        `;
        qs('#feedStatusRefreshV01')?.addEventListener('click', loadReport);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', panelShell);
  if (document.readyState !== 'loading') panelShell();
  window.NYCIF_FEED_STATUS_PANEL = { version: VERSION, active: true };
})();
