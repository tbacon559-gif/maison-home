// ─── Date helpers ─────────────────────────────────────────────────

export function calcAge(birthday, now = new Date()) {
  if (!birthday) return '';
  const birth = new Date(birthday + 'T00:00:00');
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years === 0) return `${months} mo`;
  if (years === 1 && months === 0) return '1 yr';
  if (months === 0) return `${years} yrs`;
  return `${years} yr${years > 1 ? 's' : ''} ${months} mo`;
}

export function nextBirthday(birthday, now = new Date()) {
  if (!birthday) return null;
  const birth = new Date(birthday + 'T00:00:00');
  let next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < now) {
    next = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  const days = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
  const turning = next.getFullYear() - birth.getFullYear();
  const dateStr = next.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return { dateStr, days, turning };
}

export function shortDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function todayLabel(now = new Date()) {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Returns 'Sun' .. 'Sat'
export function dayKey(d = new Date()) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

// "TODAY" / "TOMORROW" / "WED" / "MON 12" — for the events list
export function relativeLabel(eventDate, now = new Date()) {
  const d = new Date(eventDate);
  const diffDays = Math.floor(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
      new Date(now.getFullYear(), now.getMonth(), now.getDate())) /
      (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  if (diffDays < 0) return ''; // past — caller should filter
  if (diffDays < 7) {
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  }
  if (diffDays < 14) {
    return 'NEXT ' + ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  }
  // farther out — show month + day
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

export function timeLabel(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  // All-day events come in with hours = 0 and no time component — return ''
  const hours = d.getHours();
  const mins = d.getMinutes();
  if (hours === 0 && mins === 0 && date.toString().endsWith('T00:00:00')) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: mins ? '2-digit' : undefined }).toLowerCase();
}

// Determines the active zone for today (Mon=Kitchen, Tue=Bathrooms, etc.)
// Sat/Sun return null (free days).
export function todayZone(zoneOrder = [], now = new Date()) {
  const day = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  if (day === 0 || day === 6) return null;
  return zoneOrder[day - 1] || null;
}

export function tomorrowZone(zoneOrder = [], now = new Date()) {
  const day = (now.getDay() + 1) % 7;
  if (day === 0 || day === 6) return null;
  return zoneOrder[day - 1] || null;
}
