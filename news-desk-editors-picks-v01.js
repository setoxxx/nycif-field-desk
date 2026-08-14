/**
 * NYCIF Editor's Picks + News Desk engine (public).
 *
 * Pure, testable helpers used by app-schema-v1-major-all-v01.js to:
 *  - score every event editorially (size + crowd + past-presence + photogenic)
 *  - assign an Olympic-medal TIER (gold/silver/bronze) by score threshold, so
 *    counts float with the data — a day/category can have 10 golds or 0 golds
 *  - identify "News Desk" events (money shots + viral magnets) and the
 *    returning-likely set used for the past-presence signal
 *
 * Medals are thresholds, not fixed ranks. No coordinates are invented here;
 * News Desk rows are only certified when they carry a valid NYC map_ready pin.
 */
(() => {
  'use strict';

  // Tunable editorial weights + medal thresholds. Documented so the ranking is
  // auditable rather than magic.
  //
  // Editor's Picks are a CURATED set, so being "major" alone does not earn a
  // medal — in the feed every major event carries the same flat major_score,
  // which would gild ~900 events and defeat curation. Medals are driven by the
  // signals that actually differentiate a standout: proven past presence
  // (returning_likely), money-day priority, expected crowd, and photogenic.
  // The major flag is only a small tiebreaker that can never medal on its own.
  const WEIGHTS = {
    isMajor: 60,    // small nudge; cannot reach a medal alone
    crowd: 1,       // per point of expected_crowd_score (bigger crowd = better)
    photo: 120,     // photogenic / photo_pick
    returning: 200, // proven past presence (returning_likely from viral memory)
    moneyCap: 250,  // money-day assignment_score contribution, capped
    marquee: 200    // marquee type (FIFA / World Cup / festival / parade / feast)
  };
  // Pyramid: gold needs past presence PLUS another standout (money/crowd/photo/
  // major), so returning-alone lands at silver and gold stays the true cream.
  const THRESHOLDS = { gold: 350, silver: 180, bronze: 80 };

  // NYC metro bounding box — the single geometric gate (matches the backend
  // pin-integrity envelope). Anything outside can never be a News Desk pin.
  const NYC = { minLat: 40.4774, maxLat: 40.9176, minLng: -74.2591, maxLng: -73.7004 };

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // Editorial score from the signals that actually differentiate a standout.
  // Deliberately does NOT add the flat major_score (see WEIGHTS note above).
  function editorialScore(sig) {
    const s = sig || {};
    let score = 0;
    if (s.isMajor) score += WEIGHTS.isMajor;
    score += num(s.crowdScore) * WEIGHTS.crowd;
    if (s.photoPick) score += WEIGHTS.photo;
    if (s.returning) score += WEIGHTS.returning;
    if (s.marquee) score += WEIGHTS.marquee;
    score += Math.min(num(s.moneyScore), WEIGHTS.moneyCap);
    return score;
  }

  // Marquee event types a photographer wants on the News Desk even without
  // money/viral history: FIFA / World Cup, festivals, parades, feasts, fairs.
  const MARQUEE_RE = /\bfifa\b|world cup|\bfeast\b|festival|\bparade\b|carnival|giglio|street fair|san gennaro|fan (?:fest|zone)|marathon/i;
  function isMarquee(text) {
    return MARQUEE_RE.test(String(text || ''));
  }

  function medalOf(score) {
    if (score >= THRESHOLDS.gold) return 'gold';
    if (score >= THRESHOLDS.silver) return 'silver';
    if (score >= THRESHOLDS.bronze) return 'bronze';
    return '';
  }

  // Internal medal keys stay stable; public labels use NYCIF assignment language.
  const MEDAL_META = {
    gold: { emoji: '🔴', label: 'Photo First' },
    silver: { emoji: '🟠', label: 'Strong Assignment' },
    bronze: { emoji: '🟡', label: 'Feature Option' }
  };

  // Stable join key across the discovery feed and the operator lanes.
  function sourceKey(row) {
    const src = (row && row.source) || {};
    const dataset = src.dataset != null ? String(src.dataset) : '';
    const sid = src.source_event_id != null ? String(src.source_event_id)
      : (row && row.event_id != null ? String(row.event_id) : '');
    return dataset && sid ? `${dataset}:${sid}` : '';
  }

  function certifiedNycCoord(lat, lng) {
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    if (Math.abs(la) < 1e-9 && Math.abs(ln) < 1e-9) return null; // Null Island
    if (la >= NYC.minLat && la <= NYC.maxLat && ln >= NYC.minLng && ln <= NYC.maxLng) {
      return { lat: la, lng: ln };
    }
    return null; // ocean / out-of-box / swap all rejected (no auto-correct)
  }

  // Returning-likely source keys from the viral recurrence matches (current
  // side only — never the prior-year row).
  function extractReturningKeys(viralData) {
    const keys = new Set();
    const matches = (viralData && Array.isArray(viralData.matches)) ? viralData.matches : [];
    matches.forEach(m => {
      if (m && m.current && m.recurrence_label === 'returning_likely') {
        const k = sourceKey(m.current);
        if (k) keys.add(k);
      }
    });
    return keys;
  }

  // Certified money-day + viral pins as light supplemental events (used only
  // when the row is not already present in the discovery feed window).
  function extractNewsDeskRows(moneyData, viralData) {
    const out = [];
    const money = (moneyData && Array.isArray(moneyData.events)) ? moneyData.events : [];
    money.forEach(r => {
      const row = normalizeNewsDeskRow(r, 'money');
      if (row) out.push(row);
    });
    const matches = (viralData && Array.isArray(viralData.matches)) ? viralData.matches : [];
    matches.forEach(m => {
      if (m && m.current && m.recurrence_label === 'returning_likely') {
        const row = normalizeNewsDeskRow({ ...m.current, recurrence_label: m.recurrence_label }, 'viral');
        if (row) out.push(row);
      }
    });
    return out;
  }

  // Certify + normalize an operator row into a minimal shape the app can
  // upsert. Returns null unless it is a certified NYC map_ready pin.
  function normalizeNewsDeskRow(row, kind) {
    if (!row || row.certified_pin !== true || row.coordinate_status !== 'map_ready') return null;
    const coord = certifiedNycCoord(row.latitude, row.longitude);
    if (!coord) return null;
    return {
      key: sourceKey(row),
      id: row.id || row.event_id || `${kind}:${sourceKey(row)}`,
      title: row.title || 'Untitled',
      date: row.date || String(row.start_date_time || '').slice(0, 10) || '',
      start_date_time: row.start_date_time || '',
      end_date_time: row.end_date_time || '',
      borough: row.borough || '',
      location: row.display_location || row.location || '',
      lat: coord.lat,
      lng: coord.lng,
      category: row.category || '',
      source: row.source || {},
      kind, // 'money' | 'viral'
      returning: kind === 'viral' || row.recurrence_label === 'returning_likely',
      majorScore: num(row.assignment_score || row.match_score)
    };
  }

  window.NYCIF_EDITORIAL = {
    WEIGHTS,
    THRESHOLDS,
    MEDAL_META,
    editorialScore,
    medalOf,
    isMarquee,
    sourceKey,
    certifiedNycCoord,
    extractReturningKeys,
    extractNewsDeskRows,
    normalizeNewsDeskRow
  };
})();
