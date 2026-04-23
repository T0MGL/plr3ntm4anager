import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminUsersApi, type AdminRole } from '../services/admin-users';

type RoleStatus = 'loading' | 'ready' | 'unknown';

interface UseAdminRoleResult {
  role: AdminRole | null;
  status: RoleStatus;
  isAdmin: boolean;
  isStaff: boolean;
}

// Resolves the admin role of the currently signed-in user. Reads it first from
// Supabase user_metadata.role (set by the backend on createWithInvite). Falls
// back to a /admin/users lookup matched by email so accounts that pre-date the
// metadata flow (or were provisioned manually in Supabase) still resolve.
//
// The backend enforces role === 'admin' on every /admin/users endpoint via
// requireAdmin middleware. This hook is the UI guard so staff users do not
// see Settings -> Team. The fallback /admin/users call below will 403 for
// non-admins, which is treated as 'unknown' (no role surfaced).
export function useAdminRole(): UseAdminRoleResult {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [status, setStatus] = useState<RoleStatus>('loading');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setRole(null);
      setStatus('ready');
      return;
    }

    const metaRole = (user.user_metadata as { role?: unknown } | null | undefined)?.role;
    if (metaRole === 'admin' || metaRole === 'staff') {
      setRole(metaRole);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const users = await adminUsersApi.list();
        if (cancelled) return;
        const match = users.find((u) => u.email.toLowerCase() === user.email?.toLowerCase());
        setRole(match?.role ?? null);
        setStatus(match ? 'ready' : 'unknown');
      } catch {
        if (cancelled) return;
        setRole(null);
        setStatus('unknown');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return {
    role,
    status,
    isAdmin: role === 'admin',
    isStaff: role === 'staff',
  };
}
