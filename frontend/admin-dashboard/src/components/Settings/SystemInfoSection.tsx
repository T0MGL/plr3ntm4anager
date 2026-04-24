import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiCheck, FiCopy, FiInfo } from 'react-icons/fi';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.0.0';
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
const MODE = import.meta.env.MODE;

type Row = {
  key: string;
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
};

export default function SystemInfoSection() {
  const { t, i18n } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const rows: Row[] = useMemo(() => {
    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? t('systemInfo.unknown');
    const currentLang = (i18n.resolvedLanguage ?? i18n.language ?? 'en').slice(0, 2);
    return [
      { key: 'version', label: t('systemInfo.version'), value: APP_VERSION, mono: true },
      {
        key: 'environment',
        label: t('systemInfo.environment'),
        value: MODE === 'production' ? t('systemInfo.envProduction') : t('systemInfo.envDevelopment'),
      },
      { key: 'api', label: t('systemInfo.apiEndpoint'), value: API_URL, mono: true, copyable: true },
      { key: 'timezone', label: t('systemInfo.timezone'), value: tz, mono: true },
      {
        key: 'language',
        label: t('systemInfo.language'),
        value:
          currentLang === 'es' ? t('systemInfo.languageSpanish') : t('systemInfo.languageEnglish'),
      },
    ];
  }, [i18n, t]);

  const copy = async (row: Row) => {
    if (!row.copyable) return;
    try {
      await navigator.clipboard.writeText(row.value);
      setCopiedKey(row.key);
      toast.success(t('systemInfo.copied'));
      window.setTimeout(() => setCopiedKey((cur) => (cur === row.key ? null : cur)), 1500);
    } catch {
      toast.error(t('systemInfo.copyFailed'));
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <FiInfo className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{t('systemInfo.sectionTitle')}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{t('systemInfo.sectionDesc')}</p>
        </div>
      </header>

      <dl className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 sm:pt-0.5">
              {row.label}
            </dt>
            <dd className="flex min-w-0 items-center gap-2 text-sm text-slate-900">
              <span
                className={`min-w-0 flex-1 truncate ${row.mono ? 'font-mono text-[13px]' : ''}`}
                title={row.value}
              >
                {row.value}
              </span>
              {row.copyable ? (
                <button
                  type="button"
                  onClick={() => void copy(row)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label={t('systemInfo.copyAria', { label: row.label })}
                >
                  {copiedKey === row.key ? (
                    <FiCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
