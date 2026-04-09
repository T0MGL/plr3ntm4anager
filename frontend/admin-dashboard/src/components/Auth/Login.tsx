import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';

const formSchema = z.object({
  email: z.string().email('Correo invalido.'),
  password: z.string().min(6, 'Minimo 6 caracteres.'),
});

type FormValues = z.infer<typeof formSchema>;

export default function Login() {
  const { signIn } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = async (values: FormValues) => {
    await signIn(values.email, values.password);
  };

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="login-badge">Park Lofts Paraguay</div>
          <h1 className="login-title">
            Operaciones que mantienen cada loft impecable.
          </h1>
          <p className="login-subtitle">
            Gestion de reservas, pagos Bancard y sincronizacion de disponibilidad en un solo lugar, con la estetica y el cuidado que define a Park Lofts.
          </p>

          <div className="login-stats">
            <div>
              <p className="login-stat-value">24/7</p>
              <p className="login-stat-label">Sync Airbnb</p>
            </div>
            <div>
              <p className="login-stat-value">Bancard</p>
              <p className="login-stat-label">Pagos seguros</p>
            </div>
            <div>
              <p className="login-stat-value">PY</p>
              <p className="login-stat-label">Asuncion</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-area">
        <div className="login-card">
          <div className="login-card-header">
            <div>
              <p>Acceso seguro</p>
              <h2>Ingresar al panel</h2>
              <p>Usa tus credenciales de administrador para continuar.</p>
            </div>
            <div className="login-brand-dot" />
          </div>

          <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="login-label" htmlFor="email">
                Correo electronico
              </label>
              <input
                id="email"
                {...register('email')}
                className="login-input"
                placeholder="admin@parkloftsparaguay.com"
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
                placeholder="Tu contrasena"
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
            Panel de operaciones Park Lofts Paraguay.
          </div>
        </div>
      </div>
    </div>
  );
}
