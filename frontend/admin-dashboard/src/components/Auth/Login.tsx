import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';

const LOGO_URL =
  'https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/park-lofts-logogold.png';

const formSchema = z.object({
  email: z.string().email('Correo invalido.'),
  password: z.string().min(6, 'Minimo 6 caracteres.'),
});

type FormValues = z.infer<typeof formSchema>;

export default function Login() {
  const { signIn } = useAuth();
  const [authError, setAuthError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = async (values: FormValues) => {
    setAuthError('');
    try {
      await signIn(values.email, values.password);
    } catch {
      setAuthError('Credenciales incorrectas.');
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src={LOGO_URL} alt="" width={40} height={40} />
          <div>
            <span className="login-brand-name">Park Lofts</span>
            <span className="login-brand-badge">Rent Admin</span>
          </div>
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

          {authError && <p className="login-error">{authError}</p>}

          <button className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
