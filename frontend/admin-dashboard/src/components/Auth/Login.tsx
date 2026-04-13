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
          <div className="login-badge">Airbnb Admin</div>
          <h1 className="login-title">
            Manage bookings with confidence and a calm, focused workspace.
          </h1>
          <p className="login-subtitle">
            Keep listings, reservations, and payments in sync across your portfolio.
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

          <div className="login-panel-card">
            <div className="login-panel-dot" />
            <div>
              <p className="text-sm font-semibold">Hosting Ops</p>
              <p className="text-sm text-black/60">Smart alerts for cancellations and overlaps.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-area">
        <div className="login-card">
          <div className="login-card-header">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">Secure access</p>
              <h2 className="text-2xl font-semibold">Sign in to Admin</h2>
              <p className="text-sm text-black/60 mt-2">
                Use your admin credentials to continue.
              </p>
            </div>
            <div className="login-brand-dot" />
          </div>

          <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="login-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                {...register('email')}
                className="login-input"
                placeholder="admin@stayhub.com"
                autoComplete="email"
              />
              {errors.email && <p className="login-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="login-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                {...register('password')}
                type="password"
                className="login-input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && <p className="login-error">{errors.password.message}</p>}
            </div>
            <button className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="login-footer">
            <span className="login-footer-dot" />
            Security-first access for operations teams.
          </div>
        </div>
      </div>
    </div>
  );
}
