/** Datas como strings ISO "YYYY-MM-DD", sem depender de fuso horário. */

const pad = (n: number): string => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function isValidYMD(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}

export function ymdToISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function splitISO(iso: string): { y: number; m: number; d: number } {
  const [y = 0, m = 0, d = 0] = iso.split('-').map(Number);
  return { y, m, d };
}

export function addDays(iso: string, delta: number): string {
  const { y, m, d } = splitISO(iso);
  return toISODate(new Date(y, m - 1, d + delta));
}

/** Primeiro dia do mês de `iso`, deslocado em `delta` meses. */
export function shiftMonth(iso: string, delta: number): string {
  const { y, m } = splitISO(iso);
  return toISODate(new Date(y, m - 1 + delta, 1));
}

export function monthBounds(iso: string): { from: string; to: string } {
  const { y, m } = splitISO(iso);
  return { from: ymdToISO(y, m, 1), to: ymdToISO(y, m, new Date(y, m, 0).getDate()) };
}

export function formatDateBR(iso: string): string {
  const { y, m, d } = splitISO(iso);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export function formatMonthYearBR(iso: string): string {
  const { y, m } = splitISO(iso);
  const names = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${names[m - 1] ?? ''} de ${y}`;
}
