import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const buildSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email({ message: t('login.invalidEmail') }),
    password: z.string().min(6, { message: t('login.passwordMinLength') }),
  });

type FormValues = { email: string; password: string };

export default function Login() {
  const { signIn } = useAuth();
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.resolvedLanguage ?? i18n.language).startsWith('es') ? 'es' : 'en';
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(buildSchema(t)) });

  const onSubmit = async (values: FormValues) => {
    setAuthError(null);
    try {
      await signIn(values.email, values.password);
    } catch {
      setAuthError(t('login.authError'));
    }
  };

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-panel-inner">
          <LoginBrandmark />

          <h1 className="login-title">{t('login.tagline')}</h1>
          <p className="login-subtitle">{t('login.description')}</p>

          <div className="login-stats">
            <div>
              <p className="login-stat-value">98%</p>
              <p className="login-stat-label">{t('login.payoutAccuracy')}</p>
            </div>
            <div>
              <p className="login-stat-value">24/7</p>
              <p className="login-stat-label">{t('login.calendarSync')}</p>
            </div>
            <div>
              <p className="login-stat-value">1 dashboard</p>
              <p className="login-stat-label">{t('login.forAllListings')}</p>
            </div>
          </div>

          <div className="login-integrations">
            <span className="login-integrations-label">{t('login.integrations')}</span>
            <div className="login-integrations-row">
              <span className="login-chip">Bancard</span>
              <span className="login-chip">Airbnb</span>
              <span className="login-chip">Booking</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-area">
        <div className="login-card">
          <div className="login-card-header">
            <div>
              <p className="login-eyebrow">{t('login.secureAccess')}</p>
              <h2 className="login-card-title">{t('login.title')}</h2>
              <p className="login-card-sub">{t('login.subtitle')}</p>
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
                {t('login.email')}
              </label>
              <input
                id="email"
                {...register('email')}
                className="login-input"
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                type="email"
                inputMode="email"
              />
              {errors.email && <p className="login-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="login-label" htmlFor="password">
                {t('login.password')}
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
            {authError && <p className="login-error">{authError}</p>}
            <button className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? t('login.loggingIn') : t('login.login')}
            </button>
          </form>

          <div className="login-footer">
            <span className="login-footer-dot" />
            {t('login.footer')}
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="text-xs font-medium text-[#9ca3af] hover:text-[#6b7280] transition-colors"
              onClick={() => i18n.changeLanguage(currentLang === 'es' ? 'en' : 'es')}
            >
              {currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            </button>
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
