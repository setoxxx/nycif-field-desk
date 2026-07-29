(() => {
  'use strict';

  if (window.NYCIF_NYC_CALENDAR_RUNTIME) return;

  const NativeDate = window.Date;
  const TIME_ZONE = 'America/New_York';
  const nycInstances = new WeakSet();

  function parts(target) {
    const values = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(target);
    return Object.fromEntries(values.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  }

  class NYCDateValue extends NativeDate {
    constructor(...args) {
      super(...args);
      if (args.length === 0 || (args.length === 1 && nycInstances.has(args[0]))) {
        nycInstances.add(this);
      }
    }

    getFullYear() {
      return nycInstances.has(this) ? Number(parts(this).year) : super.getFullYear();
    }

    getMonth() {
      return nycInstances.has(this) ? Number(parts(this).month) - 1 : super.getMonth();
    }

    getDate() {
      return nycInstances.has(this) ? Number(parts(this).day) : super.getDate();
    }

    getDay() {
      if (!nycInstances.has(this)) return super.getDay();
      const p = parts(this);
      return new NativeDate(NativeDate.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 12)).getUTCDay();
    }

    getHours() {
      return nycInstances.has(this) ? Number(parts(this).hour) : super.getHours();
    }

    getMinutes() {
      return nycInstances.has(this) ? Number(parts(this).minute) : super.getMinutes();
    }

    getSeconds() {
      return nycInstances.has(this) ? Number(parts(this).second) : super.getSeconds();
    }

    setDate(value) {
      if (!nycInstances.has(this)) return super.setDate(value);
      const p = parts(this);
      const shifted = new NativeDate(NativeDate.UTC(Number(p.year), Number(p.month) - 1, Number(value), 12));
      return super.setTime(shifted.getTime());
    }
  }

  const NYCDate = new Proxy(NYCDateValue, {
    apply() {
      return NativeDate();
    }
  });

  window.Date = NYCDate;
  window.NYCIF_NYC_CALENDAR_RUNTIME = Object.freeze({
    version: 'nyc-calendar-runtime-v01',
    timeZone: TIME_ZONE,
    nativeDate: NativeDate,
    dateKey(value = new NYCDate()) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
  });
})();
