import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { FiArrowLeft, FiInfo } from 'react-icons/fi';
import { fetchUnitStats, type UnitStats } from '../services/unit-stats';

type Status = 'loading' | 'ready' | 'error';

const formatUsd = (n: number): string => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-56 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export default function UnitStatsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const unitId = params.id ?? null;

  const [status, setStatus] = useState<Status>('loading');
  const [stats, setStats] = useState<UnitStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);

    fetchUnitStats(unitId)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : t('unitStats.loadFailed');
        setError(msg);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [unitId, t]);

  if (!unitId) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {t('unitStats.missingId')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/units')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            aria-label={t('unitStats.back')}
          >
            <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {stats?.unit.name ?? t('unitStats.title')}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{t('unitStats.subtitle')}</p>
          </div>
        </div>
        <Link
          to="/units"
          className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 md:inline-block"
        >
          {t('unitStats.allUnits')}
        </Link>
      </div>

      {status === 'error' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error ?? t('unitStats.loadFailed')}
        </div>
      ) : null}

      {status === 'loading' ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-7 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : null}

      {status === 'ready' && stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              label={t('unitStats.totalRevenue')}
              value={formatUsd(stats.totals.revenue)}
              hint={t('unitStats.revenueBreakdown', {
                direct: formatUsd(stats.totals.directRevenue),
                airbnb: formatUsd(stats.totals.airbnbEstimate)
              })}
            />
            <StatCard
              label={t('unitStats.occupancy')}
              value={`${stats.totals.occupancyRate}%`}
              hint={t('unitStats.occupancyBreakdown', {
                occupied: stats.totals.occupiedDays,
                available: stats.totals.availableDays
              })}
            />
            <StatCard
              label={t('unitStats.adr')}
              value={formatUsd(stats.totals.adr)}
              hint={t('unitStats.adrHint')}
            />
            <StatCard
              label={t('unitStats.revPar')}
              value={formatUsd(stats.totals.revPar)}
              hint={t('unitStats.revParHint')}
            />
            <StatCard
              label={t('unitStats.bookings')}
              value={String(stats.totals.bookings)}
              hint={t('unitStats.nights', { count: stats.totals.nights })}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {t('unitStats.revenueChartTitle')}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">{t('unitStats.last12Months')}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600" title={t('unitStats.airbnbEstimateNote')}>
                <FiInfo className="h-3 w-3" aria-hidden="true" />
                {t('unitStats.estimateLegend')}
              </span>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value, name) => [formatUsd(Number(value ?? 0)), String(name)]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="direct"
                    name={t('unitStats.legendDirect')}
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="airbnbEstimate"
                    name={t('unitStats.legendAirbnb')}
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">
              {t('unitStats.occupancyChartTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">{t('unitStats.occupancyChartHint')}</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(value) => [`${Number(value ?? 0)}%`, t('unitStats.occupancy')]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="occupancyRate" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-base font-semibold text-slate-900">
                {t('unitStats.recentBookingsTitle')}
              </h3>
              <span className="text-xs text-slate-500">
                {t('unitStats.recentBookingsCount', { count: stats.recentBookings.length })}
              </span>
            </div>
            {stats.recentBookings.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-slate-500">{t('unitStats.recentBookingsEmpty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('unitStats.colGuest')}</th>
                      <th className="px-4 py-3 font-medium">{t('unitStats.colDates')}</th>
                      <th className="px-4 py-3 font-medium">{t('unitStats.colStatus')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('unitStats.colTotal')}</th>
                      <th className="px-4 py-3 font-medium">{t('unitStats.colCreated')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.recentBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 align-top font-medium text-slate-900">{b.guest_name}</td>
                        <td className="px-4 py-3 align-top text-slate-700">
                          {b.check_in_date} <span className="text-slate-400">to</span> {b.check_out_date}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-right font-medium text-slate-900">
                          {formatUsd(b.total_price_usd)}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-slate-500">
                          {format(parseISO(b.created_at), i18n.language === 'es' ? 'dd MMM yyyy' : 'MMM dd, yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {status === 'loading' ? (
        <>
          <ChartSkeleton />
          <ChartSkeleton />
        </>
      ) : null}
    </div>
  );
}
