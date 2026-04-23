import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiActivity,
  FiAlertCircle,
  FiAlertOctagon,
  FiArrowUpRight,
  FiClock,
  FiInfo,
  FiTrendingUp,
} from 'react-icons/fi';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import CreationFlow from '../components/creation/creation/CreationFlow';
import { CreationProvider } from '../context/CreationContext';
import { api } from '../utils/api';

interface RevenuePoint { name: string; revenue: number; airbnbEstimate: number; bucket?: 'day' | 'month' }
interface WeeklyOccupancy { name: string; value: number }

type RangeKey = '7d' | '1m' | '6m' | '1y';

const RANGE_STORAGE_KEY = 'pl-admin-dashboard-range';
const RANGES: RangeKey[] = ['7d', '1m', '6m', '1y'];
const RANGE_LABEL_KEY: Record<RangeKey, string> = {
  '7d': 'dashboard.last7Days',
  '1m': 'dashboard.last30Days',
  '6m': 'dashboard.last6Months',
  '1y': 'dashboard.last12Months',
};

function readInitialRange(): RangeKey {
  if (typeof window === 'undefined') return '1y';
  const raw = window.localStorage.getItem(RANGE_STORAGE_KEY);
  if (raw === '7d' || raw === '1m' || raw === '6m' || raw === '1y') return raw;
  return '1y';
}

function StatSkeleton() {
  return (
    <article className="card p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="h-8 w-8 rounded-lg bg-slate-200" />
      </div>
      <div className="mt-4 h-9 w-20 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
    </article>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeUnits, setActiveUnits] = useState(0);
  const [upcomingCheckins, setUpcomingCheckins] = useState(0);
  const [thisMonthRevenue, setThisMonthRevenue] = useState(0);
  const [prevMonthRevenue, setPrevMonthRevenue] = useState(0);
  const [thisMonthAirbnbEstimate, setThisMonthAirbnbEstimate] = useState(0);
  const [prevMonthAirbnbEstimate, setPrevMonthAirbnbEstimate] = useState(0);
  const [thisMonthDirectBookingCount, setThisMonthDirectBookingCount] = useState(0);
  const [thisMonthAirbnbNights, setThisMonthAirbnbNights] = useState(0);
  const [thisMonthAirbnbMinRate, setThisMonthAirbnbMinRate] = useState(0);
  const [thisMonthAirbnbMaxRate, setThisMonthAirbnbMaxRate] = useState(0);
  const [pendingReview, setPendingReview] = useState(0);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [revenueBucket, setRevenueBucket] = useState<'day' | 'month'>('month');
  const [range, setRange] = useState<RangeKey>(readInitialRange);
  const [occupancyData, setOccupancyData] = useState<WeeklyOccupancy[]>([]);
  const [avgOccupancy, setAvgOccupancy] = useState(0);
  const [airbnbUpcomingCheckins, setAirbnbUpcomingCheckins] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchDashboardData = async (activeRange: RangeKey) => {
    try {
      setIsLoading(true);
      setFetchError(null);

      // "Today" for client-side filters. The server does the authoritative
      // Paraguay-anchored math, this is only used for the upcoming filter
      // against check_in_date on rows that have already been sent.
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Asuncion' });

      // Revenue figures (this/prev month, direct + Airbnb estimate) come from
      // /admin/dashboard-stats so they stay consistent with the chart buckets
      // and are not capped by the /admin/payments row limit.
      const [unitsRes, bookingsRes, statsRes] = await Promise.all([
        api.get('/admin/units'),
        api.get('/admin/booking-requests', { params: { limit: 300 } }),
        api.get('/admin/dashboard-stats', { params: { range: activeRange } }),
      ]);

      if (Array.isArray(unitsRes.data)) {
        setActiveUnits(unitsRes.data.length);
      }

      const bookings: any[] = bookingsRes.data?.data ?? [];

      const upcoming = bookings.filter(
        (b) => (b.status === 'approved' || b.status === 'paid') && b.check_in_date >= today,
      );
      setUpcomingCheckins(upcoming.length);

      const needsReview = bookings.filter(
        (b) => b.status === 'pending' && b.approval_path === 'manual',
      );
      setPendingReview(needsReview.length);

      const stats = statsRes.data ?? {};

      if (Array.isArray(stats.series) && stats.series.length > 0) {
        setRevenueData(stats.series);
        if (stats.bucket === 'day' || stats.bucket === 'month') {
          setRevenueBucket(stats.bucket);
        }
      } else if (Array.isArray(stats.monthlyRevenue)) {
        // Back-compat for older backend deploys.
        setRevenueData(stats.monthlyRevenue);
        setRevenueBucket('month');
      }
      if (Array.isArray(stats.weeklyOccupancy)) {
        setOccupancyData(stats.weeklyOccupancy);
        setAvgOccupancy(stats.avgOccupancy ?? 0);
      }
      if (typeof stats.airbnbUpcomingCheckins === 'number') {
        setAirbnbUpcomingCheckins(stats.airbnbUpcomingCheckins);
      }
      if (typeof stats.thisMonthRevenue === 'number') {
        setThisMonthRevenue(stats.thisMonthRevenue);
      }
      if (typeof stats.prevMonthRevenue === 'number') {
        setPrevMonthRevenue(stats.prevMonthRevenue);
      }
      if (typeof stats.thisMonthAirbnbEstimate === 'number') {
        setThisMonthAirbnbEstimate(stats.thisMonthAirbnbEstimate);
      }
      if (typeof stats.prevMonthAirbnbEstimate === 'number') {
        setPrevMonthAirbnbEstimate(stats.prevMonthAirbnbEstimate);
      }
      if (typeof stats.thisMonthDirectBookingCount === 'number') {
        setThisMonthDirectBookingCount(stats.thisMonthDirectBookingCount);
      }
      if (typeof stats.thisMonthAirbnbNights === 'number') {
        setThisMonthAirbnbNights(stats.thisMonthAirbnbNights);
      }
      if (typeof stats.thisMonthAirbnbMinRate === 'number') {
        setThisMonthAirbnbMinRate(stats.thisMonthAirbnbMinRate);
      }
      if (typeof stats.thisMonthAirbnbMaxRate === 'number') {
        setThisMonthAirbnbMaxRate(stats.thisMonthAirbnbMaxRate);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setFetchError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData(range);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RANGE_STORAGE_KEY, range);
    }
  }, [range]);

  const formatRevenue = (amount: number) => {
    if (amount === 0) return '$0';
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  const formatMoney = (amount: number) =>
    `$${Math.round(amount).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  const combinedThisMonth = thisMonthRevenue + thisMonthAirbnbEstimate;
  const combinedPrevMonth = prevMonthRevenue + prevMonthAirbnbEstimate;

  const revenueDelta =
    combinedPrevMonth > 0
      ? Math.round(((combinedThisMonth - combinedPrevMonth) / combinedPrevMonth) * 100)
      : null;

  const handleExportPDF = () => {
    window.print();
  };

  const hasPendingReview = pendingReview > 0;

  return (
    <div className="space-y-6">
      {fetchError && !isLoading ? (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <FiAlertCircle className="shrink-0 text-rose-500" />
          <p className="flex-1 text-sm text-rose-700">{fetchError}</p>
          <button
            onClick={() => void fetchDashboardData(range)}
            className="text-sm font-medium text-rose-600 hover:underline"
          >
            {t('dashboard.retry')}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{t('dashboard.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            {t('dashboard.exportPdf')}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
          >
            {t('dashboard.newListing')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{t('dashboard.activeUnits')}</p>
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <FiActivity aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              {activeUnits}
            </p>
            <p className="mt-1 text-xs text-slate-400">{t('dashboard.allProperties')}</p>
          </article>

          <article className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{t('dashboard.upcomingCheckins')}</p>
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <FiClock aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              {upcomingCheckins + airbnbUpcomingCheckins}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {airbnbUpcomingCheckins > 0
                ? t('dashboard.upcomingCheckinsBreakdown', {
                    direct: upcomingCheckins,
                    airbnb: airbnbUpcomingCheckins,
                  })
                : t('dashboard.upcomingCheckinsDefault')}
            </p>
          </article>

          <div className="relative group">
            <article
              tabIndex={0}
              aria-describedby="revenue-breakdown"
              className="card p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{t('dashboard.thisMonthRevenue')}</p>
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                  <FiTrendingUp aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                {formatRevenue(combinedThisMonth)}
              </p>
              {revenueDelta !== null ? (
                <p
                  className={`mt-1 text-xs font-medium ${
                    revenueDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {revenueDelta >= 0 ? '+' : ''}
                  {revenueDelta}% {t('dashboard.revenueDeltaVsLastMonth')}
                  {thisMonthAirbnbEstimate > 0 ? ` ${t('dashboard.revenueDeltaEstimateSuffix')}` : ''}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  {thisMonthAirbnbEstimate > 0
                    ? t('dashboard.revenueAirbnbEstFallback', {
                        amount: formatRevenue(thisMonthAirbnbEstimate),
                      })
                    : t('dashboard.revenueNoDataLastMonth')}
                </p>
              )}
            </article>
            <div
              id="revenue-breakdown"
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 translate-y-1 rounded-xl border border-slate-200 bg-white p-4 text-left opacity-0 shadow-[0_20px_40px_-12px_rgba(15,23,42,0.18)] transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 no-print"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('dashboard.revenueBreakdownTitle')}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t('dashboard.revenueBreakdownFormula')}</p>

              <div className="mt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {t('dashboard.revenueBreakdownDirect')}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {thisMonthDirectBookingCount > 0
                        ? t('dashboard.revenueBreakdownDirectDetail', {
                            count: thisMonthDirectBookingCount,
                          })
                        : t('dashboard.revenueBreakdownDirectEmpty')}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                    {formatMoney(thisMonthRevenue)}
                  </p>
                </div>

                <div className="flex items-start justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {t('dashboard.revenueBreakdownAirbnb')}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {thisMonthAirbnbNights > 0
                        ? `${t('dashboard.revenueBreakdownAirbnbNights', {
                            count: thisMonthAirbnbNights,
                          })} · ${
                            thisMonthAirbnbMinRate === thisMonthAirbnbMaxRate
                              ? t('dashboard.revenueBreakdownAirbnbRateSingle', {
                                  rate: formatMoney(thisMonthAirbnbMinRate),
                                })
                              : t('dashboard.revenueBreakdownAirbnbRateRange', {
                                  min: formatMoney(thisMonthAirbnbMinRate),
                                  max: formatMoney(thisMonthAirbnbMaxRate),
                                })
                          }`
                        : t('dashboard.revenueBreakdownAirbnbEmpty')}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                    {formatMoney(thisMonthAirbnbEstimate)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {t('dashboard.revenueBreakdownTotal')}
                  </p>
                  <p className="text-base font-semibold tabular-nums text-slate-900">
                    {formatMoney(combinedThisMonth)}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                {t('dashboard.revenueBreakdownNote')}
              </p>
            </div>
          </div>

          <article
            onClick={() => navigate('/bookings')}
            className={`card p-5 cursor-pointer transition-colors ${
              hasPendingReview
                ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <p
                className={`text-sm font-medium ${
                  hasPendingReview ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                {t('dashboard.pendingReview')}
              </p>
              <span
                className={`rounded-lg p-2 ${
                  hasPendingReview ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <FiAlertOctagon aria-hidden="true" />
              </span>
            </div>
            <p
              className={`mt-4 text-3xl font-semibold tracking-tight ${
                hasPendingReview ? 'text-amber-900' : 'text-slate-900'
              }`}
            >
              {pendingReview}
            </p>
            <p
              className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                hasPendingReview ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              {hasPendingReview
                ? t('dashboard.pendingReviewActionRequired')
                : t('dashboard.pendingReviewAllClear')}
              <FiArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </p>
          </article>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-semibold text-slate-900">{t('dashboard.revenueAnalysis')}</h3>
              <span
                title={t('dashboard.revenueAnalysisTooltip')}
                className="text-slate-400 hover:text-slate-600 cursor-help"
                aria-label={t('dashboard.revenueAnalysisTooltip')}
              >
                <FiInfo className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="radiogroup"
                aria-label={t('dashboard.rangeControlLabel')}
                className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs no-print"
              >
                {RANGES.map((key) => {
                  const isActive = range === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setRange(key)}
                      className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {t(RANGE_LABEL_KEY[key])}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-900" />
                  {t('dashboard.revenueChartDirectLegend')}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400 opacity-60" />
                  {t('dashboard.revenueChartAirbnbLegend')}
                </span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAirbnb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  dy={10}
                  interval={
                    revenueBucket === 'day' && revenueData.length > 10
                      ? Math.max(0, Math.ceil(revenueData.length / 6) - 1)
                      : 0
                  }
                  minTickGap={revenueBucket === 'day' ? 16 : 0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => formatRevenue(value)}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '14px',
                  }}
                  formatter={(value: any, name: any) => [
                    `$${(Number(value) || 0).toLocaleString()}`,
                    name === 'airbnbEstimate'
                      ? t('dashboard.revenueChartAirbnbTooltip')
                      : t('dashboard.revenueChartDirectTooltip'),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0f172a"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
                <Area
                  type="monotone"
                  dataKey="airbnbEstimate"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  fillOpacity={1}
                  fill="url(#colorAirbnb)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">{t('dashboard.weeklyOccupancy')}</h3>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-slate-900" />
              <span className="text-sm font-medium text-slate-500">
                {isLoading
                  ? t('dashboard.occupancyCalculating')
                  : t('dashboard.occupancyAverage', { value: avgOccupancy })}
              </span>
            </div>
          </div>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <BarChart data={occupancyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '14px',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {occupancyData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={index > 3 ? '#0f172a' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {showCreateModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 no-print"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="relative h-[86vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#ebebeb] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.16)] sm:h-[88vh] lg:h-[84vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <CreationProvider>
              <CreationFlow
                mode="admin-unit"
                onClose={() => setShowCreateModal(false)}
                unitDraft={null}
              />
            </CreationProvider>
          </div>
        </div>
      ) : null}
    </div>
  );
}
