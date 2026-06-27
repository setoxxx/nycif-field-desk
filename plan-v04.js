(() => {
  const VERSION = 'v0.5';
  const KEY = 'nycif-plan-v04';
  const get = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch { return {}; }
  };
  const set = (x) => localStorage.setItem(KEY, JSON.stringify(x));
  const label = { go: 'Go', maybe: 'Maybe', done: 'Done' };
  const weight = { go: 0, maybe: 1, done: 2 };
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function idFor(card) {
    return card?.dataset?.id || card?.querySelector?.('[data-copy-id]')?.dataset?.copyId || '';
  }

  function titleFor(card) {
    return clean(card?.querySelector?.('strong,h2')?.textContent) || 'Untitled assignment';
  }

  function timeFor(card) {
    const text = clean(card?.textContent || '');
    const match = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)/i)
      || text.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i);
    return match ? match[0] : '';
  }

  function distanceFor(card) {
    const text = clean(card?.textContent || '');
    const match = text.match(/(nearby|\d+(?:\.\d+)?\s*mi)\b/i);
    if (!match) return { label: '', miles: 9999 };
    if (/nearby/i.test(match[1])) return { label: 'nearby', miles: 0 };
    return { label: match[1], miles: Number.parseFloat(match[1]) || 9999 };
  }

  function locationFor(card) {
    const small = clean(card?.querySelector?.('small')?.textContent || '');
    if (small) return small;
    const dd = [...(card?.querySelectorAll?.('dt') || [])].find(x => clean(x.textContent) === 'Location')?.parentElement?.querySelector('dd');
    return clean(dd?.textContent || '');
  }

  function store() { return get(); }

  function sortedRows() {
    return Object.entries(store())
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) =>
        (weight[a.value] ?? 9) - (weight[b.value] ?? 9)
        || (a.miles ?? 9999) - (b.miles ?? 9999)
        || String(a.time || '').localeCompare(String(b.time || ''))
        || String(a.title || '').localeCompare(String(b.title || ''))
      );
  }

  function saveMark(id, value, card) {
    if (!id) return;
    const data = store();
    if (data[id]?.value === value) delete data[id];
    else {
      const distance = distanceFor(card);
      data[id] = {
        value,
        title: titleFor(card),
        time: timeFor(card),
        distance: distance.label,
        miles: distance.miles,
        location: locationFor(card),
        updatedAt: new Date().toISOString()
      };
    }
    set(data);
    draw();
    const status = document.getElementById('status');
    if (status) status.textContent = data[id] ? `Marked ${label[value]} · ${VERSION}` : `Plan mark cleared · ${VERSION}`;
  }

  function planText() {
    const rows = sortedRows();
    if (!rows.length) return 'NYCIF FIELD ROUTE\nNo selected assignments yet.';
    return [
      'NYCIF FIELD ROUTE',
      `Generated: ${new Date().toLocaleString()}`,
      'Order: Go first, then Maybe, then Done; nearest items appear first when distance is available.',
      '',
      ...rows.map((r, i) => [
        `${i + 1}. ${label[r.value]} - ${r.title}`,
        r.time ? `Time: ${r.time}` : '',
        r.distance ? `Distance: ${r.distance}` : '',
        r.location ? `Location: ${r.location}` : ''
      ].filter(Boolean).join('\n'))
    ].join('\n\n');
  }

  async function copyPlan() {
    const txt = planText();
    try { await navigator.clipboard.writeText(txt); }
    catch { window.prompt('Copy route:', txt); }
    const status = document.getElementById('status');
    if (status) status.textContent = `Field route copied · ${VERSION}`;
  }

  function controls(id) {
    const active = store()[id]?.value || '';
    return `<div class="plan-v04" data-plan-id="${id}">
      <button type="button" data-plan-value="go" class="${active === 'go' ? 'active' : ''}">Go</button>
      <button type="button" data-plan-value="maybe" class="${active === 'maybe' ? 'active' : ''}">Maybe</button>
      <button type="button" data-plan-value="done" class="${active === 'done' ? 'active' : ''}">Done</button>
    </div>`;
  }

  function panel() {
    const rows = sortedRows();
    return `<section class="route-panel plan-panel-v04">
      <div><strong>My Route</strong><span>${rows.length} selected · ${VERSION}</span></div>
      <div class="route-actions"><button type="button" data-copy-plan-v04="1">Copy Ordered Route</button><button type="button" data-clear-plan-v05="1">Clear</button></div>
      ${rows.length ? `<ol>${rows.map(r => `<li><b>${label[r.value]}</b> ${r.distance ? `<em>${r.distance}</em> ` : ''}${r.title}</li>`).join('')}</ol>` : '<p>Mark items Go, Maybe, or Done. Use Near Me first for distance-aware ordering.</p>'}
    </section>`;
  }

  function draw() {
    document.querySelectorAll('.plan-v04,.plan-panel-v04').forEach(x => x.remove());
    const list = document.getElementById('eventList');
    if (list) list.insertAdjacentHTML('afterbegin', panel());
    document.querySelectorAll('.event-item,.popup-card').forEach(card => {
      const id = idFor(card);
      if (id) card.insertAdjacentHTML('beforeend', controls(id));
    });
    const brand = document.getElementById('brandCount');
    const count = sortedRows().length;
    if (brand && count && !brand.textContent.includes('route')) brand.textContent = `${brand.textContent} · ${count} route`;
  }

  document.addEventListener('click', e => {
    const button = e.target.closest('[data-plan-value]');
    if (button) {
      e.preventDefault();
      e.stopPropagation();
      const card = button.closest('.event-item,.popup-card');
      saveMark(idFor(card), button.dataset.planValue, card);
      return;
    }
    if (e.target.closest('[data-copy-plan-v04]')) {
      e.preventDefault();
      e.stopPropagation();
      copyPlan();
      return;
    }
    if (e.target.closest('[data-clear-plan-v05]')) {
      e.preventDefault();
      e.stopPropagation();
      set({});
      draw();
      const status = document.getElementById('status');
      if (status) status.textContent = `Route cleared · ${VERSION}`;
    }
  }, true);

  new MutationObserver(draw).observe(document.body, { childList: true, subtree: true });
  setTimeout(draw, 500);
  setTimeout(draw, 1500);
  setTimeout(draw, 3000);
})();
