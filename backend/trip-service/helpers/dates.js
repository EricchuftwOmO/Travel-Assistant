const DAY_MS = 24 * 60 * 60 * 1000;

// Number of calendar days from startDate to endDate, counting both ends.
// Both are 'YYYY-MM-DD' strings, which Date.parse reads as UTC midnight.
const countDays = (startDate, endDate) =>
  (Date.parse(endDate) - Date.parse(startDate)) / DAY_MS + 1;

module.exports = { countDays };
