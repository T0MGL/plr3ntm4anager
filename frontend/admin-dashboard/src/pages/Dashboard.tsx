import React, { useEffect, useState } from 'react';
import { FiActivity, FiClock, FiInbox, FiTrendingUp } from 'react-icons/fi';
import { api } from '../utils/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const revenueData = [
  { name: 'Jan', revenue: 4000 },
  { name: 'Feb', revenue: 3000 },
  { name: 'Mar', revenue: 5000 },
  { name: 'Apr', revenue: 4500 },
  { name: 'May', revenue: 6000 },
  { name: 'Jun', revenue: 8500 },
  { name: 'Jul', revenue: 12000 },
  { name: 'Aug', revenue: 15000 },
  { name: 'Sep', revenue: 11000 },
  { name: 'Oct', revenue: 9500 },
  { name: 'Nov', revenue: 14000 },
  { name: 'Dec', revenue: 18200 },
];

const occupancyData = [
  { name: 'Mon', value: 85 },
  { name: 'Tue', value: 78 },
  { name: 'Wed', value: 82 },
  { name: 'Thu', value: 90 },
  { name: 'Fri', value: 95 },
  { name: 'Sat', value: 98 },
  { name: 'Sun', value: 92 },
];

export default function Dashboard() {
  const [activeUnits, setActiveUnits] = useState<number>(0);
  const [upcomingCheckins, setUpcomingCheckins] = useState<number>(0);
  const [thisMonthRevenue, setThisMonthRevenue] = useState<string>('$0');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch Units
        const unitsRes = await api.get('/admin/units');
        if (Array.isArray(unitsRes.data)) {
          setActiveUnits(unitsRes.data.length);
        }

        // Fetch Booking Requests (Pending/Approved)
        const bookingsRes = await api.get('/admin/booking-requests?status=approved');
        if (bookingsRes.data && typeof bookingsRes.data.count === 'number') {
          setUpcomingCheckins(bookingsRes.data.count);
        }

        // Fetch Payments for Revenue
        const paymentsRes = await api.get('/admin/payments?status=paid');
        if (Array.isArray(paymentsRes.data)) {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const monthlyRevenue = paymentsRes.data.reduce((acc: number, payment: any) => {
            const paymentDate = new Date(payment.created_at);
            if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
              return acc + Number(payment.amount_total || 0);
            }
            return acc;
          }, 0);

          setThisMonthRevenue(`$${(monthlyRevenue / 100).toLocaleString()}k`);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      }
    };

    fetchDashboardData();
  }, []);

  const stats = [
    { label: 'Active units', value: activeUnits.toString(), icon: FiActivity },
    { label: 'Upcoming check-ins', value: upcomingCheckins.toString(), icon: FiClock },
    { label: 'This month revenue', value: thisMonthRevenue, icon: FiTrendingUp },
  ];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Operations Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor performance metrics, upcoming check-ins, and operational activity.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Export PDF
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800">
            New Listing
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                  <Icon aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
            </article>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Revenue Analysis</h3>
            <select className="text-sm border-none bg-transparent font-medium text-slate-500 focus:ring-0 cursor-pointer">
              <option>Last 12 months</option>
              <option>Last 6 months</option>
              <option>Last 30 days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
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
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '14px'
                  }}
                  formatter={(value: any) => [`$${(Number(value) || 0).toLocaleString()}`, 'Revenue']}
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

        {/* Occupancy Chart */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Weekly Occupancy</h3>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-slate-900" />
              <span className="text-sm font-medium text-slate-500">Average 88%</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
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
                    fontSize: '14px'
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

      <section className="card p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <FiInbox aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">No recent activity</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          New sync events, booking alerts, and operational notifications will appear here once data flows in.
        </p>
      </section>
    </div>
  );
}

