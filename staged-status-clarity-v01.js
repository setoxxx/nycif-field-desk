(() => {
  const VERSION = 'staged-status-clarity-v01';
  const MANIFEST_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/staged_live_manifest.json';
  let stagedTotal = null;
  let suppress = false;

  const qs = selector => document.querySelector(selector);
  const statusEl = () => qs('#status');
  const listMetaEl = () => qs('#listMeta');

  function numberFromText(text) {
    const match = String(text || '').match(/^(\d+)/);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  function allChipIsActive() {
    const all = qs('[data-date-mode="all"]');
    return !!all && all.classList.contains('active');
  }

  function stagedIsActive() {
    const status = statusEl()?.textContent || '';
    const listMeta = listMetaEl()?.textContent || '';
    const button = qs('#loadStagedBtn');
    return /Staged deduped feed|Staged feed loaded/i.test(status)
      || /STAGED/i.test(listMeta)
      || /Staged feed loaded/i.test(button?.textContent || '');
  }

  function visibleCount() {
    const statusCount = numberFromText(statusEl()?.textContent || '');
    if (Number.isFinite(statusCount)) return statusCount;
    const listCount = numberFromText(listMetaEl()?.textContent || '');
    if (Number.isFinite(listCount)) return listCount;
    return null;
  }

  function categoryNote() {
    const parks = qs('[data-cat="parks"]');
    const general = qs('[data-cat="general"]');
    const notes = [];
    if (parks && !parks.checked) notes.push('Parks off');
    if (general && !general.checked) notes.push('General off');
    return notes.length ? ` · ${notes.join(' · ')}` : '';
  }

  function applyClarity() {
    if (suppress || !stagedIsActive() || !stagedTotal) return;
    const status = statusEl();
    const listMeta = listMetaEl();
    if (!status) return;
    const visible = visibleCount();
    const visibleText = Number.isFinite(visible) ? `${visible} visible` : 'visible rows filtered';
    const dateText = allChipIsActive() ? 'All dates' : 'Today/filter view';
    const nextStep = allChipIsActive() ? 'map cap active' : 'tap All for full staged feed';
    const clarity = `${visibleText} · ${stagedTotal} staged loaded · ${dateText} · ${nextStep}${categoryNote()} · ${VERSION}`;

    suppress = true;
    status.textContent = clarity;
    if (listMeta && !/staged loaded/i.test(listMeta.textContent || '')) {
      const base = listMeta.textContent || '';
      listMeta.textContent = `${base} · ${stagedTotal} staged loaded · ${nextStep}`;
    }
    window.setTimeout(() => { suppress = false; }, 120);
  }

  async function loadManifest() {
    try {
      const response = await fetch(`${MANIFEST_URL}?cache=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const manifest = await response.json();
      stagedTotal = Number.parseInt(manifest.staged_feed_events || manifest.eligible_rows_before_one_day_street_dedupe || 0, 10) || null;
      applyClarity();
    } catch {}
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#loadStagedBtn,[data-date-mode],[data-cat],#majorOnly,#photoOnly,#nypdOnly')) {
      window.setTimeout(applyClarity, 150);
      window.setTimeout(applyClarity, 700);
      window.setTimeout(applyClarity, 1600);
    }
  }, true);

  const observer = new MutationObserver(() => window.setTimeout(applyClarity, 80));
  window.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    loadManifest();
  });
  if (document.readyState !== 'loading') {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    loadManifest();
  }

  window.NYCIF_STAGED_STATUS_CLARITY = { version: VERSION, active: true };
})();
