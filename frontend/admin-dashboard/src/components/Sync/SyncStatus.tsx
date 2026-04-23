import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { api } from '../../utils/api';
import { supabase } from '../../context/AuthContext';

interface UnitSyncRow {
  unit_id: string;
  name: string;
  ical_url: string;
  status: 'active' | 'inactive' | string;
  sync_offset_minutes: number;
  last_synced_at: string | null;
  has_body_hash: boolean;
  has_etag: boolean;
  last_status: 'success' | 'failed' | 'in_progress' | 'no_change' | string | null;
  last_completed_at: string | null;
  last_rows_inserted: number;
  last_rows_deleted: number;
  recent: {
    samples: number;
    success: number;
    failed: number;
    no_change: number;
    etag_hit_rate: number;
    hash_hit_rate: number;
  };
}

function statusBadgeClass(status: string | null): string {
  if (status === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'no_change') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function SyncStatus() {
  const [rows, setRows] = useState<UnitSyncRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUnitId, setBusyUnitId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const { t } = useTranslation();

  const statusLabel = (status: string | null): string => {
    if (!status) return t('syncStatus.never');
    if (status === 'in_progress') return t('syncStatus.inProgressLabel');
    if (status === 'no_change') return t('syncStatus.noChangeLabel');
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const fetchStatus = async () => {
    const { data } = await api.get<UnitSyncRow[]>('/admin/sync/unit-status');
    setRows(data);
  };

  const refresh = async () => {
    try {
      setIsLoading(true);
      await fetchStatus();
      setError(null);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Failed to load sync status';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_logs' }, () => {
        void fetchStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const manualSync = async (unitId: string) => {
    try {
      setBusyUnitId(unitId);
      await api.post('/admin/sync/manual', { unit_id: unitId });
      await fetchStatus();
      setError(null);
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Manual sync failed';
      setError(message);
    } finally {
      setBusyUnitId(null);
    }
  };

  const syncAll = async () => {
    try {
      setIsSyncingAll(true);
      await api.post('/admin/sync/manual', {});
      await fetchStatus();
      setError(null);
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Sync all failed';
      setError(message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const summary = useMemo(() => {
    const result = {
      total: rows.length,
      success: 0,
      failed: 0,
      inProgress: 0,
      noChange: 0,
      never: 0
    };

    for (const row of rows) {
      if (!row.last_status) {
        result.never += 1;
      } else if (row.last_status === 'success') {
        result.success += 1;
      } else if (row.last_status === 'failed') {
        result.failed += 1;
      } else if (row.last_status === 'in_progress') {
        result.inProgress += 1;
      } else if (row.last_status === 'no_change') {
        result.noChange += 1;
      }
    }

    return result;
  }, [rows]);

  const asuncionRelative = (iso: string | null): string => {
    if (!iso) return t('syncStatus.never');
    try {
      return formatDistanceToNow(parseISO(iso), { addSuffix: true });
    } catch {
      return iso;
    }
  };

  const formatPct = (value: number): string => `${Math.round(value * 100)}%`;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{t('syncStatus.title')}</h3>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
          <button
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 sm:w-auto"
            onClick={() => void refresh()}
            disabled={isLoading}
          >
            {t('syncStatus.refresh')}
          </button>
          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            onClick={syncAll}
            disabled={isSyncingAll || isLoading || rows.length === 0}
          >
            {isSyncingAll ? t('syncStatus.syncingAll') : t('syncStatus.syncAll')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t('syncStatus.units')}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-emerald-700">{t('syncStatus.success')}</p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">{summary.success}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-sky-700">{t('syncStatus.noChange')}</p>
          <p className="mt-1 text-xl font-semibold text-sky-800">{summary.noChange}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-700">{t('syncStatus.failed')}</p>
          <p className="mt-1 text-xl font-semibold text-rose-800">{summary.failed}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-700">{t('syncStatus.inProgress')}</p>
          <p className="mt-1 text-xl font-semibold text-amber-800">{summary.inProgress}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-600">{t('syncStatus.neverSynced')}</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">{summary.never}</p>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{t('syncStatus.loading')}</div>
        ) : null}

        {!isLoading && rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{t('syncStatus.noUnits')}</div>
        ) : null}

        {!isLoading
          ? rows.map((row) => {
              const lastSeen = row.last_synced_at ?? row.last_completed_at;
              const lastSyncLabel = asuncionRelative(lastSeen);

              return (
                <div key={row.unit_id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-slate-900">{row.name}</h4>
                      <p className="mt-1 truncate text-xs text-slate-500" title={row.ical_url}>
                        {row.ical_url}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{t('syncStatus.lastSync', { time: lastSyncLabel })}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                          {t('syncStatus.offsetLabel', { minutes: row.sync_offset_minutes })}
                        </span>
                        {row.recent.samples > 0 ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                            {t('syncStatus.hitRateLabel', {
                              hash: formatPct(row.recent.hash_hit_rate),
                              etag: formatPct(row.recent.etag_hit_rate),
                              samples: row.recent.samples
                            })}
                          </span>
                        ) : null}
                        {row.last_status === 'success' &&
                        (row.last_rows_inserted > 0 || row.last_rows_deleted > 0) ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                            {t('syncStatus.diffLabel', {
                              inserted: row.last_rows_inserted,
                              deleted: row.last_rows_deleted
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                      <span
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(row.last_status)}`}
                      >
                        {statusLabel(row.last_status)}
                      </span>
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void manualSync(row.unit_id)}
                        disabled={busyUnitId === row.unit_id || isSyncingAll}
                        title={t('syncStatus.manualSyncHint')}
                      >
                        {busyUnitId === row.unit_id ? t('syncStatus.syncing') : t('syncStatus.manualSync')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}
