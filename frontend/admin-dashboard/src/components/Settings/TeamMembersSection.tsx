import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { FiChevronDown, FiLoader, FiMoreHorizontal, FiUserPlus } from 'react-icons/fi';
import {
  AdminUserApiError,
  adminUsersApi,
  type AdminRole,
  type AdminUser,
} from '../../services/admin-users';
import InviteMemberModal from './InviteMemberModal';
import ConfirmActionModal from './ConfirmActionModal';
import RolePill from './RolePill';
import StatusPill from './StatusPill';

type LoadStatus = 'loading' | 'ready' | 'error';

interface PendingAction {
  kind: 'reinvite' | 'reset' | 'deactivate' | 'reactivate';
  user: AdminUser;
}

// Status semantics:
//   active    auth_id linked, can sign in
//   pending   no auth_id linked, awaiting first invite
//   inactive  explicitly deactivated, cannot sign in
function effectiveStatus(user: AdminUser): 'active' | 'pending' | 'inactive' {
  if (user.status === 'inactive') return 'inactive';
  if (!user.authId) return 'pending';
  return 'active';
}

interface TeamMembersSectionProps {
  currentUserEmail: string | null;
}

export default function TeamMembersSection({ currentUserEmail }: TeamMembersSectionProps) {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    try {
      setStatus('loading');
      const list = await adminUsersApi.list();
      setUsers(list);
      setStatus('ready');
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('team.loadFailed');
      setLoadError(message);
      setStatus('error');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Close kebab menu on outside click.
  useEffect(() => {
    if (!openMenuId) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openMenuId]);

  // Close role dropdown on outside click.
  useEffect(() => {
    if (!openRoleId) return;
    const onClick = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) setOpenRoleId(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openRoleId]);

  const handleInvite = async (input: { name: string; email: string; role: AdminRole }) => {
    const created = await adminUsersApi.invite(input);
    setUsers((prev) => [created, ...prev]);
    toast.success(t('team.inviteSent', { email: created.email }));
    return created;
  };

  const handleRoleChange = async (user: AdminUser, nextRole: AdminRole) => {
    if (user.role === nextRole) return;
    if (currentUserEmail && user.email.toLowerCase() === currentUserEmail.toLowerCase() && nextRole === 'staff') {
      toast.error(t('team.cannotDemoteSelf'));
      return;
    }
    try {
      const updated = await adminUsersApi.update(user.id, { role: nextRole });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(t('team.roleUpdated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('team.roleUpdateFailed'));
    }
  };

  const runPendingAction = async (): Promise<void> => {
    if (!pendingAction) return;
    const { kind, user } = pendingAction;
    try {
      if (kind === 'reinvite') {
        const updated = await adminUsersApi.reinvite(user.id);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success(t('team.reinviteSent', { email: updated.email }));
      } else if (kind === 'reset') {
        const result = await adminUsersApi.sendPasswordReset(user.id);
        toast.success(t('team.resetSent', { email: result.email }));
      } else if (kind === 'deactivate') {
        const updated = await adminUsersApi.update(user.id, { status: 'inactive' });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success(t('team.deactivated', { email: updated.email }));
      } else if (kind === 'reactivate') {
        const updated = await adminUsersApi.update(user.id, { status: 'active' });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success(t('team.reactivated', { email: updated.email }));
      }
    } catch (err) {
      const isApi = err instanceof AdminUserApiError;
      const msg = isApi ? err.message : err instanceof Error ? err.message : t('team.actionFailed');
      throw new Error(msg);
    }
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const sa = effectiveStatus(a);
      const sb = effectiveStatus(b);
      const order = { active: 0, pending: 1, inactive: 2 };
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return a.email.localeCompare(b.email);
    });
  }, [users]);

  // date-fns locales are not bundled to keep the dashboard lean. We use the
  // default English relative output regardless of i18n; the rest of the row is
  // already localized.
  void i18n;

  const renderRelative = (iso: string): string => {
    try {
      return formatDistanceToNow(parseISO(iso), { addSuffix: true });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{t('team.sectionTitle')}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {t('team.sectionSubtitle', {
              count: users.length,
              cap: 10,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          disabled={users.length >= 10}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          title={users.length >= 10 ? t('team.capReachedHint') : undefined}
        >
          <FiUserPlus className="h-4 w-4" aria-hidden="true" />
          {t('team.inviteCta')}
        </button>
      </div>

      {status === 'loading' ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('team.loading')}
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {loadError ?? t('team.loadFailed')}
          <button
            type="button"
            onClick={() => void refresh()}
            className="ml-3 font-semibold underline hover:no-underline"
          >
            {t('team.retry')}
          </button>
        </div>
      ) : null}

      {status === 'ready' && users.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {t('team.empty')}
        </div>
      ) : null}

      {status === 'ready' && users.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('team.colMember')}</th>
                  <th className="px-4 py-3 font-medium">{t('team.colRole')}</th>
                  <th className="px-4 py-3 font-medium">{t('team.colStatus')}</th>
                  <th className="px-4 py-3 font-medium">{t('team.colCreated')}</th>
                  <th className="px-4 py-3 font-medium" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedUsers.map((user) => {
                  const eff = effectiveStatus(user);
                  const isSelf =
                    currentUserEmail && user.email.toLowerCase() === currentUserEmail.toLowerCase();
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-500">
                          {user.email}
                          {isSelf ? <span className="ml-2 text-slate-400">{t('team.selfTag')}</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div
                          className="relative inline-block"
                          ref={openRoleId === user.id ? roleMenuRef : null}
                        >
                          <button
                            type="button"
                            disabled={eff === 'inactive'}
                            onClick={() =>
                              setOpenRoleId((cur) => (cur === user.id ? null : user.id))
                            }
                            aria-haspopup="menu"
                            aria-expanded={openRoleId === user.id}
                            aria-label={t('team.changeRoleAriaLabel', { name: user.name })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                user.role === 'admin' ? 'bg-violet-500' : 'bg-slate-400'
                              }`}
                              aria-hidden="true"
                            />
                            {user.role === 'admin' ? t('team.roleAdmin') : t('team.roleStaff')}
                            <FiChevronDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
                          </button>
                          {openRoleId === user.id ? (
                            <div
                              role="menu"
                              className="absolute left-0 z-30 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                            >
                              {(['staff', 'admin'] as AdminRole[]).map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={user.role === r}
                                  onClick={() => {
                                    setOpenRoleId(null);
                                    void handleRoleChange(user, r);
                                  }}
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                                    user.role === r ? 'text-slate-900' : 'text-slate-600'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      r === 'admin' ? 'bg-violet-500' : 'bg-slate-400'
                                    }`}
                                    aria-hidden="true"
                                  />
                                  {r === 'admin' ? t('team.roleAdmin') : t('team.roleStaff')}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusPill status={eff} />
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-500">
                        {renderRelative(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="relative inline-block" ref={openMenuId === user.id ? menuRef : null}>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            onClick={() => setOpenMenuId((cur) => (cur === user.id ? null : user.id))}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === user.id}
                            aria-label={t('team.actionsAriaLabel', { name: user.name })}
                          >
                            <FiMoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {openMenuId === user.id ? (
                            <div
                              role="menu"
                              className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                            >
                              {eff === 'pending' ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setPendingAction({ kind: 'reinvite', user });
                                  }}
                                >
                                  {t('team.actionReinvite')}
                                </button>
                              ) : null}

                              {eff === 'active' ? (
                                <>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setPendingAction({ kind: 'reset', user });
                                    }}
                                  >
                                    {t('team.actionSendReset')}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setPendingAction({ kind: 'reinvite', user });
                                    }}
                                  >
                                    {t('team.actionResetTempPassword')}
                                  </button>
                                  {!isSelf ? (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setPendingAction({ kind: 'deactivate', user });
                                      }}
                                    >
                                      {t('team.actionDeactivate')}
                                    </button>
                                  ) : null}
                                </>
                              ) : null}

                              {eff === 'inactive' ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setPendingAction({ kind: 'reactivate', user });
                                  }}
                                >
                                  {t('team.actionReactivate')}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {sortedUsers.map((user) => {
              const eff = effectiveStatus(user);
              return (
                <li key={user.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{user.name}</div>
                      <div className="text-xs text-slate-500 truncate">{user.email}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <RolePill role={user.role} />
                        <StatusPill status={eff} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eff === 'pending' ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                        onClick={() => setPendingAction({ kind: 'reinvite', user })}
                      >
                        {t('team.actionReinvite')}
                      </button>
                    ) : null}
                    {eff === 'active' ? (
                      <>
                        <button
                          type="button"
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                          onClick={() => setPendingAction({ kind: 'reset', user })}
                        >
                          {t('team.actionSendReset')}
                        </button>
                        {currentUserEmail && user.email.toLowerCase() !== currentUserEmail.toLowerCase() ? (
                          <button
                            type="button"
                            className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600"
                            onClick={() => setPendingAction({ kind: 'deactivate', user })}
                          >
                            {t('team.actionDeactivate')}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {eff === 'inactive' ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                        onClick={() => setPendingAction({ kind: 'reactivate', user })}
                      >
                        {t('team.actionReactivate')}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
      />

      <ConfirmActionModal
        open={!!pendingAction}
        title={pendingAction ? t(`team.confirm.${pendingAction.kind}.title`) : ''}
        description={
          pendingAction
            ? t(`team.confirm.${pendingAction.kind}.description`, {
                name: pendingAction.user.name,
                email: pendingAction.user.email,
              })
            : ''
        }
        confirmLabel={pendingAction ? t(`team.confirm.${pendingAction.kind}.confirm`) : ''}
        pendingLabel={pendingAction ? t(`team.confirm.${pendingAction.kind}.pending`) : ''}
        cancelLabel={t('team.confirm.cancel')}
        destructive={pendingAction?.kind === 'deactivate'}
        onConfirm={runPendingAction}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}
