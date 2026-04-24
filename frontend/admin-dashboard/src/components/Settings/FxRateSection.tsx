import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDollarSign,
  FiEdit3,
  FiLoader,
  FiRefreshCw
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { fxRateService, type FxRateStatus, FxRateApiError } from '../../services/fx-rate';

type LoadStatus = 'loading' | 'ready' | 'error';

const PYG_FORMATTER = new Intl.NumberFormat('es-PY', {
  maximumFractionDigits: 0
});

function formatRate(rate: number): string {
  return PYG_FORMATTER.format(Math.round(rate));
}

function formatAge(ageHours: number): string {
  if (!Number.isFinite(ageHours)) return '-';
  if (ageHours < 1) return `${Math.max(1, Math.round(ageHours * 60))}m`;
  if (ageHours < 48) return `${Math.round(ageHours)}h`;
  return `${Math.round(ageHours / 24)}d`;
}

export default function FxRateSection() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<FxRateStatus | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [markupInput, setMarkupInput] = useState('');
  const [savedMarkup, setSavedMarkup] = useState<number | null>(null);
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [overrideInput, setOverrideInput] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoadStatus('loading');
    try {
      const next = await fxRateService.getStatus();
      apply(next);
      setLoadStatus('ready');
    } catch {
      setLoadStatus('error');
    }
  };

  const apply = (next: FxRateStatus) => {
    setStatus(next);
    setSavedMarkup(next.markupPct);
    setMarkupInput(String(next.markupPct));
  };

  const isMarkupDirty = useMemo(() => {
    if (savedMarkup === null) return false;
    const parsed = Number(markupInput);
    if (!Number.isFinite(parsed)) return false;
    return parsed !== savedMarkup;
  }, [markupInput, savedMarkup]);

  const saveMarkup = async () => {
    const parsed = Number(markupInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 30) {
      toast.error(t('fxRate.errorMarkupRange'));
      return;
    }
    setSavingMarkup(true);
    try {
      const next = await fxRateService.setMarkup(parsed);
      apply(next);
      toast.success(t('fxRate.savedMarkup'));
    } catch (err) {
      toast.error(err instanceof FxRateApiError ? err.message : t('fxRate.saveFailed'));
    } finally {
      setSavingMarkup(false);
    }
  };

  const saveOverride = async () => {
    const parsed = Number(overrideInput);
    if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 20000) {
      toast.error(t('fxRate.errorOverrideRange'));
      return;
    }
    setSavingOverride(true);
    try {
      const next = await fxRateService.setManualOverride(parsed);
      apply(next);
      setOverrideInput('');
      toast.success(t('fxRate.savedOverride'));
    } catch (err) {
      toast.error(err instanceof FxRateApiError ? err.message : t('fxRate.saveFailed'));
    } finally {
      setSavingOverride(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await fxRateService.refresh();
      apply(next);
      toast.success(t('fxRate.refreshed'));
    } catch (err) {
      toast.error(err instanceof FxRateApiError ? err.message : t('fxRate.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  };

  if (loadStatus === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('fxRate.loading')}
      </div>
    );
  }

  if (loadStatus === 'error' || !status) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {t('fxRate.loadFailed')}
      </div>
    );
  }

  const sourceLabel =
    status.source === 'manual'
      ? t('fxRate.sourceManual')
      : status.source === 'env_fallback'
        ? t('fxRate.sourceFallback')
        : status.source;

  const StatusBadge = status.fallback || status.stale ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      <FiAlertTriangle className="h-3 w-3 text-amber-500" aria-hidden="true" />
      {status.fallback ? t('fxRate.badgeFallback') : t('fxRate.badgeStale')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      <FiCheckCircle className="h-3 w-3 text-emerald-500" aria-hidden="true" />
      {t('fxRate.badgeFresh')}
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-1 inline-flex items-center gap-2">
              <FiDollarSign className="h-4 w-4 text-slate-500" aria-hidden="true" />
              {t('fxRate.sectionTitle')}
            </h3>
            <p className="text-sm text-slate-500">{t('fxRate.sectionDesc')}</p>
          </div>
          {StatusBadge}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {t('fxRate.marketRate')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatRate(status.marketRate)}
              <span className="ml-1 text-sm font-normal text-slate-500">PYG/USD</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t('fxRate.lastUpdated', {
                age: formatAge(status.ageHours),
                source: sourceLabel
              })}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-900 bg-slate-900 p-4 text-white">
            <p className="text-xs font-medium text-slate-300 uppercase tracking-wide">
              {t('fxRate.effectiveRate')}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {formatRate(status.effectiveRate)}
              <span className="ml-1 text-sm font-normal text-slate-300">PYG/USD</span>
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {t('fxRate.effectiveDesc', { markup: status.markupPct })}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? (
              <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            {t('fxRate.refresh')}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">{t('fxRate.markupTitle')}</h3>
          <p className="text-sm text-slate-500">{t('fxRate.markupDesc')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="fx-markup" className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('fxRate.markupLabel')}
            </label>
            <div className="relative">
              <input
                id="fx-markup"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                max={30}
                value={markupInput}
                onChange={(e) => setMarkupInput(e.target.value)}
                disabled={savingMarkup}
                className="w-full rounded-xl border border-slate-300 bg-white pl-3 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 hover:border-slate-400 disabled:opacity-60"
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
                %
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{t('fxRate.markupHint')}</p>
          </div>
          <button
            type="button"
            onClick={() => void saveMarkup()}
            disabled={!isMarkupDirty || savingMarkup}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {savingMarkup ? (
              <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t('fxRate.saveMarkup')}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-1 inline-flex items-center gap-2">
            <FiEdit3 className="h-4 w-4 text-slate-500" aria-hidden="true" />
            {t('fxRate.overrideTitle')}
          </h3>
          <p className="text-sm text-slate-500">{t('fxRate.overrideDesc')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="fx-override" className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('fxRate.overrideLabel')}
            </label>
            <input
              id="fx-override"
              type="number"
              inputMode="decimal"
              step="1"
              min={1000}
              max={20000}
              placeholder={String(Math.round(status.marketRate))}
              value={overrideInput}
              onChange={(e) => setOverrideInput(e.target.value)}
              disabled={savingOverride}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 hover:border-slate-400 disabled:opacity-60"
            />
            <p className="mt-1.5 text-xs text-slate-500">{t('fxRate.overrideHint')}</p>
          </div>
          <button
            type="button"
            onClick={() => void saveOverride()}
            disabled={!overrideInput.trim() || savingOverride}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {savingOverride ? (
              <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t('fxRate.saveOverride')}
          </button>
        </div>
      </div>
    </div>
  );
}
