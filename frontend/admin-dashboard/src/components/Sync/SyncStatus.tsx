import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { api } from '../../utils/api';
import { supabase } from '../../context/AuthContext';

interface UnitRow {
  id: string;
  name: string;
  airbnb_ical_url: string;
}

interface SyncLog {
  unit_id: string | null;
  sync_status: 'success' | 'failed' | 'in_progress' | string;
  sync_completed_at: string | null;
  sync_started_at: string;
  blocked_dates_found?: number;
  error_message?: string | null;
}

function statusBadgeClass(status: string): string {
  if (status === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function SyncStatus() {
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [logs, setLogs] = useState<Record<string, SyncLog>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUnitId, setBusyUnitId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const { t } = useTranslation();

  const statusLabel = (status: string): string => {
    if (status === 'in_progress') return t('syncStatus.inProgressLabel');
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const fetchUnits = async () => {
    const { data } = await api.get<UnitRow[]>('/admin/units');
    setUnits(data);
  };

  const fetchLogs = async () => {
    const { data } = await api.get<SyncLog[]>('/admin/sync-logs', { params: { limit: 100 } });
    const latestByUnit: Record<string, SyncLog> = {};
    for (const log of data) {
      if (log.unit_id && !latestByUnit[log.unit_id]) {
        latestByUnit[log.unit_id] = log;
      }
    }
    setLogs(latestByUnit);
  };

  const refresh = async () => {
    try {
      setIsLoading(true);
      await Promise.all([fetchUnits(), fetchLogs()]);
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
        void fetchLogs();
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
      await fetchLogs();
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
      await fetchLogs();
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
      total: units.length,
      success: 0,
      failed: 0,
      inProgress: 0,
      never: 0,
    };

    for (const unit of units) {
      const log = logs[unit.id];
      if (!log) {
        result.never += 1;
      } else if (log.sync_status === 'success') {
        result.success += 1;
      } else if (log.sync_status === 'failed') {
        result.failed += 1;
      } else if (log.sync_status === 'in_progress') {
        result.inProgress += 1;
      }
    }

    return result;
  }, [logs, units]);

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
            disabled={isSyncingAll || isLoading || units.length === 0}
          >
            {isSyncingAll ? t('syncStatus.syncingAll') : t('syncStatus.syncAll')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t('syncStatus.units')}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-emerald-700">{t('syncStatus.success')}</p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">{summary.success}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-700">{t('syncStatus.failed')}</p>
          <p className="mt-1 text-xl font-semibold text-rose-800">{summary.failed}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-700">{t('syncStatus.inProgress')}</p>
          <p className="mt-1 text-xl font-semibold text-amber-800">{summary.inProgress}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 lg:col-span-1">
          <p className="text-xs uppercase tracking-wide text-slate-600">{t('syncStatus.neverSynced')}</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">{summary.never}</p>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{t('syncStatus.loading')}</div>
        ) : null}

        {!isLoading && units.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{t('syncStatus.noUnits')}</div>
        ) : null}

        {!isLoading
          ? units.map((unit) => {
              const log = logs[unit.id];
              const completedAt = log?.sync_completed_at;
              const lastSyncLabel = completedAt
                ? formatDistanceToNow(parseISO(completedAt), { addSuffix: true })
                : t('syncStatus.never');

              return (
                <div key={unit.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900">{unit.name}</h4>
                      <p className="mt-1 truncate text-xs text-slate-500" title={unit.airbnb_ical_url}>
                        {unit.airbnb_ical_url}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{t('syncStatus.lastSync', { time: lastSyncLabel })}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                      <span
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(log?.sync_status ?? 'not_synced')}`}
                      >
                        {statusLabel(log?.sync_status ?? 'not_synced')}
                      </span>
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void manualSync(unit.id)}
                        disabled={busyUnitId === unit.id || isSyncingAll}
                      >
                        {busyUnitId === unit.id ? t('syncStatus.syncing') : t('syncStatus.manualSync')}
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
