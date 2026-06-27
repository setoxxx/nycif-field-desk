(() => {
  const VERSION = 'v0.6.1-weekstrip-fix';

  function isExactDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
  }

  function setStatus(message) {
    const status = document.getElementById('status');
    if (status) status.textContent = `${message} · ${VERSION}`;
  }

  function fullFeedLoaded() {
    const load = document.getElementById('loadAllBtn');
    const txt = [load?.textContent || '', document.getElementById('status')?.textContent || '', document.getElementById('listMeta')?.textContent || ''].join(' ');
    return /all events loaded|full feed|full event database|full feed already loaded/i.test(txt);
  }

  function loadFullFeedForDate(mode) {
    if (!isExactDate(mode) && mode !== 'all') return;
    const load = document.getElementById('loadAllBtn');
    if (!load || load.disabled || fullFeedLoaded()) return;
    setStatus('Loading full feed for selected date');
    load.click();
  }

  function enableDrag(track) {
    if (!track || track.dataset.dragReady === '1') return;
    track.dataset.dragReady = '1';
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    track.addEventListener('pointerdown', ev => {
      dragging = true;
      moved = false;
      startX = ev.clientX;
      startScroll = track.scrollLeft;
      track.classList.add('is-dragging');
      track.setPointerCapture?.(ev.pointerId);
    });

    track.addEventListener('pointermove', ev => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startScroll - dx;
    });

    function end(ev) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      try { track.releasePointerCapture?.(ev.pointerId); } catch {}
      setTimeout(() => { moved = false; }, 80);
    }

    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('mouseleave', end);

    track.addEventListener('click', ev => {
      if (moved) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
  }

  function patch() {
    const track = document.querySelector('.date-chip-track');
    enableDrag(track);
  }

  document.addEventListener('click', ev => {
    const button = ev.target.closest('[data-date-mode]');
    if (!button) return;
    const mode = button.dataset.dateMode;
    setTimeout(() => loadFullFeedForDate(mode), 120);
    setTimeout(() => patch(), 160);
  }, true);

  new MutationObserver(patch).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', patch);
  setTimeout(patch, 500);
  setTimeout(patch, 1500);
})();
