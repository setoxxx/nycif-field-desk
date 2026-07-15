(() => {
  'use strict';

  const VERSION = 'god-view-project-control-v01';
  const STATE_URL = './data/god-view-project-state-v01.json';
  const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

  const byId = id => document.getElementById(id);
  const text = value => String(value ?? '').trim();
  const clear = node => {
    if (node) node.replaceChildren();
    return node;
  };
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = text(value);
    return element;
  };
  const external = url => /^https?:\/\//i.test(text(url));
  const appendLink = (parent, label, url, className = '') => {
    if (!parent || !url) return null;
    const link = node('a', className, label);
    link.href = url;
    if (external(url)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    parent.append(link);
    return link;
  };
  const statusTone = status => {
    const value = text(status).toLowerCase();
    if (['healthy', 'complete', 'active', 'verified', 'frozen', 'done'].includes(value)) return 'ok';
    if (['blocked', 'failed', 'danger', 'high'].includes(value)) return 'danger';
    if (['planned', 'queued', 'future', 'not_connected', 'under_review'].includes(value)) return 'violet';
    return 'warn';
  };
  const humanize = value => text(value).replaceAll('_', ' ');
  const isStale = (verifiedAt, now = Date.now()) => {
    const parsed = Date.parse(verifiedAt);
    return !Number.isFinite(parsed) || now - parsed > STALE_AFTER_MS;
  };
  const formatVerified = verifiedAt => {
    const parsed = Date.parse(verifiedAt);
    if (!Number.isFinite(parsed)) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/New_York'
    }).format(parsed);
  };
  const shortSha = sha => text(sha) ? text(sha).slice(0, 10) : 'Unknown';

  function renderHero(state, stale) {
    byId('current-objective').textContent = state.project.current_objective;
    byId('current-stage').textContent = state.project.current_stage_label;
    byId('current-gate-label').textContent = state.current_gate.label;
    byId('next-gate-label').textContent = state.next_gate.label;
    byId('future-work-lock').textContent = state.future_work_lock.message;

    const badges = clear(byId('project-badges'));
    [
      ['Read-only', 'ok'],
      [state.project.current_stage_label, 'warn'],
      ['Review required', 'warn'],
      ['Future expansion locked', 'violet']
    ].forEach(([label, tone]) => badges.append(node('span', `badge ${tone}`, label)));

    const actions = clear(byId('project-actions'));
    appendLink(actions, 'Assignment Desk Calendar', './calendar.html', 'primary-action');
    appendLink(actions, 'Public Map', 'https://nycinfocus.com/map/');
    appendLink(actions, 'Current Gate', state.current_gate.url);
    appendLink(actions, 'Project Roadmap', '#roadmap');
    appendLink(actions, 'Platform Architecture', './platform-architecture.html');

    const freshness = byId('project-state-freshness');
    freshness.hidden = false;
    freshness.className = `notice ${stale ? 'danger' : 'ok'}`;
    freshness.textContent = stale
      ? `Project-state record is stale or invalid. Last verified: ${formatVerified(state.verified_at_utc)}. Re-verify repository and PR state before acting.`
      : `Project state verified ${formatVerified(state.verified_at_utc)} against Field Desk ${shortSha(state.verified_against.field_desk_main_sha)} and Live Feeds ${shortSha(state.verified_against.live_feeds_main_sha)}.`;
  }

  function summaryCard(label, value, detail, tone = '') {
    const card = node('article', `stat project-stat ${tone}`.trim());
    card.append(node('div', 'label', label), node('div', 'value', value));
    if (detail) card.append(node('div', 'detail', detail));
    return card;
  }

  function renderSummary(state, stale) {
    const target = clear(byId('project-summary'));
    target.append(
      summaryCard('Project health', humanize(state.project.health), state.project.current_objective, statusTone(state.project.health)),
      summaryCard('Map status', state.project.map_status, 'Current program stage: Map v1 Completion', 'warn'),
      summaryCard('Current gate', state.current_gate.label, state.current_gate.decision_required, statusTone(state.current_gate.status)),
      summaryCard('Next decision', state.next_gate.label, state.next_gate.decision_required, statusTone(state.next_gate.status)),
      summaryCard('Last verified', formatVerified(state.verified_at_utc), `${stale ? 'STALE' : 'CURRENT'} · Field Desk ${shortSha(state.verified_against.field_desk_main_sha)}`, stale ? 'danger' : 'ok')
    );
  }

  function itemList(items) {
    const list = node('ul', 'control-list');
    (items || []).forEach(item => {
      const row = node('li');
      row.append(node('strong', '', item.label));
      if (item.detail) row.append(node('span', 'detail', item.detail));
      list.append(row);
    });
    if (!list.childNodes.length) list.append(node('li', 'empty', 'No items recorded.'));
    return list;
  }

  function renderRoadmap(state) {
    const target = clear(byId('roadmap-columns'));
    const stages = [
      ['NOW — Finish Map v1', state.workstreams.under_review, 'warn'],
      ['NEXT — Freeze and Monitor', state.workstreams.next, 'ok'],
      ['LATER — Controlled Expansion', state.workstreams.future, 'violet']
    ];
    stages.forEach(([title, items, tone]) => {
      const section = node('article', `roadmap-column ${tone}`);
      section.append(node('h3', '', title), itemList(items));
      if (tone === 'violet') section.append(node('div', 'future-lock', 'NOT AUTHORIZED · NOT CONNECTED · FUTURE PHASE'));
      target.append(section);
    });
  }

  function renderWorkstreams(state) {
    const target = clear(byId('workstream-board'));
    [
      ['Done', state.workstreams.done, 'ok'],
      ['Under review', state.workstreams.under_review, 'warn'],
      ['Next', state.workstreams.next, 'violet'],
      ['Future', state.workstreams.future, '']
    ].forEach(([title, items, tone]) => {
      const column = node('article', `workstream-column ${tone}`.trim());
      column.append(node('h3', '', title), itemList(items));
      target.append(column);
    });
  }

  function renderDecisions(state) {
    const target = clear(byId('decision-log'));
    (state.decisions || []).forEach(decision => {
      const entry = node('article', 'decision-entry');
      const meta = node('div', 'decision-meta');
      meta.append(node('time', '', decision.date), node('span', `chip ${statusTone(decision.status)}`, humanize(decision.status)));
      entry.append(meta, node('strong', '', decision.statement));
      if (decision.evidence) entry.append(node('div', 'detail', decision.evidence));
      target.append(entry);
    });
  }

  function renderRisks(state) {
    const target = clear(byId('risk-list'));
    (state.risks || []).forEach(risk => {
      const entry = node('article', 'risk-entry');
      entry.append(node('span', `chip ${statusTone(risk.level)}`, humanize(risk.level)), node('strong', '', risk.label), node('div', 'detail', risk.mitigation));
      target.append(entry);
    });
  }

  function renderDeployment(state) {
    const deployment = state.deployment || {};
    const target = clear(byId('deployment-status'));
    target.append(
      summaryCard('Deployment status', humanize(deployment.status || 'unknown'), deployment.message || 'No deployment evidence recorded.', statusTone(deployment.status)),
      summaryCard('Expected Field Desk commit', shortSha(state.verified_against.field_desk_main_sha), 'Repository baseline used for this project-state record.'),
      summaryCard('God View route', deployment.god_view_url || 'Unknown', 'Must be verified after deployment.'),
      summaryCard('Calendar route', deployment.calendar_url || 'Unknown', 'Must be verified after deployment.')
    );
    const links = clear(byId('deployment-links'));
    appendLink(links, 'Open God View route', deployment.god_view_url);
    appendLink(links, 'Open Calendar route', deployment.calendar_url);
    appendLink(links, 'Open Field Desk route', deployment.field_desk_url);
  }

  function renderBookmarks(state) {
    const nav = clear(byId('canonical-bookmarks'));
    (state.bookmarks || []).forEach(bookmark => appendLink(nav, bookmark.label, bookmark.url));
  }

  function renderState(state) {
    const stale = isStale(state.verified_at_utc);
    renderHero(state, stale);
    renderSummary(state, stale);
    renderRoadmap(state);
    renderWorkstreams(state);
    renderDecisions(state);
    renderRisks(state);
    renderDeployment(state);
    renderBookmarks(state);
    byId('project-control-loading').hidden = true;
    byId('project-control-content').hidden = false;
    document.documentElement.dataset.projectState = stale ? 'stale' : 'current';
  }

  function renderFailure(error) {
    byId('project-control-loading').hidden = true;
    byId('project-control-content').hidden = false;
    const warning = byId('project-state-freshness');
    warning.hidden = false;
    warning.className = 'notice danger';
    warning.textContent = `Project state could not be loaded: ${error.message}. Treat all gate and roadmap status as unknown.`;
    ['current-objective', 'current-stage', 'current-gate-label', 'next-gate-label'].forEach(id => {
      const element = byId(id);
      if (element) element.textContent = 'Unknown — project-state load failed';
    });
    renderSummary({
      project: { health: 'blocked', current_objective: 'Re-establish project-state evidence', map_status: 'Unknown' },
      current_gate: { label: 'Unknown', decision_required: 'Do not act until project state is restored', status: 'blocked' },
      next_gate: { label: 'Unknown', decision_required: 'Unknown', status: 'blocked' },
      verified_at_utc: '',
      verified_against: {}
    }, true);
    document.documentElement.dataset.projectState = 'error';
  }

  async function load() {
    const response = await fetch(`${STATE_URL}?v=${encodeURIComponent(VERSION)}&cache=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  load().then(renderState).catch(renderFailure);

  window.NYCIF_GOD_VIEW_PROJECT_CONTROL_V01 = {
    VERSION,
    STATE_URL,
    STALE_AFTER_MS,
    isStale
  };
})();
