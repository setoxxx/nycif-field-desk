(() => {
  const addCalendarLink = () => {
    const nav = document.querySelector('.topbar .links');
    if (!nav || nav.querySelector('[data-calendar-blotter-link]')) return;
    const link = document.createElement('a');
    link.href = './calendar.html';
    link.textContent = '📅 Calendar Blotter';
    link.dataset.calendarBlotterLink = 'true';
    link.style.color = '#fde68a';
    link.style.borderColor = 'rgba(251,191,36,.55)';
    link.style.background = 'rgba(251,191,36,.10)';
    nav.prepend(link);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addCalendarLink);
  else addCalendarLink();

  const original = document.createElement('script');
  original.src = 'https://cdn.jsdelivr.net/gh/setoxxx/nycif-field-desk@9111fa460025146b8c2f880477f838c5fbb90dd0/admin/live-pipeline-panel-v01.js';
  original.async = false;
  original.onerror = () => {
    const status = document.getElementById('live-pipeline-status');
    if (status) status.textContent = 'Live pipeline panel could not load. Calendar Blotter remains available.';
  };
  document.head.append(original);
})();