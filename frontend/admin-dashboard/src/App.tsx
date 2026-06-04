import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FiCalendar, FiCompass, FiCreditCard, FiHome, FiLink, FiRefreshCw, FiSettings } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import Login from './components/Auth/Login';
import AppLayout from './components/layout/AppLayout';
import type { LayoutNavItem } from './components/layout/types';
import Dashboard from './pages/Dashboard';
import Units from './pages/Units';
import UnitStats from './pages/UnitStats';
import Bookings from './pages/Bookings';
import Sync from './pages/Sync';
import Payments from './pages/Payments';
import PaymentLinks from './pages/PaymentLinks';
import Settings from './pages/Settings';
import { AuthProvider, useAuth } from './context/AuthContext';

const routes = [
  { path: '/', element: <Dashboard /> },
  { path: '/units', element: <Units /> },
  { path: '/units/:id/stats', element: <UnitStats /> },
  { path: '/bookings', element: <Bookings /> },
  { path: '/sync', element: <Sync /> },
  { path: '/payments', element: <Payments /> },
  { path: '/payment-links', element: <PaymentLinks /> },
  { path: '/settings', element: <Settings /> },
] as const;

const missingEnv: string[] = [];
if (!import.meta.env.VITE_API_URL) missingEnv.push('VITE_API_URL');
if (!import.meta.env.VITE_SUPABASE_URL) missingEnv.push('VITE_SUPABASE_URL');
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) missingEnv.push('VITE_SUPABASE_ANON_KEY');

function Shell() {
  const { user, loading, signOut } = useAuth();
  const { t } = useTranslation();

  const navItems: LayoutNavItem[] = [
    {
      label: t('nav.dashboard'),
      path: '/',
      icon: FiHome,
      title: t('nav.operationsOverview'),
      description: t('nav.operationsOverviewDesc'),
    },
    {
      label: t('nav.units'),
      path: '/units',
      icon: FiCompass,
      title: t('nav.unitManagement'),
      description: t('nav.unitManagementDesc'),
    },
    {
      label: t('nav.bookings'),
      path: '/bookings',
      icon: FiCalendar,
      title: t('nav.bookingPipeline'),
      description: t('nav.bookingPipelineDesc'),
    },
    {
      label: t('nav.sync'),
      path: '/sync',
      icon: FiRefreshCw,
      title: t('nav.syncCenter'),
      description: t('nav.syncCenterDesc'),
    },
    {
      label: t('nav.payments'),
      path: '/payments',
      icon: FiCreditCard,
      title: t('nav.paymentsReconciliation'),
      description: t('nav.paymentsReconciliationDesc'),
    },
    {
      label: t('nav.paymentLinks'),
      path: '/payment-links',
      icon: FiLink,
      title: t('nav.paymentLinksTitle'),
      description: t('nav.paymentLinksDesc'),
    },
    {
      label: t('nav.settings'),
      path: '/settings',
      icon: FiSettings,
      title: t('nav.settingsTitle'),
      description: t('nav.settingsDesc'),
    },
  ];

  if (missingEnv.length > 0) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-2xl font-semibold">Admin dashboard is not configured</h1>
          <p className="mb-4 text-sm text-slate-600">
            The following environment variables are missing in
            <span className="font-semibold"> frontend/admin-dashboard/.env</span>:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {missingEnv.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-slate-600">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AppLayout items={navItems} userEmail={user.email} onSignOut={signOut}>
      <Routes>
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
