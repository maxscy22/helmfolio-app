export const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export const priceMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const benchmarkPercent = (value: unknown) => `${Number(value ?? 0).toFixed(2)}%`;

export const dateMonthLabel = (date: string) => {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.slice(0, 7);
  return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const compactDateLabel = (date: string) => {
  const [datePart, timePart = ''] = String(date || '').split(';');
  const normalizedDate = /^\d{8}$/.test(datePart) ? `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}` : datePart.slice(0, 10);
  const normalizedTime = /^\d{6}$/.test(timePart) ? `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}` : '';
  const parsed = new Date(`${normalizedDate}T${normalizedTime || '00:00:00'}`);
  if (Number.isNaN(parsed.getTime())) return date ? String(date).slice(0, 16) : '-';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = parsed.toLocaleDateString('en-US', { month: 'short' });
  const dateLabel = `${day} ${month}, ${parsed.getFullYear()}`;
  const timeLabel = normalizedTime ? parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  return timeLabel ? `${dateLabel} ${timeLabel}` : dateLabel;
};

export const daysBetween = (start: string, end: string) => {
  const startDatePart = String(start || '').split(';')[0];
  const endDatePart = String(end || '').split(';')[0];
  const normalizedStartDate = /^\d{8}$/.test(startDatePart) ? `${startDatePart.slice(0, 4)}-${startDatePart.slice(4, 6)}-${startDatePart.slice(6, 8)}` : startDatePart.slice(0, 10);
  const normalizedEndDate = /^\d{8}$/.test(endDatePart) ? `${endDatePart.slice(0, 4)}-${endDatePart.slice(4, 6)}-${endDatePart.slice(6, 8)}` : endDatePart.slice(0, 10);
  const startDate = new Date(`${normalizedStartDate}T00:00:00`);
  const endDate = new Date(`${normalizedEndDate}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
};
