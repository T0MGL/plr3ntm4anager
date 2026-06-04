import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { FiCopy, FiExternalLink, FiLoader, FiPlus } from 'react-icons/fi';
import {
  buildPublicPayUrl,
  paymentLinksService,
  type PaymentLink,
} from '../services/payment-links';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const PYG = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0,
});

function statusChipClass(status: PaymentLink['status']): string {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'expired') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export default function PaymentLinks() {
  const { t } = useTranslation();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      const data = await paymentLinksService.list();
      setLinks(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load payment links');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const statusLabel = useMemo(
    () => ({
      active: t('paymentLinks.statusActive'),
      paid: t('paymentLinks.statusPaid'),
      expired: t('paymentLinks.statusExpired'),
    }),
    [t],
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;

    const amountUsd = Number(amount);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      setFieldError(t('paymentLinks.amountError'));
      return;
    }
    if (concept.trim().length < 2) {
      setFieldError(t('paymentLinks.conceptError'));
      return;
    }
    setFieldError(null);
    setCreating(true);
    try {
      const link = await paymentLinksService.create({ amountUsd, concept: concept.trim() });
      setLinks((prev) => [link, ...prev]);
      setAmount('');
      setConcept('');
      toast.success(t('paymentLinks.createdToast'));
      await copyLink(link.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (linkId: string) => {
    const url = buildPublicPayUrl(linkId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('paymentLinks.copied'));
    } catch {
      // Clipboard can be blocked (insecure context, permissions). Surface the
      // URL so the operator can copy it by hand instead of failing silently.
      window.prompt(t('paymentLinks.copy'), url);
    }
  };

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{t('paymentLinks.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('paymentLinks.subtitle')}</p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h3 className="text-sm font-semibold text-slate-700">{t('paymentLinks.createTitle')}</h3>
        <div className="grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-end">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('paymentLinks.amountLabel')}
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder={t('paymentLinks.amountPlaceholder')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('paymentLinks.conceptLabel')}
            </span>
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              maxLength={200}
              placeholder={t('paymentLinks.conceptPlaceholder')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <FiLoader className="animate-spin" /> : <FiPlus />}
            {creating ? t('paymentLinks.creating') : t('paymentLinks.create')}
          </button>
        </div>
        {fieldError ? <p className="text-sm text-rose-600">{fieldError}</p> : null}
      </form>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">{t('paymentLinks.listTitle')}</h3>

        {isLoading ? <p className="text-sm text-slate-500">{t('paymentLinks.loading')}</p> : null}

        {!isLoading && links.length === 0 ? (
          <p className="text-sm text-slate-500">{t('paymentLinks.empty')}</p>
        ) : null}

        {!isLoading && links.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">{t('paymentLinks.colConcept')}</th>
                  <th className="py-2 pr-4">{t('paymentLinks.colAmount')}</th>
                  <th className="py-2 pr-4">{t('paymentLinks.colStatus')}</th>
                  <th className="py-2 pr-4">{t('paymentLinks.colCreated')}</th>
                  <th className="py-2">{t('paymentLinks.colLink')}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="max-w-[260px] py-3 pr-4 text-slate-800">{link.concept}</td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      <span className="font-medium text-slate-900">{USD.format(link.amount_usd)}</span>
                      <span className="ml-2 text-xs text-slate-400">{PYG.format(link.amount_pyg)}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusChipClass(link.status)}`}
                      >
                        {statusLabel[link.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-slate-600">
                      {format(new Date(link.created_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyLink(link.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <FiCopy /> {t('paymentLinks.copy')}
                        </button>
                        <a
                          href={buildPublicPayUrl(link.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                          aria-label={t('paymentLinks.colLink')}
                        >
                          <FiExternalLink />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
