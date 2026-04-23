import { differenceInCalendarDays, isValid, parseISO, eachDayOfInterval, format } from 'date-fns';

// Park Lofts operates in Asuncion. All user-facing date bucketing (dashboard
// charts, "today" math, etc.) must be anchored to America/Asuncion, not UTC.
// The app previously used `new Date().toISOString().split('T')[0]` which
// resolves to the UTC date and silently drifts one calendar day after 21:00
// Asuncion time.
export const ASUNCION_TZ = 'America/Asuncion' as const;

// Intl with en-CA gives us YYYY-MM-DD directly, no locale-dependent parsing
// required. Formatter is created once.
const asuncionDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ASUNCION_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const asuncionYearMonthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ASUNCION_TZ,
  year: 'numeric',
  month: '2-digit'
});

/**
 * Today's calendar date in Asuncion, as YYYY-MM-DD.
 * Safe to compare lexicographically against ISO date strings.
 */
export function todayInAsuncion(): string {
  return asuncionDateFormatter.format(new Date());
}

/**
 * Same as todayInAsuncion but for an arbitrary instant. Useful to bucket
 * timestamptz values (payments.created_at) by the wall-clock day the operator
 * experienced them.
 */
export function asuncionDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return asuncionDateFormatter.format(d);
}

/**
 * YYYY-MM of the given instant in Asuncion. Used by dashboard-stats to bucket
 * payments per calendar month the operator lived, not the UTC month.
 */
export function asuncionYearMonth(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return asuncionYearMonthFormatter.format(d);
}

/**
 * Pure string math. Adds `days` to a YYYY-MM-DD string without going through
 * a Date object's timezone. Stays safe for string comparisons.
 */
export function addDaysStr(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const next = new Date(t);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function parseDate(value: string): Date {
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    throw new Error('Invalid date format');
  }
  return parsed;
}

export function validateDateRange(checkIn: string, checkOut: string): void {
  const start = parseDate(checkIn);
  const end = parseDate(checkOut);
  if (differenceInCalendarDays(end, start) <= 0) {
    throw new Error('Check-out must be after check-in');
  }
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = parseDate(checkIn);
  const end = parseDate(checkOut);
  return differenceInCalendarDays(end, start);
}

export function enumerateBlockedDates(checkIn: string, checkOut: string): string[] {
  const start = parseDate(checkIn);
  const end = parseDate(checkOut);
  const days = eachDayOfInterval({ start, end: new Date(end.getTime() - 24 * 60 * 60 * 1000) });
  return days.map((d) => format(d, 'yyyy-MM-dd'));
}
