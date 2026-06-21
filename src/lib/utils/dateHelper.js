/**
 * Calculates the ISO week number and year for a given date.
 * 
 * @param {Date} date 
 * @returns {{year: number, week: number}}
 */
export function getISOWeekAndYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Sunday = 7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return {
    year: d.getUTCFullYear(),
    week: weekNo
  };
}

/**
 * Returns the week folder name (e.g., "2026w25") for a given date.
 * 
 * @param {Date} date 
 * @returns {string}
 */
export function getWeekFolderName(date) {
  const { year, week } = getISOWeekAndYear(date);
  return `${year}w${String(week).padStart(2, '0')}`;
}

/**
 * Returns the daily log filename (e.g., "20260621_log.md") for a given date.
 * 
 * @param {Date} date 
 * @returns {string}
 */
export function getDailyLogFileName(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_log.md`;
}
