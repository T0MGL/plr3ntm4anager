import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiLoader, FiX } from 'react-icons/fi';
import {
  inviteAdminUserSchema,
  type AdminRole,
  type AdminUser,
  type InviteAdminUserInput,
} from '../../services/admin-users';

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (input: InviteAdminUserInput) => Promise<AdminUser>;
}

interface FieldErrors {
  name?: string;
  email?: string;
  role?: string;
  form?: string;
}

const TR_PREFIX = 'team.invite';

export default function InviteMemberModal({ open, onClose, onInvite }: InviteMemberModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('staff');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setName('');
    setEmail('');
    setRole('staff');
    setErrors({});
    setSubmitting(false);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = inviteAdminUserSchema.safeParse({ name: name.trim(), email: email.trim(), role });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] = t(`${TR_PREFIX}.${issue.message}`);
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await onInvite(parsed.data);
      reset();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t(`${TR_PREFIX}.errorGeneric`);
      setErrors({ form: message });
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-member-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h4 id="invite-member-title" className="text-lg font-semibold text-slate-900">
              {t(`${TR_PREFIX}.title`)}
            </h4>
            <p className="mt-1 text-sm text-slate-500">{t(`${TR_PREFIX}.subtitle`)}</p>
          </div>
          <button
            type="button"
            className="text-slate-400 transition-colors hover:text-slate-600"
            onClick={close}
            aria-label={t(`${TR_PREFIX}.closeAriaLabel`)}
          >
            <FiX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
          <div>
            <label htmlFor="invite-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              {t(`${TR_PREFIX}.nameLabel`)}
            </label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((s) => ({ ...s, name: undefined }));
              }}
              disabled={submitting}
              autoFocus
              className={`w-full rounded-xl border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-colors disabled:opacity-60 ${
                errors.name ? 'border-rose-300 bg-rose-50' : 'border-slate-300 bg-white hover:border-slate-400'
              }`}
              placeholder={t(`${TR_PREFIX}.namePlaceholder`)}
            />
            {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name}</p> : null}
          </div>

          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              {t(`${TR_PREFIX}.emailLabel`)}
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((s) => ({ ...s, email: undefined }));
              }}
              disabled={submitting}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-colors disabled:opacity-60 ${
                errors.email ? 'border-rose-300 bg-rose-50' : 'border-slate-300 bg-white hover:border-slate-400'
              }`}
              placeholder={t(`${TR_PREFIX}.emailPlaceholder`)}
            />
            {errors.email ? <p className="mt-1 text-xs text-rose-600">{errors.email}</p> : null}
          </div>

          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 mb-1.5">
              {t(`${TR_PREFIX}.roleLabel`)}
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60"
            >
              <option value="staff">{t('team.roleStaff')}</option>
              <option value="admin">{t('team.roleAdmin')}</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              {role === 'admin' ? t(`${TR_PREFIX}.roleAdminHint`) : t(`${TR_PREFIX}.roleStaffHint`)}
            </p>
          </div>

          {errors.form ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errors.form}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {t(`${TR_PREFIX}.cancel`)}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t(`${TR_PREFIX}.sending`)}
                </>
              ) : (
                t(`${TR_PREFIX}.submit`)
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
