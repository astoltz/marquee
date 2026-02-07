// Scheduler — evaluates schedule entries to determine active sequence
//
// Supports:
// - Time ranges: { start: "09:00", end: "17:00", sequence: "daytime" }
// - Minimal cron: { cron: "0 8 * * 1-5", sequence: "weekday" }
//   Format: minute hour dom month dow (* = any, ranges like 1-5)
// Checks every 60 seconds.

export class Scheduler {
  constructor(store, onActiveChange) {
    this.store = store;
    this.onActiveChange = onActiveChange;
    this._timer = null;
    this._lastActive = null;
  }

  start() {
    this._check();
    this._timer = setInterval(() => this._check(), 60000);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _check() {
    const schedule = this.store.getSchedule();
    if (!schedule || schedule.length === 0) return;

    const now = new Date();
    let matched = null;

    for (const entry of schedule) {
      if (entry.start && entry.end) {
        // Time range
        if (this._inTimeRange(now, entry.start, entry.end)) {
          matched = entry.sequence;
          break;
        }
      } else if (entry.cron) {
        // Cron expression
        if (this._matchesCron(now, entry.cron)) {
          matched = entry.sequence;
          break;
        }
      }
    }

    if (matched && matched !== this._lastActive) {
      this._lastActive = matched;
      this.store.setActiveSequence(matched);
      if (this.onActiveChange) {
        this.onActiveChange(matched, this.store.getSequence(matched));
      }
    }
  }

  _inTimeRange(now, start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    // Wraps midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  _matchesCron(now, cronStr) {
    const parts = cronStr.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const [minuteSpec, hourSpec, domSpec, monthSpec, dowSpec] = parts;
    const minute = now.getMinutes();
    const hour = now.getHours();
    const dom = now.getDate();
    const month = now.getMonth() + 1;
    const dow = now.getDay(); // 0 = Sunday

    return (
      this._cronFieldMatches(minuteSpec, minute) &&
      this._cronFieldMatches(hourSpec, hour) &&
      this._cronFieldMatches(domSpec, dom) &&
      this._cronFieldMatches(monthSpec, month) &&
      this._cronFieldMatches(dowSpec, dow)
    );
  }

  _cronFieldMatches(spec, value) {
    if (spec === '*') return true;

    // Handle comma-separated values
    const parts = spec.split(',');
    for (const part of parts) {
      // Handle ranges like 1-5
      if (part.includes('-')) {
        const [min, max] = part.split('-').map(Number);
        if (value >= min && value <= max) return true;
      } else {
        if (Number(part) === value) return true;
      }
    }
    return false;
  }
}
