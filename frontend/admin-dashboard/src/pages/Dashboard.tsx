import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiActivity,
  FiAlertCircle,
  FiAlertOctagon,
  FiArrowUpRight,
  FiClock,
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

interface MonthlyRevenue { name: string; revenue: number }
interface WeeklyOccupancy { name: string; value: number }

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
  const [pendingReview, setPendingReview] = useState(0);
  const [revenueData, setRevenueData] = useState<MonthlyRevenue[]>([]);
  const [occupancyData, setOccupancyData] = useState<WeeklyOccupancy[]>([]);
  const [avgOccupancy, setAvgOccupancy] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const [unitsRes, bookingsRes, paymentsRes, statsRes] = await Promise.all([
        api.get('/admin/units'),
        api.get('/admin/booking-requests', { params: { limit: 300 } }),
        api.get('/admin/payments', { params: { status: 'completed', limit: 500 } }),
        api.get('/admin/dashboard-stats'),
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

      const payments: any[] = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];

      const thisMonth = payments.reduce((acc, p) => {
        const d = new Date(p.created_at);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          return acc + Number(p.amount_usd ?? 0);
        }
        return acc;
      }, 0);

      const prevMonthTotal = payments.reduce((acc, p) => {
        const d = new Date(p.created_at);
        if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
          return acc + Number(p.amount_usd ?? 0);
        }
        return acc;
      }, 0);

      setThisMonthRevenue(thisMonth);
      setPrevMonthRevenue(prevMonthTotal);

      if (Array.isArray(statsRes.data?.monthlyRevenue)) {
        setRevenueData(statsRes.data.monthlyRevenue);
      }
      if (Array.isArray(statsRes.data?.weeklyOccupancy)) {
        setOccupancyData(statsRes.data.weeklyOccupancy);
        setAvgOccupancy(statsRes.data.avgOccupancy ?? 0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setFetchError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  const formatRevenue = (amount: number) => {
    if (amount === 0) return '$0';
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  const revenueDelta =
    prevMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
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
            onClick={() => void fetchDashboardData()}
            className="text-sm font-medium text-rose-600 hover:underline"
          >
            Retry
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
            <p className="mt-1 text-xs text-slate-400">All properties</p>
          </article>

          <article className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{t('dashboard.upcomingCheckins')}</p>
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <FiClock aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              {upcomingCheckins}
            </p>
            <p className="mt-1 text-xs text-slate-400">Approved, from today</p>
          </article>

          <article className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{t('dashboard.thisMonthRevenue')}</p>
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <FiTrendingUp aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              {formatRevenue(thisMonthRevenue)}
            </p>
            {revenueDelta !== null ? (
              <p
                className={`mt-1 text-xs font-medium ${
                  revenueDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {revenueDelta >= 0 ? '+' : ''}
                {revenueDelta}% vs last month
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">No data last month</p>
            )}
          </article>

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
                Pending review
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
              {hasPendingReview ? 'Action required' : 'All clear'}
              <FiArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </p>
          </article>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">{t('dashboard.revenueAnalysis')}</h3>
            <select className="text-sm border-none bg-transparent font-medium text-slate-500 focus:ring-0 cursor-pointer no-print">
              <option>{t('dashboard.last12Months')}</option>
              <option>{t('dashboard.last6Months')}</option>
              <option>{t('dashboard.last30Days')}</option>
            </select>
          </div>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  tickFormatter={(value) => formatRevenue(value)}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '14px',
                  }}
                  formatter={(value: any) => [
                    `$${(Number(value) || 0).toLocaleString()}`,
                    'Revenue',
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
                {isLoading ? 'Calculating...' : `Average ${avgOccupancy}%`}
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
