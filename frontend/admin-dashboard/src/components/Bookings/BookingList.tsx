import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { api } from '../../utils/api';
import ApprovalButtons from './ApprovalButtons';
import BookingDetails from './BookingDetails';
import BookingNotes from './BookingNotes';
import { supabase } from '../../context/AuthContext';
import ExportMenu from '../common/ExportMenu';

type ApprovalPath = 'auto' | 'manual';

interface BookingRow {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  total_price_usd: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | string;
  special_requests?: string | null;
  created_at?: string;
  rejection_reason?: string | null;
  units?: { name: string } | null;
  approval_path?: ApprovalPath | null;
  approval_decision_reason?: string | null;
  sync_age_minutes_at_decision?: number | null;
}

interface BookingResponse {
  data: BookingRow[];
  count: number;
}

interface CalendarBookingRow {
  id: string;
  unit_id: string;
  guest_name: string;
  guest_email: string;
  check_in_date: string;
  check_out_date: string;
  status: 'pending' | 'approved' | 'paid' | string;
  approval_path: ApprovalPath | null;
  total_price_usd: number;
  units?: { name: string } | null;
}

interface CalendarBlockRow {
  unit_id: string;
  blocked_date: string;
  source: 'airbnb' | 'manual' | 'widget' | string;
  units?: { name: string } | null;
}

interface CalendarResponse {
  range: { from: string; to: string };
  bookings: CalendarBookingRow[];
  blocks: CalendarBlockRow[];
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: { kind: 'booking' | 'block'; status?: string; source?: string };
}

type Tab = 'needs_review' | 'all';

const UNIT_PALETTE: Array<{ bg: string; text: string; border: string }> = [
  { bg: '#dbeafe', text: '#1e3a8a', border: '#60a5fa' },
  { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
  { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f472b6' },
  { bg: '#cffafe', text: '#155e75', border: '#22d3ee' },
  { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
  { bg: '#fae8ff', text: '#86198f', border: '#e879f9' },
];

function unitColorIndex(unitId: string): number {
  let hash = 0;
  for (let i = 0; i < unitId.length; i++) {
    hash = ((hash << 5) - hash + unitId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % UNIT_PALETTE.length;
}

function unitPalette(unitId: string) {
  return UNIT_PALETTE[unitColorIndex(unitId)];
}

function statusChipClass(status: string): string {
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'approved') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'checked_in') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (status === 'checked_out') return 'bg-slate-100 text-slate-600 border-slate-300';
  if (status === 'cancelled') return 'bg-slate-50 text-slate-400 border-slate-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function approvalPathBadge(
  path: ApprovalPath | null | undefined,
  autoLabel: string,
  manualLabel: string,
): { label: string; className: string } | null {
  if (path === 'auto') {
    return { label: autoLabel, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (path === 'manual') {
    return { label: manualLabel, className: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return null;
}

function isAutoApproved(booking: BookingRow): boolean {
  return booking.approval_path === 'auto' && (booking.status === 'paid' || booking.status === 'approved');
}

export default function BookingList() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingBookingId, setActingBookingId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [unitFilter, setUnitFilter] = useState<string>('');

  const [rejectModalBookingId, setRejectModalBookingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [clickedBlock, setClickedBlock] = useState<{
    title: string;
    source: string;
    start: string;
    end: string;
  } | null>(null);

  const fetchBookings = async () => {
    const { data } = await api.get<BookingResponse>('/admin/booking-requests', {
      params: status ? { status } : {},
    });
    setBookings(data.data ?? []);
  };

  const fetchCalendar = async () => {
    const { data } = await api.get<CalendarResponse>('/admin/calendar');
    setCalendarData(data);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await fetchBookings();
        setError(null);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load bookings';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [status]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsCalendarLoading(true);
        await fetchCalendar();
        setError(null);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load calendar';
        setError(message);
      } finally {
        setIsCalendarLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, () => {
        void fetchBookings();
        void fetchCalendar();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, () => {
        void fetchCalendar();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [status]);

  const approve = async (bookingId: string) => {
    try {
      setActingBookingId(bookingId);
      await api.post(`/admin/booking-requests/${bookingId}/approve`);
      await fetchBookings();
      setError(null);
    } catch (approveError) {
      const message =
        approveError && typeof approveError === 'object' && 'response' in approveError
          ? (approveError as { response?: { data?: { error?: string } } }).response?.data?.error ??
            'Failed to approve booking'
          : approveError instanceof Error
            ? approveError.message
            : 'Failed to approve booking';
      setError(message);
    } finally {
      setActingBookingId(null);
    }
  };

  const openRejectModal = (bookingId: string) => {
    setRejectModalBookingId(bookingId);
    setRejectionReason('');
  };

  const closeRejectModal = () => {
    setRejectModalBookingId(null);
    setRejectionReason('');
  };

  const confirmReject = async () => {
    if (!rejectModalBookingId) return;
    const reason = rejectionReason.trim();
    if (reason.length < 2) {
      setError(t('bookingList.rejectionMinLength'));
      return;
    }

    try {
      setActingBookingId(rejectModalBookingId);
      await api.post(`/admin/booking-requests/${rejectModalBookingId}/reject`, {
        rejection_reason: reason,
      });
      await fetchBookings();
      closeRejectModal();
      setError(null);
    } catch (rejectError) {
      const message = rejectError instanceof Error ? rejectError.message : 'Failed to reject booking';
      setError(message);
    } finally {
      setActingBookingId(null);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      setActingBookingId(bookingId);
      await api.post(`/admin/booking-requests/${bookingId}/cancel`);
      await fetchBookings();
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel booking';
      setError(msg);
    } finally {
      setActingBookingId(null);
    }
  };

  const checkIn = async (bookingId: string) => {
    try {
      setActingBookingId(bookingId);
      await api.post(`/admin/booking-requests/${bookingId}/check-in`);
      await fetchBookings();
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check in';
      setError(msg);
    } finally {
      setActingBookingId(null);
    }
  };

  const checkOut = async (bookingId: string) => {
    try {
      setActingBookingId(bookingId);
      await api.post(`/admin/booking-requests/${bookingId}/check-out`);
      await fetchBookings();
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check out';
      setError(msg);
    } finally {
      setActingBookingId(null);
    }
  };

  const summary = useMemo(() => {
    return bookings.reduce(
      (acc, booking) => {
        acc.total += 1;
        if (booking.status === 'pending') acc.pending += 1;
        if (booking.status === 'approved') acc.approved += 1;
        if (booking.status === 'paid') acc.paid += 1;
        if (booking.status === 'rejected') acc.rejected += 1;
        if (booking.status === 'pending' && booking.approval_path === 'manual') acc.needsReview += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, paid: 0, rejected: 0, needsReview: 0 },
    );
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return bookings;

    return bookings.filter((booking) => {
      const unit = booking.units?.name?.toLowerCase() ?? '';
      const ref = booking.id.slice(0, 8).toLowerCase();
      return (
        booking.guest_name.toLowerCase().includes(term) ||
        booking.guest_email.toLowerCase().includes(term) ||
        unit.includes(term) ||
        ref.includes(term) ||
        booking.id.toLowerCase().includes(term)
      );
    });
  }, [bookings, search]);

  const unitNames = useMemo(() => {
    const names = new Set<string>();
    bookings.forEach((b) => {
      if (b.units?.name) names.add(b.units.name);
    });
    calendarData?.bookings.forEach((b) => {
      if (b.units?.name) names.add(b.units.name);
    });
    calendarData?.blocks.forEach((b) => {
      if (b.units?.name) names.add(b.units.name);
    });
    return Array.from(names).sort();
  }, [bookings, calendarData]);

  const displayBookings = useMemo(() => {
    let rows = filteredBookings;
    if (unitFilter) rows = rows.filter((b) => b.units?.name === unitFilter);
    if (tab === 'needs_review') {
      rows = rows.filter((b) => b.status === 'pending' && b.approval_path === 'manual');
    }
    return rows;
  }, [filteredBookings, unitFilter, tab]);

  type ExternalStay = {
    kind: 'airbnb' | 'manual';
    id: string;
    unitId: string;
    unitName: string;
    checkIn: string;
    checkOut: string;
  };

  // Collapse per-night availability rows into contiguous stays so each Airbnb or
  // manual reservation renders as a single list card, mirroring the calendar
  // grouping logic.
  const externalStays = useMemo<ExternalStay[]>(() => {
    if (!calendarData) return [];
    const dayMs = 1000 * 60 * 60 * 24;
    const grouped = new Map<string, CalendarBlockRow[]>();
    for (const block of calendarData.blocks) {
      const key = `${block.unit_id}::${block.source}`;
      const list = grouped.get(key) ?? [];
      list.push(block);
      grouped.set(key, list);
    }

    const stays: ExternalStay[] = [];
    for (const [key, rows] of grouped) {
      rows.sort((a, b) => a.blocked_date.localeCompare(b.blocked_date));
      const [unitId, source] = key.split('::');
      if (source !== 'airbnb' && source !== 'manual') continue;
      const unitName = rows[0]?.units?.name ?? 'Unit';

      const push = (startDate: string, endDate: string) => {
        const checkOut = new Date(new Date(endDate).getTime() + dayMs).toISOString().slice(0, 10);
        stays.push({
          kind: source,
          id: `${source}-${unitId}-${startDate}`,
          unitId,
          unitName,
          checkIn: startDate,
          checkOut,
        });
      };

      let rangeStart = rows[0]?.blocked_date ?? null;
      let rangeEnd = rangeStart;
      for (let i = 1; i < rows.length; i++) {
        const prev = new Date(rows[i - 1].blocked_date).getTime();
        const curr = new Date(rows[i].blocked_date).getTime();
        if (curr - prev === dayMs) {
          rangeEnd = rows[i].blocked_date;
        } else if (rangeStart && rangeEnd) {
          push(rangeStart, rangeEnd);
          rangeStart = rows[i].blocked_date;
          rangeEnd = rangeStart;
        }
      }
      if (rangeStart && rangeEnd) push(rangeStart, rangeEnd);
    }

    return stays;
  }, [calendarData]);

  type ListCard =
    | { kind: 'widget'; id: string; sortKey: string; booking: BookingRow }
    | { kind: 'airbnb'; id: string; sortKey: string; stay: ExternalStay }
    | { kind: 'manual'; id: string; sortKey: string; stay: ExternalStay };

  // Unified list for the list view. Widget bookings keep their full card; Airbnb
  // and manual holds render simpler cards with a source badge so the admin sees
  // occupancy from every source in one place, not just from the widget.
  const listCards = useMemo<ListCard[]>(() => {
    const cards: ListCard[] = displayBookings.map((booking) => ({
      kind: 'widget',
      id: booking.id,
      sortKey: booking.check_in_date,
      booking,
    }));

    // Widget filters (status, tab=needs_review, search beyond unit name) do not
    // apply to external sources, so hide them whenever those are active.
    const widgetOnlyFilterActive =
      tab === 'needs_review' || status !== '' || search.trim() !== '';

    if (!widgetOnlyFilterActive) {
      for (const stay of externalStays) {
        if (unitFilter && stay.unitName !== unitFilter) continue;
        cards.push({
          kind: stay.kind,
          id: stay.id,
          sortKey: stay.checkIn,
          stay,
        });
      }
    }

    cards.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return cards;
  }, [displayBookings, externalStays, tab, status, search, unitFilter]);

  const calendarEvents = useMemo(() => {
    if (!calendarData) return [] as CalendarEvent[];

    const statusColors: Record<string, string> = {
      pending: '#f59e0b',
      approved: '#3b82f6',
      paid: '#10b981',
    };

    const events: CalendarEvent[] = [];

    for (const b of calendarData.bookings) {
      if (unitFilter && b.units?.name !== unitFilter) continue;
      if (status && b.status !== status) continue;
      if (tab === 'needs_review' && !(b.status === 'pending' && b.approval_path === 'manual')) continue;
      const statusBg = statusColors[b.status] ?? '#64748b';
      const unitBorder = unitPalette(b.unit_id).border;
      events.push({
        id: `booking-${b.id}`,
        title: `${b.guest_name} · ${b.units?.name ?? 'Unit'} (${b.id.slice(0, 8).toUpperCase()})`,
        start: b.check_in_date,
        end: b.check_out_date,
        backgroundColor: statusBg,
        borderColor: unitBorder,
        textColor: '#fff',
        extendedProps: { kind: 'booking', status: b.status },
      });
    }

    // Collapse consecutive per-day blocks into contiguous ranges so FullCalendar
    // renders one bar per stay instead of a strip of single-day chips. Groups
    // by unit_id + source, then walks sorted dates merging gaps of one day.
    const grouped = new Map<string, CalendarBlockRow[]>();
    for (const block of calendarData.blocks) {
      if (unitFilter && block.units?.name !== unitFilter) continue;
      const key = `${block.unit_id}::${block.source}`;
      const list = grouped.get(key) ?? [];
      list.push(block);
      grouped.set(key, list);
    }

    const dayMs = 1000 * 60 * 60 * 24;

    for (const [key, rows] of grouped) {
      rows.sort((a, b) => a.blocked_date.localeCompare(b.blocked_date));
      const [unitIdPart, source] = key.split('::');
      const palette = unitPalette(unitIdPart);
      const unitName = rows[0]?.units?.name ?? 'Unit';
      const sourceLabel = source === 'airbnb' ? 'Airbnb' : 'Hold';

      const pushRange = (startDate: string, endDate: string) => {
        const endExclusive = new Date(new Date(endDate).getTime() + dayMs)
          .toISOString()
          .slice(0, 10);
        events.push({
          id: `block-${source}-${unitName}-${startDate}`,
          title: `${sourceLabel} · ${unitName}`,
          start: startDate,
          end: endExclusive,
          backgroundColor: palette.bg,
          borderColor: source === 'manual' ? palette.text : palette.border,
          textColor: palette.text,
          extendedProps: { kind: 'block', source },
        });
      };

      let rangeStart = rows[0]?.blocked_date ?? null;
      let rangeEnd = rangeStart;

      for (let i = 1; i < rows.length; i++) {
        const prev = new Date(rows[i - 1].blocked_date).getTime();
        const curr = new Date(rows[i].blocked_date).getTime();
        if (curr - prev === dayMs) {
          rangeEnd = rows[i].blocked_date;
        } else if (rangeStart && rangeEnd) {
          pushRange(rangeStart, rangeEnd);
          rangeStart = rows[i].blocked_date;
          rangeEnd = rangeStart;
        }
      }

      if (rangeStart && rangeEnd) pushRange(rangeStart, rangeEnd);
    }

    return events;
  }, [calendarData, unitFilter, status, tab]);

  const calendarCounts = useMemo(() => {
    if (!calendarData) return { bookings: 0, airbnbBlocks: 0, manualBlocks: 0 };
    const filterUnit = (row: { units?: { name: string } | null }) =>
      unitFilter ? row.units?.name === unitFilter : true;
    return {
      bookings: calendarData.bookings.filter(filterUnit).length,
      airbnbBlocks: calendarData.blocks.filter((b) => b.source === 'airbnb' && filterUnit(b)).length,
      manualBlocks: calendarData.blocks.filter((b) => b.source === 'manual' && filterUnit(b)).length,
    };
  }, [calendarData, unitFilter]);

  const visibleUnits = useMemo(() => {
    if (!calendarData) return [] as Array<{ id: string; name: string }>;
    const map = new Map<string, string>();
    const pass = (row: { unit_id: string; units?: { name: string } | null }) => {
      if (!row.unit_id) return;
      if (unitFilter && row.units?.name !== unitFilter) return;
      if (!map.has(row.unit_id)) map.set(row.unit_id, row.units?.name ?? 'Unit');
    };
    calendarData.bookings.forEach(pass);
    calendarData.blocks.forEach(pass);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [calendarData, unitFilter]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'needs_review'
                ? 'bg-slate-900 text-white'
                : 'bg-transparent text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setTab('needs_review')}
          >
            {t('bookingList.needsReview')}
            {summary.needsReview > 0 ? (
              <span
                className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  tab === 'needs_review' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {summary.needsReview}
              </span>
            ) : null}
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-transparent text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setTab('all')}
          >
            {t('bookingList.all')}
          </button>
        </div>
        <ExportMenu
          kind="bookings"
          filters={{ status: status || undefined }}
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t('bookingList.total')}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-700">{t('bookingList.pending')}</p>
          <p className="mt-1 text-xl font-semibold text-amber-800">{summary.pending}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-sky-700">{t('bookingList.approved')}</p>
          <p className="mt-1 text-xl font-semibold text-sky-800">{summary.approved}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-emerald-700">{t('bookingList.paid')}</p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">{summary.paid}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-700">{t('bookingList.rejected')}</p>
          <p className="mt-1 text-xl font-semibold text-rose-800">{summary.rejected}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('bookingList.search')}
          className="w-full min-w-[230px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={tab === 'needs_review'}
          title={tab === 'needs_review' ? t('bookingList.statusFilterDisabled') : undefined}
        >
          <option value="">{t('bookingList.allStatuses')}</option>
          <option value="pending">{t('bookingList.pending')}</option>
          <option value="approved">{t('bookingList.approved')}</option>
          <option value="rejected">{t('bookingList.rejected')}</option>
          <option value="paid">{t('bookingList.paid')}</option>
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
        >
          <option value="">{t('bookingList.allUnits')}</option>
          {unitNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          <button
            className={`px-3 py-2 text-sm font-medium ${
              view === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setView('list')}
          >
            {t('bookingList.list')}
          </button>
          <button
            className={`px-3 py-2 text-sm font-medium ${
              view === 'calendar'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setView('calendar')}
          >
            {t('bookingList.calendar')}
          </button>
        </div>
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          onClick={() => {
            void fetchBookings();
            if (view === 'calendar') void fetchCalendar();
          }}
          disabled={isLoading || isCalendarLoading}
        >
          {t('bookingList.refresh')}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {t('bookingList.loading')}
        </div>
      ) : null}

      {!isLoading && view === 'list' && listCards.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {tab === 'needs_review'
            ? t('bookingList.emptyNeedsReview')
            : t('bookingList.emptyFiltered')}
        </div>
      ) : null}

      {view === 'calendar' ? (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-medium text-slate-700">Bookings:</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#10b981' }} aria-hidden />
                <span>{t('bookingList.legendPaid')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }} aria-hidden />
                <span>{t('bookingList.legendApproved')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }} aria-hidden />
                <span>{t('bookingList.legendPending')}</span>
              </div>
              {isCalendarLoading ? (
                <span className="ml-auto text-slate-400">{t('bookingList.loadingCalendar')}</span>
              ) : null}
            </div>
            {visibleUnits.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-700">Units:</span>
                {visibleUnits.map((u) => {
                  const p = unitPalette(u.id);
                  return (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
                      style={{ backgroundColor: p.bg, borderColor: p.border, color: p.text }}
                      title={u.name}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.text }}
                        aria-hidden
                      />
                      <span className="max-w-[180px] truncate">{u.name}</span>
                    </span>
                  );
                })}
                <span className="text-slate-500">
                  · Airbnb ({calendarCounts.airbnbBlocks}) thin border, Hold ({calendarCounts.manualBlocks}) dark border
                </span>
              </div>
            ) : null}
          </div>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={calendarEvents}
            height="auto"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
            eventDisplay="block"
            dayMaxEvents={4}
            eventClick={(info) => {
              const { kind, source } = info.event.extendedProps as { kind: string; source?: string };
              if (kind === 'booking') {
                const bookingId = info.event.id.replace('booking-', '');
                setView('list');
                setHighlightedBookingId(bookingId);
                setTimeout(() => {
                  const el = document.getElementById(`booking-${bookingId}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150);
              } else if (kind === 'block') {
                const rawEnd = info.event.end ? new Date(info.event.end.getTime() - 864e5).toISOString().slice(0, 10) : '';
                setClickedBlock({
                  title: info.event.title,
                  source: source ?? 'unknown',
                  start: info.event.startStr.slice(0, 10),
                  end: rawEnd,
                });
              }
            }}
          />
        </div>
      ) : null}

      {!isLoading && view === 'list' ? (
        <div className="grid gap-3">
          {listCards.map((card) => {
            if (card.kind === 'airbnb' || card.kind === 'manual') {
              const { stay } = card;
              const palette = unitPalette(stay.unitId);
              const isAirbnb = stay.kind === 'airbnb';
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() =>
                    setClickedBlock({
                      title: `${isAirbnb ? 'Airbnb' : 'Hold'} · ${stay.unitName}`,
                      source: stay.kind,
                      start: stay.checkIn,
                      end: new Date(new Date(stay.checkOut).getTime() - 864e5)
                        .toISOString()
                        .slice(0, 10),
                    })
                  }
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-shadow hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{stay.unitName}</h3>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {stay.checkIn} {t('bookingDetails.to')} {stay.checkOut}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {isAirbnb
                          ? t('bookingList.airbnbGuestHint', {
                              defaultValue:
                                'Detalles del huésped solo disponibles en Airbnb.',
                            })
                          : t('bookingList.manualHoldHint', {
                              defaultValue: 'Hold manual creado desde el admin.',
                            })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: palette.bg,
                          borderColor: palette.border,
                          color: palette.text,
                        }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: palette.text }}
                          aria-hidden
                        />
                        {isAirbnb
                          ? t('bookingList.badgeAirbnb', { defaultValue: 'Airbnb' })
                          : t('bookingList.badgeManual', { defaultValue: 'Hold manual' })}
                      </span>
                    </div>
                  </div>
                </button>
              );
            }

            const booking = card.booking;
            const created = booking.created_at
              ? formatDistanceToNow(parseISO(booking.created_at), { addSuffix: true })
              : null;
            const pathBadge = approvalPathBadge(
              booking.approval_path ?? null,
              t('bookingList.pathBadgeAuto'),
              t('bookingList.pathBadgeManual'),
            );
            const hideApproveButton = isAutoApproved(booking);

            const isActing = actingBookingId === booking.id;
            const cancellable = ['pending', 'approved', 'paid'].includes(booking.status);
            const canCheckIn = ['approved', 'paid'].includes(booking.status);
            const canCheckOut = booking.status === 'checked_in';
            const isHighlighted = highlightedBookingId === booking.id;

            return (
              <div
                key={booking.id}
                id={`booking-${booking.id}`}
                className={`rounded-xl border bg-white p-4 transition-shadow ${
                  isHighlighted
                    ? 'border-sky-400 shadow-md shadow-sky-100 ring-1 ring-sky-300'
                    : 'border-slate-200'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {booking.units?.name ?? t('bookingList.unit')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t('bookingList.ref', { ref: booking.id.slice(0, 8).toUpperCase() })}
                    </p>
                    {created ? (
                      <p className="text-xs text-slate-500">
                        {t('bookingList.requested', { time: created })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {t('bookingList.badgeWidget', { defaultValue: 'Web' })}
                    </span>
                    {pathBadge ? (
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${pathBadge.className}`}
                      >
                        {pathBadge.label}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusChipClass(booking.status)}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                </div>

                <BookingDetails booking={booking} />

                <div className="mt-3">
                  <BookingNotes bookingId={booking.id} />
                </div>

                {booking.rejection_reason ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {t('bookingList.rejectionReason')}{booking.rejection_reason}
                  </div>
                ) : null}

                {booking.status === 'pending' && !hideApproveButton ? (
                  <div className="mt-3">
                    <ApprovalButtons
                      onApprove={() => void approve(booking.id)}
                      onReject={() => openRejectModal(booking.id)}
                      isLoading={isActing}
                    />
                  </div>
                ) : null}

                {hideApproveButton ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    {t('bookingList.autoApproved')}
                  </div>
                ) : null}

                {(canCheckIn || canCheckOut || cancellable) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canCheckIn ? (
                      <button
                        onClick={() => void checkIn(booking.id)}
                        disabled={isActing}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isActing ? '...' : 'Check-in'}
                      </button>
                    ) : null}
                    {canCheckOut ? (
                      <button
                        onClick={() => void checkOut(booking.id)}
                        disabled={isActing}
                        className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isActing ? '...' : 'Check-out'}
                      </button>
                    ) : null}
                    {cancellable ? (
                      <button
                        onClick={() => void cancelBooking(booking.id)}
                        disabled={isActing}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isActing ? '...' : t('bookingList.cancelBooking', { defaultValue: 'Cancelar reserva' })}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {clickedBlock ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setClickedBlock(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-900">
                {clickedBlock.source === 'airbnb' ? 'Airbnb Block' : 'Manual Hold'}
              </h4>
              <button
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setClickedBlock(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <dl className="grid gap-2 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-900">Unit</dt>
                <dd className="mt-0.5">{clickedBlock.title.split(' · ')[1] ?? clickedBlock.title}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Dates</dt>
                <dd className="mt-0.5">{clickedBlock.start} to {clickedBlock.end}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Source</dt>
                <dd className="mt-0.5 capitalize">{clickedBlock.source}</dd>
              </div>
            </dl>
            {clickedBlock.source === 'airbnb' ? (
              <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                This block was synced from Airbnb via iCal. Guest details are only available in your Airbnb host dashboard.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {rejectModalBookingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
            <h4 className="text-lg font-semibold text-slate-900">{t('bookingList.rejectTitle')}</h4>
            <p className="mt-1 text-sm text-slate-500">{t('bookingList.rejectDesc')}</p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={t('bookingList.reasonPlaceholder')}
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                onClick={closeRejectModal}
                disabled={actingBookingId === rejectModalBookingId}
              >
                {t('bookingList.cancel')}
              </button>
              <button
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void confirmReject()}
                disabled={actingBookingId === rejectModalBookingId}
              >
                {actingBookingId === rejectModalBookingId
                  ? t('bookingList.rejecting')
                  : t('bookingList.confirmReject')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
