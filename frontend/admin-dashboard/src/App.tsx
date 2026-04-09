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
    label: 'Panel',
    path: '/',
    icon: FiHome,
    title: 'Resumen operativo',
    description: 'Monitorea el desempeno general, estado de los lofts y ultima actividad.',
  },
  {
    label: 'Lofts',
    path: '/units',
    icon: FiCompass,
    title: 'Gestion de lofts',
    description: 'Crea, edita y mantiene el inventario publicado con confianza.',
  },
  {
    label: 'Reservas',
    path: '/bookings',
    icon: FiCalendar,
    title: 'Pipeline de reservas',
    description: 'Revisa solicitudes, detalles de huespedes y proximos check-ins.',
  },
  {
    label: 'Sync',
    path: '/sync',
    icon: FiRefreshCw,
    title: 'Centro de sincronizacion',
    description: 'Manten la disponibilidad sincronizada con Airbnb y calendarios externos.',
  },
  {
    label: 'Pagos',
    path: '/payments',
    icon: FiCreditCard,
    title: 'Pagos y conciliacion',
    description: 'Controla las transacciones Bancard y los registros financieros.',
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
      <div className="min-h-screen bg-cream p-6 text-charcoal">
        <div className="mx-auto max-w-2xl border border-stone bg-cream-50 p-8">
          <span className="inline-block text-[0.625rem] uppercase tracking-[0.25em] text-gold">
            Configuracion
          </span>
          <h1 className="mt-4 font-display text-3xl text-charcoal">
            Panel no configurado
          </h1>
          <p className="mt-4 text-sm text-charcoal-500">
            Faltan variables de entorno en
            <span className="font-medium"> frontend/admin-dashboard/.env</span>:
          </p>
          <ul className="mt-3 list-disc pl-5 text-sm text-charcoal-500">
            {missingEnv.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-charcoal-500">Cargando...</div>;
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
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#F6F2EC',
              border: '1px solid #C4A96B',
              borderRadius: 0,
              fontSize: '0.8125rem',
              letterSpacing: '0.02em',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
