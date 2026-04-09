import { differenceInCalendarDays, isValid, parseISO, eachDayOfInterval, format } from 'date-fns';

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
