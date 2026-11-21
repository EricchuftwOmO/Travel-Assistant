const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 'YYYY-MM-DD' -> 'Jan 28, 2027' without time-zone shifts.
export const formatDate = (iso, { year = true } = {}) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${year ? `, ${y}` : ''}`;
};

export const formatRange = (start, end) => {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDate(start, { year: !sameYear })} – ${formatDate(end)}`;
};

export const dayCount = (start, end) => (Date.parse(end) - Date.parse(start)) / 86400000 + 1;

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// A local airport time from Google Flights, '2027-01-28 10:15' -> 'Jan 28, 10:15' (no time-zone shift).
export const formatLocalTime = (local) => {
  const [date, time] = local.split(' ');
  return `${formatDate(date, { year: false })}, ${time}`;
};

export const formatMoney = (amount, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

export const addDays = (iso, days) => {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Duration between two ISO timestamps, e.g. '11h 50m'.
export const duration = (from, to) => {
  const minutes = Math.round((Date.parse(to) - Date.parse(from)) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
