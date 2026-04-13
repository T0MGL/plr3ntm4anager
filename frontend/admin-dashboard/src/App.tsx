import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FiCalendar, FiCompass, FiCreditCard, FiHome, FiRefreshCw } from 'react-icons/fi';
import Login from './components/Auth/Login';
import AppLayout from './components/layout/AppLayout';
import type { LayoutNavItem } from './components/layout/types';
import Dashboard from './pages/Dashboard';
import Units from './pages/Units';
import Bookings from './pages/Bookings';
import Sync from './pages/Sync';
import Payments from './pages/Payments';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setAuthToken } from './utils/api';

const navItems: LayoutNavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: FiHome,
    title: 'Operations Overview',
    description: 'Monitor platform performance, unit health, and latest activity.',
  },
  {
    label: 'Units',
    path: '/units',
    icon: FiCompass,
    title: 'Unit Management',
    description: 'Create, update, and maintain listing inventory with confidence.',
  },
  {
    label: 'Bookings',
    path: '/bookings',
    icon: FiCalendar,
    title: 'Booking Pipeline',
    description: 'Review reservations, guest details, and upcoming check-ins.',
  },
  {
    label: 'Sync',
    path: '/sync',
    icon: FiRefreshCw,
    title: 'Sync Center',
    description: 'Keep availability synchronized across Airbnb and connected calendars.',
  },
  {
    label: 'Payments',
    path: '/payments',
    icon: FiCreditCard,
    title: 'Payments & Reconciliation',
    description: 'Track payouts and maintain accurate financial records.',
  },
];

const routes = [
  { path: '/', element: <Dashboard /> },
  { path: '/units', element: <Units /> },
  { path: '/bookings', element: <Bookings /> },
  { path: '/sync', element: <Sync /> },
  { path: '/payments', element: <Payments /> },
] as const;

const missingEnv: string[] = [];
if (!import.meta.env.VITE_API_URL) missingEnv.push('VITE_API_URL');
if (!import.meta.env.VITE_SUPABASE_URL) missingEnv.push('VITE_SUPABASE_URL');
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) missingEnv.push('VITE_SUPABASE_ANON_KEY');

function Shell() {
  const { user, session, loading, signOut } = useAuth();

  useEffect(() => {
    setAuthToken(session?.access_token ?? null);
  }, [session]);

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
