import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiLoader,
  FiRefreshCw,
  FiAlertTriangle,
  FiPlus
} from 'react-icons/fi';
import { supabase } from '../../context/AuthContext';
import {
  fetchOpsOverview,
  fetchSyncUnitStatus,
  triggerManualSync,
  type OpsEvent,
  type OpsOverview,
  type OpsTurnover,
  type OpsVacantUnit,
  type SyncUnitStatus
} from '../../services/ops-overview';

// Shared props so the four widgets can signal a highlight-and-scroll on the
// parent BookingList rather than owning their own drawer.
interface OpsDashboardProps {
  onSelectAirbnb?: (availabilityId: string) => void;
  onSelectBooking?: (bookingId: string) => void;
  onCreateManualBooking?: (unitId: string) => void;
}

type OverviewStatus = 'idle' | 'loading' | 'error' | 'ready';

export default function OpsDashboard({
  onSelectAirbnb,
  onSelectBooking,
  onCreateManualBooking
}: OpsDashboardProps) {
  const { t, i18n } = useTranslation();
  const [overview, setOverview] = useState<OpsOverview | null>(null);
  const [status, setStatus] = useState<OverviewStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await fetchOpsOverview();
      setOverview(data);
      setStatus('ready');
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load overview';
      setError(msg);
      setStatus('error');
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-ops-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, () => {
        void load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {t('ops.title', { defaultValue: 'Operaciones hoy' })}
          </h3>
          <p className="text-xs text-slate-500">
            {t('ops.subtitle', {
              defaultValue: 'Próximos check-ins, check-outs, turnovers y unidades libres.'
            })}
          </p>
        </div>
        <SyncFreshnessBadge onAfterSync={() => void load()} />
      </header>

      {status === 'error' ? (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <span className="flex items-center gap-2">
            <FiAlertCircle className="h-4 w-4" aria-hidden />
            {error ?? t('ops.loadError', { defaultValue: 'No se pudo cargar el resumen.' })}
          </span>
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              void load();
            }}
            className="rounded-md border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            {t('ops.retry', { defaultValue: 'Reintentar' })}
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <CheckinsWidget
          status={status}
          items={overview?.upcoming_checkins ?? []}
          today={overview?.today ?? ''}
          locale={i18n.language}
          onSelectAirbnb={onSelectAirbnb}
          onSelectBooking={onSelectBooking}
        />
        <CheckoutsWidget
          status={status}
          items={overview?.upcoming_checkouts ?? []}
          today={overview?.today ?? ''}
          locale={i18n.language}
          onSelectAirbnb={onSelectAirbnb}
          onSelectBooking={onSelectBooking}
        />
        <TurnoverWidget
          status={status}
          items={overview?.turnover_today ?? []}
          onSelectAirbnb={onSelectAirbnb}
          onSelectBooking={onSelectBooking}
        />
        <VacantUnitsWidget
          status={status}
          items={overview?.vacant_now ?? []}
          onCreateManualBooking={onCreateManualBooking}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sync freshness badge
// ---------------------------------------------------------------------------

interface SyncFreshnessBadgeProps {
  onAfterSync?: () => void;
}

function SyncFreshnessBadge({ onAfterSync }: SyncFreshnessBadgeProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SyncUnitStatus[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await fetchSyncUnitStatus();
      setRows(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed');
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return { state: 'unknown' as const, oldest: null as string | null, failedCount: 0 };
    }
    let oldest: string | null = null;
    let failed = 0;
    for (const r of rows) {
      if (r.status !== 'active') continue;
      if (r.last_status === 'failed') failed += 1;
      const ts = r.last_completed_at ?? r.last_synced_at;
      if (!ts) continue;
      if (!oldest || ts < oldest) oldest = ts;
    }
    const ageMs = oldest ? Date.now() - new Date(oldest).getTime() : Number.POSITIVE_INFINITY;
    const ageMin = ageMs / 60_000;
    if (failed > 0) return { state: 'failed' as const, oldest, failedCount: failed };
    if (!oldest) return { state: 'never' as const, oldest: null, failedCount: 0 };
    if (ageMin < 15) return { state: 'fresh' as const, oldest, failedCount: 0 };
    if (ageMin < 60) return { state: 'stale' as const, oldest, failedCount: 0 };
    return { state: 'old' as const, oldest, failedCount: 0 };
  }, [rows]);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await triggerManualSync();
      toast.success(t('ops.syncSuccess', { defaultValue: 'Sync iniciado.' }));
      await load();
      onAfterSync?.();
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
            t('ops.syncFailed', { defaultValue: 'No se pudo iniciar el sync.' })
          : err instanceof Error
            ? err.message
            : t('ops.syncFailed', { defaultValue: 'No se pudo iniciar el sync.' });
      toast.error(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderLabel = () => {
    if (loadError) return t('ops.syncUnknown', { defaultValue: 'Estado sync desconocido' });
    if (summary.state === 'unknown' || summary.state === 'never') {
      return t('ops.syncNever', { defaultValue: 'Sin syncs registrados' });
    }
    if (summary.state === 'failed') {
      return t('ops.syncFailedCount', {
        defaultValue: '{{count}} sync fallido',
        count: summary.failedCount
      });
    }
    const rel = summary.oldest
      ? formatDistanceToNow(parseISO(summary.oldest), { addSuffix: true })
      : '';
    return t('ops.syncAgo', { defaultValue: 'Último sync {{when}}', when: rel });
  };

  const stateClasses = {
    fresh: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    stale: 'border-amber-200 bg-amber-50 text-amber-700',
    old: 'border-amber-300 bg-amber-100 text-amber-800',
    failed: 'border-rose-200 bg-rose-50 text-rose-700',
    never: 'border-slate-200 bg-slate-50 text-slate-600',
    unknown: 'border-slate-200 bg-slate-50 text-slate-600'
  }[summary.state];

  const Icon =
    summary.state === 'fresh'
      ? FiCheckCircle
      : summary.state === 'failed'
        ? FiAlertCircle
        : FiAlertTriangle;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${stateClasses}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {renderLabel()}
      </span>
      <button
        type="button"
        onClick={() => void triggerSync()}
        disabled={isSyncing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSyncing ? (
          <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <FiRefreshCw className="h-3.5 w-3.5" aria-hidden />
        )}
        {isSyncing
          ? t('ops.syncing', { defaultValue: 'Sincronizando...' })
          : t('ops.syncNow', { defaultValue: 'Sync ahora' })}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared widget shell
// ---------------------------------------------------------------------------

interface WidgetShellProps {
  title: string;
  status: OverviewStatus;
  emptyText: string;
  count?: number;
  children?: React.ReactNode;
}

function WidgetShell({ title, status, emptyText, count, children }: WidgetShellProps) {
  const showContent = status === 'ready';
  const showLoading = status === 'loading' || status === 'idle';
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {title}
        </h4>
        {typeof count === 'number' && count > 0 && showContent ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {count}
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2">
        {showLoading ? <WidgetSkeleton /> : null}
        {showContent ? children ?? <EmptyState text={emptyText} /> : null}
      </div>
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-4 text-center text-xs text-slate-400">{text}</p>;
}

// ---------------------------------------------------------------------------
// Widget 1 and 2: check-ins and check-outs
// ---------------------------------------------------------------------------

interface EventListProps {
  items: OpsEvent[];
  today: string;
  locale: string;
  emptyText: string;
  title: string;
  status: OverviewStatus;
  /** Hour label shown next to each row, property policy (15:00 check-in,
   *  11:00 check-out). Pass '15:00' or '11:00'. */
  hour: string;
  onSelectAirbnb?: (availabilityId: string) => void;
  onSelectBooking?: (bookingId: string) => void;
}

function dayLabel(iso: string, today: string, locale: string): string {
  if (iso === today) return 'Hoy';
  // "Manana" (mañana) the next calendar day.
  const [y, m, d] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d));
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  if (iso === tomorrowStr) return 'Mañana';
  const parsed = parseISO(iso);
  return new Intl.DateTimeFormat(locale || 'es', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(parsed);
}

function EventList({
  items,
  today,
  locale,
  emptyText,
  title,
  status,
  hour,
  onSelectAirbnb,
  onSelectBooking
}: EventListProps) {
  return (
    <WidgetShell title={title} status={status} emptyText={emptyText} count={items.length}>
      {items.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 6).map((ev, idx) => {
            const key = `${ev.source}-${ev.availability_id ?? ev.booking_id ?? idx}-${ev.date}`;
            const handleClick = () => {
              if (ev.source === 'airbnb' && ev.availability_id) {
                onSelectAirbnb?.(ev.availability_id);
              } else if (ev.source === 'widget' && ev.booking_id) {
                onSelectBooking?.(ev.booking_id);
              }
            };
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={handleClick}
                  className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-slate-50"
                >
                  <div className="min-w-[64px] shrink-0">
                    <p className="text-xs font-semibold text-slate-900">
                      {dayLabel(ev.date, today, locale)}
                    </p>
                    <p className="text-[11px] text-slate-500">{hour}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {ev.guest_label}
                    </p>
                    <p className="truncate text-xs text-slate-500">{ev.unit_name}</p>
                  </div>
                  <span className="text-slate-300">›</span>
                </button>
              </li>
            );
          })}
          {items.length > 6 ? (
            <li className="px-1 pt-2 text-[11px] text-slate-400">
              +{items.length - 6} más esta semana
            </li>
          ) : null}
        </ul>
      )}
    </WidgetShell>
  );
}

function CheckinsWidget({
  items,
  today,
  locale,
  status,
  onSelectAirbnb,
  onSelectBooking
}: {
  items: OpsEvent[];
  today: string;
  locale: string;
  status: OverviewStatus;
  onSelectAirbnb?: (id: string) => void;
  onSelectBooking?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <EventList
      title={t('ops.checkins7d', { defaultValue: 'Próximos check-ins (7d)' })}
      items={items}
      today={today}
      locale={locale}
      status={status}
      emptyText={t('ops.noCheckins', { defaultValue: 'Sin entradas esta semana.' })}
      hour="15:00"
      onSelectAirbnb={onSelectAirbnb}
      onSelectBooking={onSelectBooking}
    />
  );
}

function CheckoutsWidget({
  items,
  today,
  locale,
  status,
  onSelectAirbnb,
  onSelectBooking
}: {
  items: OpsEvent[];
  today: string;
  locale: string;
  status: OverviewStatus;
  onSelectAirbnb?: (id: string) => void;
  onSelectBooking?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <EventList
      title={t('ops.checkouts7d', { defaultValue: 'Próximos check-outs (7d)' })}
      items={items}
      today={today}
      locale={locale}
      status={status}
      emptyText={t('ops.noCheckouts', { defaultValue: 'Sin salidas esta semana.' })}
      hour="11:00"
      onSelectAirbnb={onSelectAirbnb}
      onSelectBooking={onSelectBooking}
    />
  );
}

// ---------------------------------------------------------------------------
// Widget 3: turnover hoy
// ---------------------------------------------------------------------------

function TurnoverWidget({
  items,
  status,
  onSelectAirbnb,
  onSelectBooking
}: {
  items: OpsTurnover[];
  status: OverviewStatus;
  onSelectAirbnb?: (id: string) => void;
  onSelectBooking?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <WidgetShell
      title={t('ops.turnoverToday', { defaultValue: 'Turnover hoy' })}
      status={status}
      emptyText={t('ops.noTurnover', { defaultValue: 'Sin turnovers hoy.' })}
      count={items.length}
    >
      {items.length === 0 ? (
        <EmptyState text={t('ops.noTurnover', { defaultValue: 'Sin turnovers hoy.' })} />
      ) : (
        <ul className="space-y-2">
          {items.map((row) => {
            const handleClick = () => {
              if (row.incoming.source === 'airbnb' && row.incoming.availability_id) {
                onSelectAirbnb?.(row.incoming.availability_id);
              } else if (row.incoming.booking_id) {
                onSelectBooking?.(row.incoming.booking_id);
              }
            };
            return (
              <li
                key={row.unit_id}
                className="rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    {t('ops.urgentClean', { defaultValue: 'Limpieza urgente' })}
                  </span>
                  <span className="text-xs font-medium text-amber-900">{row.unit_name}</span>
                </div>
                <p className="mt-2 text-xs text-slate-700">
                  <span className="font-medium">11:00</span> sale {row.outgoing.guest_label}
                </p>
                <p className="mt-0.5 text-xs text-slate-700">
                  <span className="font-medium">15:00</span> entra {row.incoming.guest_label}
                </p>
                <button
                  type="button"
                  onClick={handleClick}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950"
                >
                  {t('ops.openIncoming', { defaultValue: 'Ver reserva entrante' })} ›
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Widget 4: unidades vacias ahora
// ---------------------------------------------------------------------------

function VacantUnitsWidget({
  items,
  status,
  onCreateManualBooking
}: {
  items: OpsVacantUnit[];
  status: OverviewStatus;
  onCreateManualBooking?: (unitId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <WidgetShell
      title={t('ops.vacantNow', { defaultValue: 'Unidades vacías ahora' })}
      status={status}
      emptyText={t('ops.allOccupied', { defaultValue: 'Todas las unidades están ocupadas hoy.' })}
      count={items.length}
    >
      {items.length === 0 ? (
        <EmptyState
          text={t('ops.allOccupied', { defaultValue: 'Todas las unidades están ocupadas hoy.' })}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((u) => (
            <li key={u.unit_id} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate text-sm font-medium text-slate-900">{u.unit_name}</span>
              <button
                type="button"
                onClick={() => onCreateManualBooking?.(u.unit_id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              >
                <FiPlus className="h-3 w-3" aria-hidden />
                {t('ops.createManualBooking', { defaultValue: 'Reserva manual' })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
