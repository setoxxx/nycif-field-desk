(() => {
  const KEYS = ['nycif-field-desk-state-v06-safe', 'nycif-field-desk-state-v03'];
  for (const key of KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const prefs = JSON.parse(raw);
      if (!prefs || typeof prefs !== 'object') continue;
      if (prefs.dateMode === 'all' || prefs.dateMode === 'weekend' || prefs.dateMode === 'tomorrow') {
        prefs.dateMode = 'today';
        localStorage.setItem(key, JSON.stringify(prefs));
      }
    } catch {}
  }
})();
