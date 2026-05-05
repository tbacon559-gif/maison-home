// ─── Minimal ICS parser ───────────────────────────────────────────
// Extracts upcoming events from an iCal feed.
// We only need: title (SUMMARY), start (DTSTART), and "all-day or not" detection.
// Recurrence rules (RRULE) get expanded into individual occurrences for the next ~90 days.

function unfoldLines(text) {
  // ICS folds long lines: continuation lines start with a space or tab.
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function parseICSDate(value) {
  // Possible formats:
  //   20260510            (date only, all-day)
  //   20260510T090000Z    (UTC)
  //   20260510T090000     (floating local)
  //   TZID=America/...:20260510T090000  — we ignore TZID and treat as local
  if (/^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4);
    const m = +value.slice(4, 6) - 1;
    const d = +value.slice(6, 8);
    const date = new Date(y, m, d);
    return { date, allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const [, y, mo, d, hh, mm, ss, z] = m;
    const date = z
      ? new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss))
      : new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
    return { date, allDay: false };
  }
  return null;
}

function unescape(text) {
  return String(text)
    .replace(/\\n/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseEvents(icsText) {
  const text = unfoldLines(icsText);
  const lines = text.split(/\r?\n/);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      // Property line: PROPNAME[;PARAMS]:VALUE
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const left = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const semi = left.indexOf(';');
      const prop = semi === -1 ? left : left.slice(0, semi);

      if (prop === 'SUMMARY') current.summary = unescape(value);
      else if (prop === 'DTSTART') {
        const parsed = parseICSDate(value);
        if (parsed) {
          current.start = parsed.date;
          current.allDay = parsed.allDay;
        }
      } else if (prop === 'DTEND') {
        const parsed = parseICSDate(value);
        if (parsed) current.end = parsed.date;
      } else if (prop === 'RRULE') current.rrule = value;
      else if (prop === 'UID') current.uid = value;
      else if (prop === 'STATUS') current.status = value;
    }
  }
  return events;
}

// Very light recurrence expansion: handles FREQ=DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL.
// Generates occurrences in [from, to]. Skips anything more complex (BYDAY etc fall back to base event).
function expandRecurring(event, from, to) {
  if (!event.rrule || !event.start) return [event];

  const rules = {};
  for (const part of event.rrule.split(';')) {
    const [k, v] = part.split('=');
    rules[k] = v;
  }

  const freq = rules.FREQ;
  const interval = parseInt(rules.INTERVAL || '1', 10);
  const count = rules.COUNT ? parseInt(rules.COUNT, 10) : null;
  const until = rules.UNTIL ? parseICSDate(rules.UNTIL)?.date : null;

  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) {
    return [event];
  }

  const occurrences = [];
  let current = new Date(event.start);
  let n = 0;
  const cap = 200; // safety
  while (current <= to && n < cap) {
    if (count !== null && n >= count) break;
    if (until && current > until) break;
    if (current >= from) {
      occurrences.push({ ...event, start: new Date(current) });
    }
    n++;
    if (freq === 'DAILY') current.setDate(current.getDate() + interval);
    else if (freq === 'WEEKLY') current.setDate(current.getDate() + 7 * interval);
    else if (freq === 'MONTHLY') current.setMonth(current.getMonth() + interval);
    else if (freq === 'YEARLY') current.setFullYear(current.getFullYear() + interval);
  }
  return occurrences;
}

// Returns up to `limit` upcoming events sorted by start date.
export function upcomingEvents(icsText, { limit = 5, daysAhead = 90 } = {}) {
  if (!icsText) return [];
  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);

  const raw = parseEvents(icsText);
  const expanded = [];

  for (const ev of raw) {
    if (!ev.start || ev.status === 'CANCELLED') continue;
    if (ev.rrule) {
      expanded.push(...expandRecurring(ev, now, horizon));
    } else if (ev.start >= now || (ev.allDay && isToday(ev.start))) {
      if (ev.start <= horizon) expanded.push(ev);
    }
  }

  expanded.sort((a, b) => a.start - b.start);
  return expanded.slice(0, limit).map((ev) => ({
    title: ev.summary || '(untitled)',
    start: ev.start,
    allDay: !!ev.allDay,
  }));
}

function isToday(d) {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
