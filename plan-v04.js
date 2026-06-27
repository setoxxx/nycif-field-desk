(() => {
  const KEY = 'nycif-plan-v04';
  const get = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch { return {}; }
  };
  const set = (x) => localStorage.setItem(KEY, JSON.stringify(x));
  const label = { go: 'Go', maybe: 'Maybe', done: 'Done' };
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function idFor(card) {
    return card?.dataset?.id || card?.querySelector?.('[data-copy-id]')?.dataset?.copyId || '';
  }

  function titleFor(card) {
    return clean(card?.querySelector?.('strong,h2')?.textContent) || 'Untitled assignment';
  }

  function store() { return get(); }

  function saveMark(id, value, card) {
    if (!id) return;
    const data = store();
    if (data[id]?.value === value) delete data[id];
    else data[id] = { value, title: titleFor(card), updatedAt: new Date().toISOString() };
    set(data);
    draw();
    const status = document.getElementById('status');
    if (status) status.textContent = data[id] ? `Marked ${label[value]} · v0.4` : 'Plan mark cleared · v0.4';
  }

  function planText() {
    const rows = Object.values(store());
    if (!rows.length) return 'NYCIF FIELD PLAN\nNo selected assignments yet.';
    return [
      'NYCIF FIELD PLAN',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      ...rows.map((r, i) => `${i + 1}. ${label[r.value]} - ${r.title}`)
    ].join('\n');
  }

  async function copyPlan() {
    const txt = planText();
    try { await navigator.clipboard.writeText(txt); }
    catch { window.prompt('Copy plan:', txt); }
    const status = document.getElementById('status');
    if (status) status.textContent = 'Field plan copied · v0.4';
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
    const rows = Object.values(store());
    return `<section class="route-panel plan-panel-v04">
      <div><strong>My Plan</strong><span>${rows.length} selected</span></div>
      <div class="route-actions"><button type="button" data-copy-plan-v04="1">Copy Plan</button></div>
      ${rows.length ? `<ol>${rows.map(r => `<li><b>${label[r.value]}</b> ${r.title}</li>`).join('')}</ol>` : '<p>Mark items Go, Maybe, or Done.</p>'}
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
    }
  }, true);

  new MutationObserver(draw).observe(document.body, { childList: true, subtree: true });
  setTimeout(draw, 800);
  setTimeout(draw, 1800);
})();

