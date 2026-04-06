/**
 * Shared date/time formatting utilities for Rally.
 * All date/time display across the app should use these functions for consistency.
 */

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon, Mar 16" — compact date for cards */
export function formatDateCompact(date: Date): string {
  return `${DAY_SHORT[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** "6pm" or "6:30pm" — compact time for cards/badges */
export function formatHourCompact(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  if (h === 0 || h === 24) return m > 0 ? `12:${String(m).padStart(2, '0')}am` : '12am';
  if (h === 12) return m > 0 ? `12:${String(m).padStart(2, '0')}pm` : '12pm';
  const period = h >= 12 ? 'pm' : 'am';
  const display = h > 12 ? h - 12 : h;
  return m > 0 ? `${display}:${String(m).padStart(2, '0')}${period}` : `${display}${period}`;
}

/** "6:00 PM" — full time format */
export function formatTimeFull(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

/** "Mon, Mar 16, 6:00 PM" — slot inline for card supporting text */
export function formatSlotInline(slot: { day: number; startHour: number }): string {
  const now = new Date();
  const today = now.getDay();
  let diff = slot.day - today;
  if (diff <= 0) diff += 7;
  const date = new Date(now);
  date.setDate(now.getDate() + diff);
  return `${formatDateCompact(date)}, ${formatTimeFull(slot.startHour)}`;
}

/** "6:00 PM – 8:00 PM" — time range for schedule panels */
export function formatTimeRange(startHour: number, endHour: number): string {
  return `${formatTimeFull(startHour)} – ${formatTimeFull(endHour)}`;
}

/** "marin county" → "Marin County" — title-case for display */
export function titleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
