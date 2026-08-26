(() => {
  const key = 'nycif-field-desk-state-v06-safe';
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (!prefs || typeof prefs !== 'object') return;
    if (prefs.nycifDefaultVersion === 'staged-live-v04') return;
    if (prefs.dateMode === 'weekend') {
      prefs.dateMode = 'tonight';
      localStorage.setItem(key, JSON.stringify(prefs));
    } else if (prefs.dateMode === 'tomorrow') {
      prefs.dateMode = 'next7';
      localStorage.setItem(key, JSON.stringify(prefs));
    }
  } catch {}
})();
