import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type FormValues = z.infer<typeof formSchema>;

export default function Login() {
  const { signIn } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = async (values: FormValues) => {
    await signIn(values.email, values.password);
  };

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-panel-inner">
          <LoginBrandmark />

          <h1 className="login-title">
            Operaciones que mantienen cada loft impecable.
          </h1>
          <p className="login-subtitle">
            Gestion de reservas, pagos Bancard y sincronizacion de disponibilidad en un solo lugar.
          </p>

          <div className="login-stats">
            <div>
              <p className="login-stat-value">98%</p>
              <p className="login-stat-label">Payout accuracy</p>
            </div>
            <div>
              <p className="login-stat-value">24/7</p>
              <p className="login-stat-label">Calendar sync</p>
            </div>
            <div>
              <p className="login-stat-value">1 dashboard</p>
              <p className="login-stat-label">For all listings</p>
            </div>
          </div>

          <div className="login-integrations">
            <span className="login-integrations-label">Integraciones</span>
            <div className="login-integrations-row">
              <span className="login-chip">Bancard</span>
              <span className="login-chip">Airbnb</span>
              <span className="login-chip">Booking</span>
              <span className="login-chip">WhatsApp</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-area">
        <div className="login-card">
          <div className="login-card-header">
            <div>
              <p className="login-eyebrow">Secure access</p>
              <h2 className="login-card-title">Ingresar al Admin</h2>
              <p className="login-card-sub">
                Usa tus credenciales para continuar.
              </p>
            </div>
            <div className="login-brand-mark">
              <img
                src="https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/park-lofts-logogold.png"
                alt=""
                aria-hidden
              />
            </div>
          </div>

          <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="login-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                {...register('email')}
                className="login-input"
                placeholder="admin@parklofts.py"
                autoComplete="email"
              />
              {errors.email && <p className="login-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="login-label" htmlFor="password">
                Contrasena
              </label>
              <input
                id="password"
                {...register('password')}
                type="password"
                className="login-input"
                placeholder="********"
                autoComplete="current-password"
              />
              {errors.password && <p className="login-error">{errors.password.message}</p>}
            </div>
            <button className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="login-footer">
            <span className="login-footer-dot" />
            Acceso restringido al equipo de operaciones.
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginBrandmark() {
  return (
    <div className="login-brand-lockup" aria-label="Park Lofts Rent">
      <img
        src="https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/park-lofts-logogold.png"
        alt=""
        aria-hidden
      />
      <span className="login-brand-wordmark">Park Lofts</span>
      <span className="login-brand-divider" aria-hidden />
      <span className="login-brand-sub">Rent</span>
    </div>
  );
}
