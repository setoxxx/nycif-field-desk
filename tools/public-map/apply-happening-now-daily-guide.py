#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'app-schema-v1-major-all-v01.js'
INDEX = ROOT / 'index.html'
EDITORIAL = ROOT / 'news-desk-editors-picks-v01.js'
CSS = ROOT / 'public-map-v01.css'
SW = ROOT / 'service-worker.js'
EDITOR_TEST = ROOT / 'tools/public-map/editors-picks.test.mjs'
UI_TEST = ROOT / 'tools/public-map/public-map-ui.test.mjs'
MARKER = 'NYCIF_DAILY_GUIDE_V01'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)


def patch_app():
    text = APP.read_text()
    if MARKER in text:
        return

    text = replace_once(text,
        "    listMeta: document.getElementById('listMeta'),\n    eventList: document.getElementById('eventList'),",
        "    dailyGuideSummary: document.getElementById('dailyGuideSummary'),\n    listMeta: document.getElementById('listMeta'),\n    eventList: document.getElementById('eventList'),",
        'app daily summary element')

    old_matches = """  function eventMatches(e) {
    return sourceMatches(e)
      && dateMatches(e)
      && categoryFilterMatch(e)
      && medalMatch(e)
      && (state.borough === 'all' || e.borough === state.borough)
      && (!state.search || e.searchText.includes(state.search));
  }
"""
    new_matches = """  // NYCIF_DAILY_GUIDE_V01: map scope and editorial-list scope are deliberately separate.
  // Editorial tiers change list presentation only; they never make an otherwise valid map pin disappear.
  function baseEventMatches(e) {
    return sourceMatches(e)
      && dateMatches(e)
      && categoryFilterMatch(e)
      && (state.borough === 'all' || e.borough === state.borough)
      && (!state.search || e.searchText.includes(state.search));
  }

  function listEventMatches(e) {
    return baseEventMatches(e) && medalMatch(e);
  }

  function eventMatches(e) {
    return listEventMatches(e);
  }
"""
    text = replace_once(text, old_matches, new_matches, 'app map/list scope split')

    text = replace_once(text,
        "      && eventMatches(ev)\n      && coordKeyFor(ev.lat, ev.lng) === key);",
        "      && baseEventMatches(ev)\n      && coordKeyFor(ev.lat, ev.lng) === key);",
        'app stacked marker scope')

    old_candidates = """    const inView = bounds ? mapReady.filter(e => bounds.contains([e.lat, e.lng])) : mapReady;
    const eligibleInScope = inView.length ? inView : mapReady;
    // With clustering available, represent every eligible event in scope. The
    // legacy soft cap is retained only for the explicit no-cluster diagnostic
    // mode, where rendering thousands of independent DOM markers is unsafe.
    const candidates = useCluster
      ? eligibleInScope
      : eligibleInScope.slice(0, MARKER_SOFT_CAP);
"""
    new_candidates = """    const inView = bounds ? mapReady.filter(e => bounds.contains([e.lat, e.lng])) : mapReady;
    // With clustering available, represent EVERY map-eligible event in the selected
    // date/filter scope. Viewport limiting survives only in explicit no-cluster
    // diagnostic mode, where thousands of independent DOM markers are unsafe.
    const eligibleInScope = useCluster ? mapReady : (inView.length ? inView : mapReady);
    const candidates = useCluster
      ? eligibleInScope
      : eligibleInScope.slice(0, MARKER_SOFT_CAP);
"""
    text = replace_once(text, old_candidates, new_candidates, 'app all clustered markers')

    text = replace_once(text,
        "      group.sort((a, b) => b.priority - a.priority || String(a.title).localeCompare(String(b.title)));",
        "      group.sort((a, b) => Number(b.editorialScore || 0) - Number(a.editorialScore || 0)\n        || b.priority - a.priority || String(a.title).localeCompare(String(b.title)));",
        'app marker primary editorial priority')

    anchor = """  function buildListCard(e) {
"""
    helpers = r'''  const DAILY_GUIDE_BOROUGHS = [
    ['Manhattan', 'MANHATTAN'],
    ['Brooklyn', 'BROOKLYN'],
    ['Queens', 'QUEENS'],
    ['Bronx', 'THE BRONX'],
    ['Staten Island', 'STATEN ISLAND']
  ];
  const DAILY_GUIDE_TIERS = [
    ['gold', '🔴 PHOTO FIRST', 'Highest-priority newsworthy and photo assignments.'],
    ['silver', '🟠 STRONG ASSIGNMENTS', 'Strong community, cultural, civic, visual, or local-news assignments.'],
    ['bronze', '🟡 FEATURE OPTIONS', 'Good visual feature opportunities.'],
    ['', 'WHAT ELSE IS HAPPENING', 'Every remaining valid public event for this date.']
  ];

  function fullDateLabel(key) {
    if (!SCHEMA.validCalendarDate(key)) return key;
    const d = new Date(`${key}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York'
    }).format(d);
  }

  function exactEventMoment(value) {
    const raw = String(value || '').trim();
    if (!raw || !meaningfulTime(raw)) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }

  function eventTemporalStatus(e) {
    if (selectedDateKey() !== todayKey()) return '';
    const now = Date.now();
    const start = exactEventMoment(e.start_date_time);
    const end = exactEventMoment(e.end_date_time);
    if (end != null && end < now) return 'ENDED';
    if (start != null && end != null && start <= now && now <= end) return 'HAPPENING NOW';
    if (start != null && start > now) {
      return ((start - now) / 60000) <= 90 ? 'STARTING SOON' : 'LATER TODAY';
    }
    return '';
  }

  function temporalRank(e) {
    const status = eventTemporalStatus(e);
    if (status === 'HAPPENING NOW') return 0;
    if (status === 'ENDED') return 2;
    return 1;
  }

  function dailyGuideSort(a, b) {
    if (state.sort === 'near') {
      const da = milesBetween(state.userLocation, a) ?? 999999;
      const db = milesBetween(state.userLocation, b) ?? 999999;
      return da - db || eventSortTime(a) - eventSortTime(b) || String(a.title).localeCompare(String(b.title));
    }
    if (state.sort === 'time') {
      return eventSortTime(a) - eventSortTime(b) || String(a.title).localeCompare(String(b.title));
    }
    if (state.sort === 'type') {
      return String(a.nycif?.event_type || 'zz').localeCompare(String(b.nycif?.event_type || 'zz'))
        || eventSortTime(a) - eventSortTime(b) || String(a.title).localeCompare(String(b.title));
    }
    return temporalRank(a) - temporalRank(b)
      || Number(b.editorialScore || 0) - Number(a.editorialScore || 0)
      || eventSortTime(a) - eventSortTime(b)
      || String(a.title).localeCompare(String(b.title));
  }

  function topPickCounts(events) {
    return {
      gold: events.filter(e => e.medal === 'gold').length,
      silver: events.filter(e => e.medal === 'silver').length,
      bronze: events.filter(e => e.medal === 'bronze').length
    };
  }

  function renderDailyGuideSummary(events) {
    if (!els.dailyGuideSummary) return;
    clearChildren(els.dailyGuideSummary);
    const key = selectedDateKey();
    const title = key === todayKey() ? `TODAY — ${fullDateLabel(key).toUpperCase()}` : fullDateLabel(key).toUpperCase();
    appendText(els.dailyGuideSummary, 'h2', title, 'daily-guide-date');
    const scope = state.borough === 'all' ? 'around NYC' : `in ${state.borough}`;
    appendText(els.dailyGuideSummary, 'p', `${events.length.toLocaleString()} event${events.length === 1 ? '' : 's'} happening ${scope}`, 'daily-guide-total');
    appendText(els.dailyGuideSummary, 'h3', 'NYCIF TOP PICKS', 'daily-guide-picks-title');
    const counts = topPickCounts(events);
    const grid = document.createElement('div');
    grid.className = 'daily-guide-picks';
    appendText(grid, 'span', `🔴 ${counts.gold.toLocaleString()} Photo First`, 'daily-guide-pick daily-guide-pick--gold');
    appendText(grid, 'span', `🟠 ${counts.silver.toLocaleString()} Strong Assignments`, 'daily-guide-pick daily-guide-pick--silver');
    appendText(grid, 'span', `🟡 ${counts.bronze.toLocaleString()} Feature Options`, 'daily-guide-pick daily-guide-pick--bronze');
    els.dailyGuideSummary.appendChild(grid);
    if (!state.indexComplete) {
      appendText(els.dailyGuideSummary, 'p', 'Finding more events — counts update as the complete day index loads.', 'daily-guide-loading');
    }
  }

  function boroughGuideKey(e) {
    const exact = DAILY_GUIDE_BOROUGHS.find(([key]) => key === e.borough);
    return exact ? exact[0] : '__other__';
  }

  function renderDailyGuide(events, shownLimit) {
    let remaining = shownLimit;
    const boroughRows = [...DAILY_GUIDE_BOROUGHS];
    if (events.some(e => boroughGuideKey(e) === '__other__')) {
      boroughRows.push(['__other__', 'CITYWIDE / BOROUGH NOT LISTED']);
    }
    for (const [boroughKey, boroughLabel] of boroughRows) {
      const boroughEvents = events.filter(e => boroughGuideKey(e) === boroughKey);
      if (!boroughEvents.length || remaining <= 0) continue;
      const section = document.createElement('section');
      section.className = 'daily-guide-borough';
      appendText(section, 'h2', boroughLabel, 'daily-guide-borough-title');
      let sectionCards = 0;
      for (const [tier, heading, description] of DAILY_GUIDE_TIERS) {
        const tierEvents = boroughEvents.filter(e => (e.medal || '') === tier).sort(dailyGuideSort);
        if (!tierEvents.length || remaining <= 0) continue;
        const tierSection = document.createElement('section');
        tierSection.className = `daily-guide-tier daily-guide-tier--${tier || 'else'}`;
        appendText(tierSection, 'h3', heading, 'daily-guide-tier-title');
        appendText(tierSection, 'p', description, 'daily-guide-tier-dek');
        const take = tierEvents.slice(0, remaining);
        take.forEach(e => tierSection.appendChild(buildListCard(e)));
        remaining -= take.length;
        sectionCards += take.length;
        section.appendChild(tierSection);
      }
      if (sectionCards) els.eventList.appendChild(section);
    }
  }

'''
    text = replace_once(text, anchor, helpers + anchor, 'app guide helper insertion')

    old_past = """    if (e.isPast) {
      appendText(tags, 'span', '✓ Ended', 'item-tag ended');
    }
"""
    new_past = """    const temporalStatus = eventTemporalStatus(e);
    if (temporalStatus) {
      const statusClass = temporalStatus.toLowerCase().replace(/\s+/g, '-');
      appendText(tags, 'span', temporalStatus, `item-tag temporal temporal-${statusClass}`);
    }
"""
    text = replace_once(text, old_past, new_past, 'app temporal card badge')

    old_render = r'''  function render() {
    const t0 = performance.now();
    updateIndexLabel();
    updateCategoryAvailability();
    const visible = state.events.filter(eventMatches).sort(sortEvents);
    const drawn = renderMarkers(visible);
    renderApproximateMarkers();
    const shown = Math.min(state.listShown, visible.length);
    const mapEligibleCount = visible.filter(e => markerEligible(e)).length;
    const dateLabel = friendlyDateLabel(selectedDateKey());
    let meta = `${visible.length.toLocaleString()} event${visible.length === 1 ? '' : 's'} ${dateLabel === 'today' || dateLabel === 'tomorrow' ? dateLabel : `on ${dateLabel}`}`;
    if (state.markerEvents < mapEligibleCount) {
      meta += ' · move or zoom the map to see more pins';
    }
    els.listMeta.textContent = meta;
    clearChildren(els.eventList);
    if (!visible.length) {
      appendText(els.eventList, 'div', emptyStateMessage(), 'empty');
    } else {
      visible.slice(0, shown).forEach(e => els.eventList.appendChild(buildListCard(e)));
    }
    if (els.loadMoreBtn) {
      els.loadMoreBtn.hidden = shown >= visible.length;
      els.loadMoreBtn.textContent = `Show 100 more (${Math.max(0, visible.length - shown).toLocaleString()} remaining)`;
    }
    if (els.brandCount) {
      els.brandCount.textContent = `${visible.length.toLocaleString()} event${visible.length === 1 ? '' : 's'} · ${dateLabel}`;
    }
    if (state.feedPhase === 'error' && !state.events.length) {
      status('Events are temporarily unavailable. Open Filters and choose Retry Events.');
    } else if (state.feedPhase === 'error') {
      status('Events could not be refreshed. Showing the most recent available information.');
    } else {
      status(`${visible.length.toLocaleString()} event${visible.length === 1 ? '' : 's'} · ${dateLabel}`);
    }
    state.timings.listRenderMs = Math.round(performance.now() - t0);
    if (debug && els.debugPanel) {
      els.debugPanel.hidden = false;
      els.debugPanel.textContent = JSON.stringify({
        version: VERSION,
        total: state.events.length,
        filtered: visible.length,
        markers: drawn.length,
        markerEvents: state.markerEvents,
        mapEligibleVisible: mapEligibleCount,
        markerParityComplete: state.markerEvents >= mapEligibleCount,
        peakMarkerObjects: state.peakMarkerObjects,
        indexComplete: state.indexComplete,
        pagesLoaded: state.pagesLoaded,
        pagesTotal: state.pagesTotal,
        cluster: useCluster,
        feedPhase: state.feedPhase,
        feedSource: state.feedSource,
        timings: state.timings,
        errors: state.errors.slice(-8)
      }, null, 2);
    }
    return visible;
  }
'''
    new_render = r'''  function render() {
    const t0 = performance.now();
    updateIndexLabel();
    updateCategoryAvailability();
    const mapScope = state.events.filter(baseEventMatches);
    const listScope = mapScope.filter(medalMatch);
    const drawn = renderMarkers(mapScope);
    renderApproximateMarkers();
    const shown = Math.min(state.listShown, listScope.length);
    const mapEligibleCount = mapScope.filter(e => markerEligible(e)).length;
    const dateLabel = friendlyDateLabel(selectedDateKey());
    renderDailyGuideSummary(mapScope);
    let meta = `${listScope.length.toLocaleString()} shown in the editorial guide`;
    if (listScope.length !== mapScope.length) {
      meta += ` · ${mapScope.length.toLocaleString()} total events remain on the map`;
    }
    if (!useCluster && state.markerEvents < mapEligibleCount) {
      meta += ' · move or zoom the map to see more pins';
    }
    els.listMeta.textContent = meta;
    clearChildren(els.eventList);
    if (!listScope.length) {
      appendText(els.eventList, 'div', emptyStateMessage(), 'empty');
    } else {
      renderDailyGuide(listScope, shown);
    }
    if (els.loadMoreBtn) {
      els.loadMoreBtn.hidden = shown >= listScope.length;
      els.loadMoreBtn.textContent = `Show 100 more (${Math.max(0, listScope.length - shown).toLocaleString()} remaining)`;
    }
    if (els.brandCount) {
      els.brandCount.textContent = `${mapScope.length.toLocaleString()} event${mapScope.length === 1 ? '' : 's'} · ${dateLabel}`;
    }
    if (state.feedPhase === 'error' && !state.events.length) {
      status('Events are temporarily unavailable. Open Filters and choose Retry Events.');
    } else if (state.feedPhase === 'error') {
      status('Events could not be refreshed. Showing the most recent available information.');
    } else {
      status(`${mapScope.length.toLocaleString()} event${mapScope.length === 1 ? '' : 's'} · ${dateLabel}`);
    }
    state.timings.listRenderMs = Math.round(performance.now() - t0);
    if (debug && els.debugPanel) {
      els.debugPanel.hidden = false;
      els.debugPanel.textContent = JSON.stringify({
        version: VERSION,
        total: state.events.length,
        mapScope: mapScope.length,
        listScope: listScope.length,
        topPicks: topPickCounts(mapScope),
        markers: drawn.length,
        markerEvents: state.markerEvents,
        mapEligibleVisible: mapEligibleCount,
        markerParityComplete: useCluster ? state.markerEvents === mapEligibleCount : state.markerEvents >= Math.min(mapEligibleCount, MARKER_SOFT_CAP),
        peakMarkerObjects: state.peakMarkerObjects,
        indexComplete: state.indexComplete,
        pagesLoaded: state.pagesLoaded,
        pagesTotal: state.pagesTotal,
        cluster: useCluster,
        feedPhase: state.feedPhase,
        feedSource: state.feedSource,
        timings: state.timings,
        errors: state.errors.slice(-8)
      }, null, 2);
    }
    return mapScope;
  }
'''
    text = replace_once(text, old_render, new_render, 'app daily guide render')

    text = replace_once(text,
        "    state.borough = value;\n    setActiveBoroughButton(button);",
        "    state.borough = value;\n    state.listShown = LIST_PAGE;\n    setActiveBoroughButton(button);",
        'app borough pagination reset')

    text = text.replace("visible: state.events.filter(eventMatches).length,", "visible: state.events.filter(listEventMatches).length,\n        mapScopeVisible: state.events.filter(baseEventMatches).length,")
    text = text.replace("mapEligibleVisible: state.events.filter(e => eventMatches(e) && markerEligible(e)).length,", "mapEligibleVisible: state.events.filter(e => baseEventMatches(e) && markerEligible(e)).length,")
    text = text.replace("visibleIds: state.events.filter(eventMatches).map(e => e.id).sort(),", "visibleIds: state.events.filter(listEventMatches).map(e => e.id).sort(),")
    text = text.replace("mapEligibleVisibleIds: state.events.filter(e => eventMatches(e) && markerEligible(e)).map(e => e.id).sort()", "mapEligibleVisibleIds: state.events.filter(e => baseEventMatches(e) && markerEligible(e)).map(e => e.id).sort()")
    text = text.replace("markerParityComplete: state.markerEvents >= state.events.filter(e => eventMatches(e) && markerEligible(e)).length,", "markerParityComplete: useCluster && state.markerEvents === state.events.filter(e => baseEventMatches(e) && markerEligible(e)).length,")

    APP.write_text(text)


def patch_editorial():
    text = EDITORIAL.read_text()
    old = """  const MEDAL_META = {
    gold: { emoji: '🥇', label: 'Gold' },
    silver: { emoji: '🥈', label: 'Silver' },
    bronze: { emoji: '🥉', label: 'Bronze' }
  };
"""
    new = """  // Internal medal keys stay stable; public labels use NYCIF assignment language.
  const MEDAL_META = {
    gold: { emoji: '🔴', label: 'Photo First' },
    silver: { emoji: '🟠', label: 'Strong Assignment' },
    bronze: { emoji: '🟡', label: 'Feature Option' }
  };
"""
    if old in text:
        text = text.replace(old, new, 1)
    elif 'Photo First' not in text:
        raise SystemExit('editorial medal metadata anchor missing')
    EDITORIAL.write_text(text)


def patch_index():
    text = INDEX.read_text()
    text = text.replace('<span>🏅 Editor\'s Picks</span>', '<span>NYCIF Top Picks</span>')
    text = text.replace('aria-label="Editor\'s Picks medal filter"', 'aria-label="NYCIF Top Picks filter"')
    text = text.replace('<option value="medaled">Medals only 🥇🥈🥉</option>', '<option value="medaled">Top Picks only</option>')
    text = text.replace('<option value="gold">Gold only 🥇</option>', '<option value="gold">Photo First only</option>')
    text = text.replace('<h1>Event Map</h1>', '<h1>Happening Now</h1>')
    summary_anchor = """        <label class="search">
"""
    if 'id="dailyGuideSummary"' not in text:
        text = replace_once(text, summary_anchor,
            """        <section id="dailyGuideSummary" class="daily-guide-summary" aria-label="Daily event guide summary"></section>\n\n""" + summary_anchor,
            'index daily summary')
    text = text.replace('<option value="priority">Highlights</option>', '<option value="priority">Editorial guide</option>')
    # Bump explicit asset tokens for changed public files.
    text = text.replace('./public-map-v01.css?v=public-map-v10', './public-map-v01.css?v=public-map-v13')
    text = text.replace('./news-desk-editors-picks-v01.js?v=public-map-v10', './news-desk-editors-picks-v01.js?v=public-map-v13')
    text = text.replace('./app-schema-v1-major-all-v01.js?v=public-map-v10', './app-schema-v1-major-all-v01.js?v=public-map-v13')
    INDEX.write_text(text)


def patch_css():
    text = CSS.read_text()
    if 'NYCIF daily editorial guide v01' not in text:
        text += r'''

/* NYCIF daily editorial guide v01 */
body.public-map-page .daily-guide-summary {
  margin: 0 0 12px;
  padding: 12px;
  border: 1px solid rgba(17, 24, 39, .10);
  border-radius: 14px;
  background: rgba(255, 255, 255, .82);
}
body.public-map-page .daily-guide-date { margin: 0; font-size: 15px; line-height: 1.2; letter-spacing: -.01em; }
body.public-map-page .daily-guide-total { margin: 4px 0 10px; color: #4b5563; font-size: 12px; }
body.public-map-page .daily-guide-picks-title { margin: 0 0 6px; font-size: 11px; letter-spacing: .08em; }
body.public-map-page .daily-guide-picks { display: grid; gap: 4px; }
body.public-map-page .daily-guide-pick { font-size: 12px; font-weight: 800; }
body.public-map-page .daily-guide-loading { margin: 8px 0 0; color: #6b7280; font-size: 10px; }
body.public-map-page .daily-guide-borough { margin: 16px 0 22px; }
body.public-map-page .daily-guide-borough-title { margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid #111827; font-size: 15px; letter-spacing: .08em; }
body.public-map-page .daily-guide-tier { margin: 0 0 14px; }
body.public-map-page .daily-guide-tier-title { margin: 0; font-size: 12px; letter-spacing: .04em; }
body.public-map-page .daily-guide-tier-dek { margin: 3px 0 7px; color: #6b7280; font-size: 10px; line-height: 1.35; }
body.public-map-page .item-tag.temporal-happening-now { background: #111827; color: #fff; }
body.public-map-page .item-tag.temporal-starting-soon { background: #fee2e2; color: #991b1b; }
body.public-map-page .item-tag.temporal-later-today { background: #eef2ff; color: #3730a3; }
body.public-map-page .item-tag.temporal-ended { background: #e5e7eb; color: #6b7280; }
body.public-map-page .marker--medal-gold { box-shadow: 0 0 0 4px rgba(220, 38, 38, .32), 0 6px 14px rgba(0,0,0,.28); transform: scale(1.12); }
body.public-map-page .marker--medal-silver { box-shadow: 0 0 0 3px rgba(234, 88, 12, .26), 0 6px 14px rgba(0,0,0,.24); transform: scale(1.07); }
body.public-map-page .marker--medal-bronze { box-shadow: 0 0 0 2px rgba(202, 138, 4, .22), 0 5px 12px rgba(0,0,0,.22); transform: scale(1.03); }
@media (max-width: 700px) {
  body.public-map-page .daily-guide-summary { position: sticky; top: 0; z-index: 2; padding: 10px; backdrop-filter: blur(14px); }
  body.public-map-page .daily-guide-date { font-size: 13px; }
  body.public-map-page .daily-guide-total,
  body.public-map-page .daily-guide-pick { font-size: 11px; }
  body.public-map-page .daily-guide-borough { margin-top: 14px; }
}
'''
    CSS.write_text(text)


def patch_sw():
    text = SW.read_text().replace("const CACHE_NAME = 'nycif-rc-public-map-v12';", "const CACHE_NAME = 'nycif-rc-public-map-v13-daily-guide';")
    SW.write_text(text)


def patch_tests():
    text = EDITOR_TEST.read_text()
    if "public tier labels map medals" not in text:
        text += r'''

test('public tier labels map medals to NYCIF assignment language', () => {
  assert.deepEqual(ED.MEDAL_META.gold, { emoji: '🔴', label: 'Photo First' });
  assert.deepEqual(ED.MEDAL_META.silver, { emoji: '🟠', label: 'Strong Assignment' });
  assert.deepEqual(ED.MEDAL_META.bronze, { emoji: '🟡', label: 'Feature Option' });
  assert.match(indexHtml, /Show all events/);
  assert.match(indexHtml, /Top Picks only/);
  assert.match(indexHtml, /Photo First only/);
});
'''
    EDITOR_TEST.write_text(text)

    text = UI_TEST.read_text()
    if "daily guide keeps complete map scope" not in text:
        text += r'''

test('daily guide keeps complete map scope separate from editorial list filtering', () => {
  assert.match(indexHtml, /id="dailyGuideSummary"/);
  assert.match(indexHtml, /Happening Now/);
  assert.match(appJs, /function baseEventMatches/);
  assert.match(appJs, /function listEventMatches/);
  assert.match(appJs, /const mapScope = state\.events\.filter\(baseEventMatches\)/);
  assert.match(appJs, /const listScope = mapScope\.filter\(medalMatch\)/);
  assert.match(appJs, /renderMarkers\(mapScope\)/);
  assert.match(appJs, /renderDailyGuideSummary\(mapScope\)/);
  assert.match(appJs, /renderDailyGuide\(listScope, shown\)/);
  assert.match(appJs, /useCluster \? mapReady/);
});

test('daily guide is date then borough then editorial tier and preserves all-events default', () => {
  assert.match(appJs, /DAILY_GUIDE_BOROUGHS/);
  assert.match(appJs, /MANHATTAN/);
  assert.match(appJs, /BROOKLYN/);
  assert.match(appJs, /QUEENS/);
  assert.match(appJs, /THE BRONX/);
  assert.match(appJs, /STATEN ISLAND/);
  assert.match(appJs, /PHOTO FIRST/);
  assert.match(appJs, /STRONG ASSIGNMENTS/);
  assert.match(appJs, /FEATURE OPTIONS/);
  assert.match(appJs, /WHAT ELSE IS HAPPENING/);
  assert.match(appJs, /dateMode: 'today'/);
  assert.match(appJs, /medalFilter: 'all'/);
  assert.match(appJs, /categories: Object\.fromEntries\(ALL_CATEGORY_KEYS\.map\(k => \[k, true\]\)\)/);
});

test('top picks and temporal states are derived from complete scoped data before card pagination', () => {
  assert.match(appJs, /function topPickCounts/);
  assert.match(appJs, /function eventTemporalStatus/);
  assert.match(appJs, /HAPPENING NOW/);
  assert.match(appJs, /STARTING SOON/);
  assert.match(appJs, /LATER TODAY/);
  assert.match(appJs, /ENDED/);
  const summaryAt = appJs.indexOf('renderDailyGuideSummary(mapScope)');
  const shownAt = appJs.indexOf('const shown = Math.min(state.listShown, listScope.length)');
  assert.ok(summaryAt > shownAt, 'summary is fed the complete mapScope, not a sliced card page');
});
'''
    UI_TEST.write_text(text)


def main():
    patch_app()
    patch_editorial()
    patch_index()
    patch_css()
    patch_sw()
    patch_tests()
    print('Happening Now daily guide patch applied or already present')

if __name__ == '__main__':
    main()
