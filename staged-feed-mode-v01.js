(() => {
  const FEED = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json';
  const REPORT = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/staged_live_manifest.json';
  let feedData = null;
  let reportData = null;
  let lastStatus = 'Inactive.';

  function clean(value) {
    return String(value ?? '').replace(/[&<>]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char];
    });
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString() : '0';
  }

  function getRows() {
    return Array.isArray(feedData?.events) ? feedData.events : [];
  }

  function countDrawable() {
    return getRows().filter(function (row) {
      return row && row.production_ready === true && row.needs_review === false && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng));
    }).length;
  }

  function ensure() {
    if (document.getElementById('stagedFeedModePanelV01')) return;
    const button = document.createElement('button');
    button.id = 'stagedFeedModeToggleV01';
    button.className = 'staged-map-toggle-v01';
    button.type = 'button';
    button.textContent = 'Staged Feed';

    const panel = document.createElement('aside');
    panel.id = 'stagedFeedModePanelV01';
    panel.className = 'staged-map-panel-v01';
    panel.hidden = true;
    panel.innerHTML = '<header><div><h2>Staged Feed Mode</h2><p>Production-shaped staged feed QA</p></div><button class="staged-map-close-v01" type="button">x</button></header><div id="stagedFeedModeBodyV01" class="staged-map-body-v01"></div>';

    document.body.append(button, panel);
    button.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      render();
    });
    panel.querySelector('.staged-map-close-v01').addEventListener('click', function () {
      panel.hidden = true;
    });
  }

  async function loadJson(url) {
    const response = await fetch(url + '?v=' + Date.now(), { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' loading ' + url.split('/').pop());
    return response.json();
  }

  async function loadStagedFeed() {
    lastStatus = 'Loading staged feed...';
    render();
    try {
      const results = await Promise.all([loadJson(REPORT), loadJson(FEED)]);
      reportData = results[0];
      feedData = results[1];
      lastStatus = 'Staged feed loaded. Ready for staged map wiring.';
    } catch (error) {
      lastStatus = 'Error: ' + (error.message || String(error));
    }
    render();
  }

  function stat(label, value) {
    return '<div class="staged-map-stat-v01"><span>' + clean(label) + '</span><strong>' + clean(value) + '</strong></div>';
  }

  function block(title, counts) {
    const entries = Object.entries(counts || {}).sort(function (a, b) { return Number(b[1]) - Number(a[1]); });
    const rows = entries.length ? entries.map(function (item) { return clean(item[0]) + ': ' + number(item[1]); }).join('<br>') : 'Not loaded';
    return '<div><strong>' + clean(title) + '</strong>' + rows + '</div>';
  }

  function render() {
    ensure();
    const body = document.getElementById('stagedFeedModeBodyV01');
    if (!body) return;
    const rows = getRows();
    const drawable = countDrawable();
    const skipped = reportData?.skipped_needs_review_or_bad_gps || 0;
    body.innerHTML = '<div class="staged-map-actions-v01"><button id="loadStagedFeedModeV01" type="button">Load Staged Feed</button></div>' +
      '<div class="staged-map-stats-v01">' +
      stat('Staged rows', number(reportData?.staged_feed_events || rows.length)) +
      stat('Drawable', number(drawable)) +
      stat('Skipped QA', number(skipped)) +
      stat('Ready flag', String(reportData?.production_ready ?? 'unknown')) +
      '</div>' +
      '<p class="staged-map-note-v01">Status: ' + clean(lastStatus) + '<br>production_feed: ' + clean(reportData?.production_feed) + ' | staged_feed: ' + clean(reportData?.staged_feed) + '</p>' +
      '<div class="staged-map-breakdown-v01">' + block('Boroughs', reportData?.borough_counts) + block('Categories', reportData?.category_counts) + '</div>';
    body.querySelector('#loadStagedFeedModeV01').addEventListener('click', loadStagedFeed);
  }

  window.addEventListener('DOMContentLoaded', render);
})();
