(() => {
  'use strict';

  const VERSION = 'god-view-recovery-v01';
  const RECOVERY_URL = './data/god-view-recovery-manifest-v01.json';
  const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

  const byId = id => document.getElementById(id);
  const text = value => String(value ?? '').trim();
  const shortSha = sha => text(sha) ? text(sha).slice(0, 10) : 'Unknown';
  const clear = element => {
    if (element) element.replaceChildren();
    return element;
  };
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = text(value);
    return element;
  };
  const verifiedDateFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York'
  });
  const verifiedDate = value => new Date(value);
  const isStale = verifiedAt => {
    const timestamp = verifiedDate(verifiedAt).getTime();
    return !Number.isFinite(timestamp) || Date.now() - timestamp > STALE_AFTER_MS;
  };
  const formatVerified = verifiedAt => {
    const date = verifiedDate(verifiedAt);
    return Number.isNaN(date.getTime()) ? 'Unknown' : verifiedDateFormatter.format(date);
  };
  const card = (label, value, detail, tone = '') => {
    const element = node('article', `stat recovery-stat ${tone}`.trim());
    element.append(node('div', 'label', label), node('div', 'value', value));
    if (detail) element.append(node('div', 'detail', detail));
    return element;
  };
  const appendLink = (parent, label, url) => {
    if (!parent || !url) return;
    const link = node('a', '', label);
    link.href = url;
    if (/^https?:\/\//i.test(url)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    parent.append(link);
  };

  function render(manifest) {
    const stale = isStale(manifest.verified_at_utc);
    const freshness = byId('recovery-freshness');
    freshness.hidden = false;
    freshness.className = `notice ${stale ? 'danger' : 'ok'}`;
    freshness.textContent = stale
      ? `Recovery manifest is stale or invalid. Last verified: ${formatVerified(manifest.verified_at_utc)}. Re-verify before using a rollback instruction.`
      : `Recovery manifest verified ${formatVerified(manifest.verified_at_utc)}. Immutable baseline and protected surfaces are recorded.`;

    const target = clear(byId('recovery-status-grid'));
    target.append(
      card('Recovery status', stale ? 'stale — re-verify' : 'current', stale ? 'Do not use as healthy recovery evidence until refreshed.' : 'Recovery anchors are available.', stale ? 'danger' : 'ok'),
      card('Immutable baseline', shortSha(manifest.recovery_anchors?.pre_god_view_baseline_sha), 'Pre-God-View Field Desk main; never replace with moving main.'),
      card('Verified God View head', shortSha(manifest.pull_request?.head_sha_when_verified), 'Implementation head inspected before the manifest metadata commit.'),
      card('Pull request', `#${manifest.pull_request?.number || 'Unknown'}`, manifest.pull_request?.branch || 'Branch unavailable'),
      card('Last verified', formatVerified(manifest.verified_at_utc), manifest.repository || 'Repository unavailable')
    );

    const links = clear(byId('recovery-links'));
    appendLink(links, 'Master Source of Truth', manifest.documents?.master_source_of_truth);
    appendLink(links, 'Master Recovery Prompt', manifest.documents?.master_recovery_prompt);
    appendLink(links, 'Recovery Manifest', manifest.documents?.recovery_manifest || RECOVERY_URL);
    document.documentElement.dataset.recoveryState = stale ? 'stale' : 'current';
  }

  function renderFailure(error) {
    const freshness = byId('recovery-freshness');
    freshness.hidden = false;
    freshness.className = 'notice danger';
    freshness.textContent = `Recovery information unavailable: ${error.message}. Do not treat recovery status as healthy.`;
    const target = clear(byId('recovery-status-grid'));
    target.append(card('Recovery status', 'unavailable', 'Read the repository and rebuild recovery evidence before attempting rollback.', 'danger'));
    clear(byId('recovery-links'));
    document.documentElement.dataset.recoveryState = 'error';
  }

  async function load() {
    const response = await fetch(`${RECOVERY_URL}?v=${encodeURIComponent(VERSION)}&cache=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  load().then(render).catch(renderFailure);

  window.NYCIF_GOD_VIEW_RECOVERY_V01 = {
    VERSION,
    RECOVERY_URL,
    STALE_AFTER_MS,
    isStale
  };
})();
