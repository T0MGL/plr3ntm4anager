import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { enUS } from 'date-fns/locale/en-US';

type SupportedLocale = 'es' | 'en';

function resolveLocale(locale: SupportedLocale | string | undefined) {
  const normalized = (locale ?? 'es').toLowerCase().slice(0, 2);
  return normalized === 'en' ? enUS : es;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isSameYear(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear();
}

/**
 * Parse an ISO date string (YYYY-MM-DD) as a local-midnight Date. Using
 * parseISO keeps us off the native Date(string) constructor, which treats
 * YYYY-MM-DD as UTC and silently shifts the displayed day in timezones
 * west of UTC.
 */
function toLocalDate(iso: string): Date {
  return parseISO(iso);
}

/**
 * Format a stay range in a human form that mirrors how Park Lofts talks
 * to guests: "Del 23 al 26 de octubre de 2026".
 *
 * Rules:
 *   * Same month, same year -> "Del {d1} al {d2} de {month} de {year}"
 *   * Same year, different months -> "Del {d1} de {month1} al {d2} de {month2} de {year}"
 *   * Different years -> "Del {d1} de {month1} de {year1} al {d2} de {month2} de {year2}"
 *
 * The English variant uses "From ... to ..." with the same collapse rules.
 * Never returns a bare ISO string.
 */
export function formatDateRange(
  checkInIso: string | null | undefined,
  checkOutIso: string | null | undefined,
  locale: SupportedLocale | string = 'es'
): string {
  if (!checkInIso || !checkOutIso) return '';

  const start = toLocalDate(checkInIso);
  const end = toLocalDate(checkOutIso);
  const loc = resolveLocale(locale);
  const lang = (locale ?? 'es').toString().toLowerCase().slice(0, 2);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${checkInIso} - ${checkOutIso}`;
  }

  if (lang === 'en') {
    if (isSameMonth(start, end)) {
      return `${format(start, 'MMMM d', { locale: loc })} – ${format(end, 'd, yyyy', { locale: loc })}`;
    }
    if (isSameYear(start, end)) {
      return `${format(start, 'MMM d', { locale: loc })} – ${format(end, 'MMM d, yyyy', { locale: loc })}`;
    }
    return `${format(start, 'MMM d, yyyy', { locale: loc })} – ${format(end, 'MMM d, yyyy', { locale: loc })}`;
  }

  // Spanish
  if (isSameMonth(start, end)) {
    return `Del ${format(start, 'd', { locale: loc })} al ${format(end, "d 'de' MMMM 'de' yyyy", { locale: loc })}`;
  }
  if (isSameYear(start, end)) {
    return `Del ${format(start, "d 'de' MMMM", { locale: loc })} al ${format(end, "d 'de' MMMM 'de' yyyy", { locale: loc })}`;
  }
  return `Del ${format(start, "d 'de' MMMM 'de' yyyy", { locale: loc })} al ${format(end, "d 'de' MMMM 'de' yyyy", { locale: loc })}`;
}

/**
 * Short single-date formatter for card headers ("23 oct 2026").
 * Used where the range is already implicit but we want a compact stamp.
 */
export function formatShortDate(iso: string, locale: SupportedLocale | string = 'es'): string {
  if (!iso) return '';
  const d = toLocalDate(iso);
  const loc = resolveLocale(locale);
  const lang = (locale ?? 'es').toString().toLowerCase().slice(0, 2);
  if (Number.isNaN(d.getTime())) return iso;
  return lang === 'en'
    ? format(d, 'MMM d, yyyy', { locale: loc })
    : format(d, "d 'de' MMM yyyy", { locale: loc });
}

/**
 * Compute nights between two ISO dates (check-out exclusive). Returns 0
 * for bad input instead of NaN so the UI never renders "NaN nights".
 */
export function computeNights(checkInIso: string, checkOutIso: string): number {
  if (!checkInIso || !checkOutIso) return 0;
  const start = toLocalDate(checkInIso).getTime();
  const end = toLocalDate(checkOutIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}
