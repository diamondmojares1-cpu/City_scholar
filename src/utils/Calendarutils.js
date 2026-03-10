// src/utils/calendarUtils.js

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function getCalendarCells(year, month) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = [];

  for (let i = 0; i < firstDay; i++)
    cells.push({ day: null, isCurrentMonth: false });

  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, isCurrentMonth: true });

  while (cells.length % 7 !== 0)
    cells.push({ day: null, isCurrentMonth: false });

  return cells;
}

export function isToday(day, month, year) {
  const now = new Date();
  return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
}

export function navigateMonth(current, direction) {
  let { year, month } = current;
  month += direction;
  if (month < 0)  { month = 11; year -= 1; }
  if (month > 11) { month = 0;  year += 1; }
  return { year, month };
}

export function formatMonthLabel(year, month) {
  return `${MONTH_NAMES[month]} ${year}`;
}

/**
 * Convert a Unix ms timestamp to "YYYY-MM-DD" key
 */
export function toDateKey(ms) {
  if (!ms) return "";
  const d  = new Date(Number(ms));
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Build a map of  "YYYY-MM-DD" → [announcement, ...]
 * from the array fetched from Firestore calendar_notes
 */
export function buildEventMap(announcements = []) {
  const map = {};
  for (const ann of announcements) {
    const key = toDateKey(ann.date);
    if (!key) continue;
    if (!map[key]) map[key] = [];
    map[key].push(ann);
  }
  return map;
}