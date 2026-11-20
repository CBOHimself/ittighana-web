const TZ = 'Africa/Accra';

export const fmtDate = (d: string | Date, opts: Intl.DateTimeFormatOptions = { dateStyle: 'long' }) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(new Date(d));

export const fmtTime = (d: string | Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(d));

export const fmtMoney = (amount: number, currency = 'GHS') =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

export const fmtRange = (start: string, end: string, allDay?: boolean) => {
  if (allDay) {
    const s = fmtDate(start);
    const e = fmtDate(end);
    return s === e ? s : `${s} – ${e}`;
  }
  const sameDay = fmtDate(start) === fmtDate(end);
  return sameDay
    ? `${fmtDate(start)}, ${fmtTime(start)} – ${fmtTime(end)}`
    : `${fmtDate(start)} ${fmtTime(start)} – ${fmtDate(end)} ${fmtTime(end)}`;
};
