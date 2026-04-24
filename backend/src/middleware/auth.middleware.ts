import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    logger.warn('Auth failed', { error: error?.message });
    return res.status(401).json({ error: error?.message ?? 'Unauthorized' });
  }

  res.locals.user = data.user;
  return next();
};

// Resolves admin_users.role for the authenticated user (set by requireAuth) and
// rejects with 403 unless the role is 'admin'. Caches the resolved role on the
// request scope so chaining additional admin-only checks does not re-query.
//
// Contract:
//   - MUST run after requireAuth. If res.locals.user is missing we return 401
//     so misconfigured route stacks fail loud instead of silently bypassing.
//   - Lookup is by auth_id; email matching is intentionally not used (would let
//     a deactivated row with a recycled email regain access).
//   - status === 'inactive' is treated as a hard 403, regardless of role.
//   - Any DB error is a 500 so we never fail-open on transient errors.
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = res.locals.user as { id?: string; email?: string } | undefined;
  if (!user?.id) {
    logger.warn('requireAdmin invoked without authenticated user; check middleware order');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (res.locals.adminRole === 'admin') {
    return next();
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, role, status')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (error) {
    logger.error('requireAdmin: admin_users lookup failed', {
      auth_id: user.id,
      error: error.message,
    });
    return res.status(500).json({ error: 'Authorization check failed' });
  }

  if (!data) {
    logger.warn('requireAdmin: no admin_users row for authenticated user', {
      auth_id: user.id,
      email: user.email,
    });
    return res.status(403).json({ error: 'Admin role required' });
  }

  if (data.status !== 'active') {
    logger.warn('requireAdmin: inactive admin user attempted privileged action', {
      auth_id: user.id,
      admin_user_id: data.id,
    });
    return res.status(403).json({ error: 'Account is inactive' });
  }

  if (data.role !== 'admin') {
    logger.warn('requireAdmin: non-admin user attempted privileged action', {
      auth_id: user.id,
      admin_user_id: data.id,
      role: data.role,
    });
    return res.status(403).json({ error: 'Admin role required' });
  }

  res.locals.adminRole = data.role;
  res.locals.adminUserId = data.id;
  return next();
};

// Day-to-day operational actions (adding a guest alias, viewing dashboards)
// are allowed for any active admin_users row regardless of role. Privileged
// actions (unit CRUD, user management, FX tuning) still go through
// requireAdmin. Keeping the split means alias edits do not force role
// escalation for staff but we never fail-open.
//
// Contract mirrors requireAdmin:
//   - MUST run after requireAuth.
//   - Rejects when there is no admin_users row or when status !== 'active'.
//   - Caches resolved role and admin_users.id on res.locals to avoid re-query.
export const requireStaffOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = res.locals.user as { id?: string; email?: string } | undefined;
  if (!user?.id) {
    logger.warn('requireStaffOrAdmin invoked without authenticated user; check middleware order');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (res.locals.adminRole === 'admin' || res.locals.adminRole === 'staff') {
    return next();
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, role, status')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (error) {
    logger.error('requireStaffOrAdmin: admin_users lookup failed', {
      auth_id: user.id,
      error: error.message,
    });
    return res.status(500).json({ error: 'Authorization check failed' });
  }

  if (!data) {
    logger.warn('requireStaffOrAdmin: no admin_users row for authenticated user', {
      auth_id: user.id,
      email: user.email,
    });
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (data.status !== 'active') {
    logger.warn('requireStaffOrAdmin: inactive admin user attempted privileged action', {
      auth_id: user.id,
      admin_user_id: data.id,
    });
    return res.status(403).json({ error: 'Account is inactive' });
  }

  if (data.role !== 'admin' && data.role !== 'staff') {
    logger.warn('requireStaffOrAdmin: unexpected role', {
      auth_id: user.id,
      admin_user_id: data.id,
      role: data.role,
    });
    return res.status(403).json({ error: 'Admin access required' });
  }

  res.locals.adminRole = data.role;
  res.locals.adminUserId = data.id;
  return next();
};
