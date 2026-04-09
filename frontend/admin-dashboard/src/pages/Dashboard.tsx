import { useEffect, useState } from 'react';
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
  Cell,
} from 'recharts';

interface PaymentRow {
  created_at?: string;
  amount_total?: number;
  amount_usd?: number;
}

const emptyRevenueData = [
  { name: 'Ene', revenue: 0 },
  { name: 'Feb', revenue: 0 },
  { name: 'Mar', revenue: 0 },
  { name: 'Abr', revenue: 0 },
  { name: 'May', revenue: 0 },
  { name: 'Jun', revenue: 0 },
  { name: 'Jul', revenue: 0 },
  { name: 'Ago', revenue: 0 },
  { name: 'Sep', revenue: 0 },
  { name: 'Oct', revenue: 0 },
  { name: 'Nov', revenue: 0 },
  { name: 'Dic', revenue: 0 },
];

const emptyOccupancyData = [
  { name: 'Lun', value: 0 },
  { name: 'Mar', value: 0 },
  { name: 'Mie', value: 0 },
  { name: 'Jue', value: 0 },
  { name: 'Vie', value: 0 },
  { name: 'Sab', value: 0 },
  { name: 'Dom', value: 0 },
];

export default function Dashboard() {
  const [activeUnits, setActiveUnits] = useState<number>(0);
  const [upcomingCheckins, setUpcomingCheckins] = useState<number>(0);
  const [thisMonthRevenue, setThisMonthRevenue] = useState<string>('$0');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const unitsRes = await api.get('/admin/units');
        if (Array.isArray(unitsRes.data)) {
          setActiveUnits(unitsRes.data.length);
        }

        const bookingsRes = await api.get('/admin/booking-requests?status=approved');
        if (bookingsRes.data && typeof bookingsRes.data.count === 'number') {
          setUpcomingCheckins(bookingsRes.data.count);
        }

        const paymentsRes = await api.get('/admin/payments?status=paid');
        if (Array.isArray(paymentsRes.data)) {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const monthlyRevenue = (paymentsRes.data as PaymentRow[]).reduce((acc, payment) => {
            const createdAt = payment.created_at ? new Date(payment.created_at) : null;
            if (!createdAt) return acc;
            if (createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear) {
              const value = Number(payment.amount_total ?? payment.amount_usd ?? 0);
              return acc + value;
            }
            return acc;
          }, 0);

          setThisMonthRevenue(`$${monthlyRevenue.toLocaleString('es-PY')}`);
        }
      } catch (err) {
        console.error('Error al cargar el dashboard:', err);
      }
    };

    void fetchDashboardData();
  }, []);

  const stats = [
    { label: 'Lofts activos', value: activeUnits.toString(), icon: FiActivity },
    { label: 'Proximos check-ins', value: upcomingCheckins.toString(), icon: FiClock },
    { label: 'Ingresos del mes', value: thisMonthRevenue, icon: FiTrendingUp },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="text-[0.625rem] uppercase tracking-[0.25em] text-gold">Resumen</span>
          <h2 className="mt-3 font-display text-4xl text-charcoal md:text-5xl">
            Operaciones Park Lofts
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-charcoal-500">
            Monitorea el rendimiento, los proximos check-ins y la actividad operativa en una vista clara y accionable.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="border border-stone bg-cream-50 p-6 transition-colors hover:border-gold/60"
            >
              <div className="flex items-center justify-between">
                <p className="text-[0.625rem] uppercase tracking-[0.25em] text-charcoal-400">
                  {item.label}
                </p>
                <span className="flex h-10 w-10 items-center justify-center border border-charcoal/20 text-charcoal">
                  <Icon aria-hidden="true" />
                </span>
              </div>
              <p className="mt-6 font-display text-4xl text-charcoal">{item.value}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-stone bg-cream-50 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <span className="text-[0.625rem] uppercase tracking-[0.25em] text-gold">Ingresos</span>
              <h3 className="mt-2 font-display text-2xl text-charcoal">Evolucion anual</h3>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={emptyRevenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C4A96B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C4A96B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DDD4" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6B6B6B' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6B6B6B' }}
                  tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A1A',
                    border: '1px solid #C4A96B',
                    borderRadius: 0,
                    color: '#F6F2EC',
                    fontSize: '12px',
                    letterSpacing: '0.02em',
                  }}
                  formatter={(value: unknown) => [`$${Number(value ?? 0).toLocaleString('es-PY')}`, 'Ingresos']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#C4A96B"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="border border-stone bg-cream-50 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <span className="text-[0.625rem] uppercase tracking-[0.25em] text-gold">Ocupacion</span>
              <h3 className="mt-2 font-display text-2xl text-charcoal">Semana actual</h3>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emptyOccupancyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DDD4" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6B6B6B' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6B6B6B' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  cursor={{ fill: '#EDE5D8' }}
                  contentStyle={{
                    backgroundColor: '#1A1A1A',
                    border: '1px solid #C4A96B',
                    borderRadius: 0,
                    color: '#F6F2EC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value">
                  {emptyOccupancyData.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index > 4 ? '#1A1A1A' : '#C4A96B'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="border border-stone bg-cream-50 p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-charcoal/20 text-charcoal">
          <FiInbox aria-hidden="true" />
        </div>
        <h3 className="mt-5 font-display text-2xl text-charcoal">Sin actividad reciente</h3>
        <p className="mx-auto mt-3 max-w-md text-sm text-charcoal-500">
          Las sincronizaciones, alertas de reservas y notificaciones operativas apareceran aqui en cuanto empiecen a llegar datos.
        </p>
      </section>
    </div>
  );
}
