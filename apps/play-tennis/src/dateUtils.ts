/**
 * Shared date/time formatting utilities for Rally.
 * All date/time display across the app should use these functions for consistency.
 *
 * Compact format (cards, badges): "Mon, Mar 16"
 * Full format (detail views): "Monday, March 16"
 * Time compact: "6pm" or "6:30pm"
 * Time full: "6:00 PM"
 * Slot inline: "Mon, Mar 16, 6:00 PM"
 * Range: "6:00 PM – 8:00 PM"
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon, Mar 16" — compact date for cards */
export function formatDateCompact(date: Date): string {
  return `${DAY_SHORT[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** "Monday, March 16" — full date for detail views */
export function formatDateFull(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

/** "6pm" or "6:30pm" — compact time for cards/badges */
export function formatHourCompact(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? 'pm' : 'am';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
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

/** "Mon, Mar 16 6:00pm–8:00pm" — proposal label */
export function formatProposalLabel(day: number, startHour: number, endHour: number): string {
  const now = new Date();
  const today = now.getDay();
  let diff = day - today;
  if (diff <= 0) diff += 7;
  const date = new Date(now);
  date.setDate(now.getDate() + diff);
  return `${formatDateCompact(date)} ${formatHourCompact(startHour)}–${formatHourCompact(endHour)}`;
}

/** Day name from index: 0=Sunday */
export function dayName(dayIndex: number): string {
  return DAY_NAMES[dayIndex];
}

/** Short day name from index: 0=Sun */
export function dayNameShort(dayIndex: number): string {
  return DAY_SHORT[dayIndex];
}
