import { CONFIG } from '../config';
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.LEAGUE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function dateRange(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('Rango de fechas inválido.');
  const result: string[] = [];
  for (let date = new Date(`${start}T12:00:00Z`); date.toISOString().slice(0, 10) <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    result.push(date.toISOString().slice(0, 10));
    if (result.length > 3660) throw new Error('El rango supera diez años.');
  }
  return result;
}
