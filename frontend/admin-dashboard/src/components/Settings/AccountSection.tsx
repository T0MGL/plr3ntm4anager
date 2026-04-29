import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { FiBell, FiLoader, FiMail, FiShield, FiUser } from 'react-icons/fi';
import type { User } from '@supabase/supabase-js';
import { AdminUserApiError, adminUsersApi, type AdminRole } from '../../services/admin-users';
import RolePill from './RolePill';

interface AccountSectionProps {
  user: User | null;
  role: AdminRole | null;
  roleStatus: 'loading' | 'ready' | 'unknown';
}

function formatSignIn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return null;
  }
}

export default function AccountSection({ user, role, roleStatus }: AccountSectionProps) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [notifyNewBooking, setNotifyNewBooking] = useState<boolean | null>(null);
  const [savingNotify, setSavingNotify] = useState(false);

  const lastSignIn = useMemo(
    () => formatSignIn(user?.last_sign_in_at ?? null),
    [user?.last_sign_in_at],
  );

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    t('account.unknownUser');

  useEffect(() => {
    adminUsersApi.getMe().then((me) => {
      setNotifyNewBooking(me.notifyNewBooking);
    }).catch(() => {
      // Non-critical: silently fall back; toggle renders once data arrives.
    });
  }, []);

  const sendReset = async () => {
    if (!user?.email) return;
    setSending(true);
    try {
      const result = await adminUsersApi.sendSelfPasswordReset();
      toast.success(t('account.resetSent', { email: result.email }));
    } catch (err) {
      const message =
        err instanceof AdminUserApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('account.resetFailed');
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const toggleNotifyNewBooking = async () => {
    if (notifyNewBooking === null || savingNotify) return;
    const next = !notifyNewBooking;
    setNotifyNewBooking(next);
    setSavingNotify(true);
    try {
      const updated = await adminUsersApi.updateMyPreferences({ notifyNewBooking: next });
      setNotifyNewBooking(updated.notifyNewBooking);
      toast.success(
        next ? t('account.notifyNewBookingEnabled') : t('account.notifyNewBookingDisabled'),
      );
    } catch {
      setNotifyNewBooking(!next);
      toast.error(t('account.notifyNewBookingSaveFailed'));
    } finally {
      setSavingNotify(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <FiUser className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{t('account.sectionTitle')}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{t('account.sectionDesc')}</p>
        </div>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('account.displayName')}
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">{displayName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('account.email')}
          </dt>
          <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-900">
            <FiMail className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {user?.email ?? '-'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('account.role')}
          </dt>
          <dd className="mt-1 flex items-center gap-2 text-sm text-slate-900">
            {roleStatus === 'loading' ? (
              <span className="text-slate-400">{t('common.loading')}</span>
            ) : role ? (
              <RolePill role={role} />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                <FiShield className="h-3 w-3" aria-hidden="true" />
                {t('account.roleUnknown')}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('account.lastSignIn')}
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {lastSignIn ?? <span className="text-slate-400">{t('account.neverSignedIn')}</span>}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-slate-100 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <FiBell className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t('account.notifyNewBookingLabel')}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t('account.notifyNewBookingHint')}
              </p>
            </div>
          </div>

          {notifyNewBooking === null ? (
            <span className="mt-0.5 flex-shrink-0">
              <FiLoader className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
            </span>
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={notifyNewBooking}
              aria-label={t('account.notifyNewBookingLabel')}
              disabled={savingNotify}
              onClick={() => void toggleNotifyNewBooking()}
              className={`relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60 ${
                notifyNewBooking ? 'bg-slate-900' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  notifyNewBooking ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          )}
        </div>
      </div>

      <footer className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">{t('account.resetHint')}</p>
        <button
          type="button"
          onClick={() => void sendReset()}
          disabled={sending || !user?.email}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          {sending ? (
            <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FiMail className="h-4 w-4" aria-hidden="true" />
          )}
          {t('account.sendResetCta')}
        </button>
      </footer>
    </section>
  );
}
