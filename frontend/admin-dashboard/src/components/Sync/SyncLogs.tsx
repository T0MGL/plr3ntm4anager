import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { api } from '../../utils/api';

interface SyncLog {
  id: string;
  unit_id: string | null;
  sync_status: 'success' | 'failed' | 'in_progress' | string;
  sync_started_at: string;
  sync_completed_at: string | null;
  blocked_dates_found: number;
  error_message: string | null;
}

function statusBadgeClass(status: string): string {
  if (status === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function SyncLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<SyncLog[]>('/admin/sync-logs', { params: { limit: 50 } });
      setLogs(data);
      setError(null);
      hasFetchedRef.current = true;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load sync logs';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !hasFetchedRef.current) {
      void fetchLogs();
    }
  };

  const summary = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        if (log.sync_status === 'success') acc.success += 1;
        if (log.sync_status === 'failed') acc.failed += 1;
        if (log.sync_status === 'in_progress') acc.inProgress += 1;
        return acc;
      },
      { success: 0, failed: 0, inProgress: 0 },
    );
  }, [logs]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="group flex items-center gap-2 text-left"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900">{t('syncLogs.title')}</h3>
          <span className="text-xs font-medium text-slate-500">
            {isOpen ? t('syncLogs.collapse') : t('syncLogs.expand')}
          </span>
        </button>
        {isOpen ? (
          <button
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 sm:w-auto"
            onClick={() => void fetchLogs()}
            disabled={isLoading}
          >
            {t('syncLogs.refresh')}
          </button>
        ) : null}
      </div>

      {!isOpen ? (
        <p className="mt-2 text-xs text-slate-500">{t('syncLogs.collapsedHint')}</p>
      ) : null}

      {isOpen ? (
        <div className="mt-4">
          <div className="mb-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{t('syncLogs.successCount', { count: summary.success })}</div>
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{t('syncLogs.failedCount', { count: summary.failed })}</div>
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">{t('syncLogs.inProgressCount', { count: summary.inProgress })}</div>
          </div>

          {error ? <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

          {isLoading ? <p className="text-sm text-slate-500">{t('syncLogs.loading')}</p> : null}

          {!isLoading && logs.length === 0 ? <p className="text-sm text-slate-500">{t('syncLogs.noLogs')}</p> : null}

          {!isLoading && logs.length > 0 ? (
            <>
              <div className="grid gap-3 md:hidden">
                {logs.map((log) => (
                  <article key={log.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(log.sync_status)}`}>
                        {log.sync_status === 'in_progress' ? t('syncLogs.inProgressLabel') : log.sync_status}
                      </span>
                      <span className="text-xs text-slate-500">{log.unit_id ?? t('syncLogs.allUnits')}</span>
                    </div>
                    <p className="text-xs text-slate-600">{t('syncLogs.startedLabel', { time: format(new Date(log.sync_started_at), 'MMM dd, yyyy HH:mm') })}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {log.sync_completed_at
                        ? t('syncLogs.completedLabel', { time: format(new Date(log.sync_completed_at), 'MMM dd, yyyy HH:mm') })
                        : t('syncLogs.inProgressCompletion')}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">{t('syncLogs.blockedDatesLabel', { count: log.blocked_dates_found ?? 0 })}</p>
                    {log.error_message ? <p className="mt-2 text-xs text-rose-700">{log.error_message}</p> : null}
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">{t('syncLogs.status')}</th>
                      <th className="py-2 pr-4">{t('syncLogs.unitId')}</th>
                      <th className="py-2 pr-4">{t('syncLogs.started')}</th>
                      <th className="py-2 pr-4">{t('syncLogs.completed')}</th>
                      <th className="py-2 pr-4">{t('syncLogs.blockedDates')}</th>
                      <th className="py-2">{t('syncLogs.error')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 align-top last:border-b-0">
                        <td className="py-2 pr-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(log.sync_status)}`}>
                            {log.sync_status === 'in_progress' ? t('syncLogs.inProgressLabel') : log.sync_status}
                          </span>
                        </td>
                        <td className="max-w-[200px] py-2 pr-4 text-xs text-slate-600" title={log.unit_id ?? t('syncLogs.allUnits')}>
                          {log.unit_id ?? t('syncLogs.allUnits')}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                          {format(new Date(log.sync_started_at), 'MMM dd, yyyy HH:mm')}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                          {log.sync_completed_at ? format(new Date(log.sync_completed_at), 'MMM dd, yyyy HH:mm') : t('syncLogs.inProgressCompletion')}
                        </td>
                        <td className="py-2 pr-4 text-slate-700">{log.blocked_dates_found ?? 0}</td>
                        <td className="max-w-[260px] py-2 text-xs text-rose-700">{log.error_message ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
