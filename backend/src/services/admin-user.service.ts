import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sendEmail } from './email.service';
import { adminInviteEmail, adminPasswordResetEmail } from '../templates/emails';
import type { AdminUser, AdminUserRow } from '../types';

const ADMIN_USER_CAP = 10;

const COLUMNS = 'id, auth_id, name, email, role, status, created_at, updated_at';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  return 'PL-' + Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

function toApi(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    authId: row.auth_id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateAdminUserInput {
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

class AdminUserService {
  async list(): Promise<AdminUser[]> {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select(COLUMNS)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to list admin users', { error: error.message });
      throw new Error('Failed to fetch admin users');
    }

    return ((data ?? []) as AdminUserRow[]).map(toApi);
  }

  async createWithInvite(input: CreateAdminUserInput): Promise<AdminUser> {
    const { name, email, role } = input;

    const { count, error: countErr } = await supabaseAdmin
      .from('admin_users')
      .select('id', { count: 'exact', head: true });

    if (countErr) {
      logger.error('Failed to count admin users', { error: countErr.message });
      throw new Error('Failed to validate user cap');
    }

    if ((count ?? 0) >= ADMIN_USER_CAP) {
      const capErr = new Error(`Limit reached: maximum ${ADMIN_USER_CAP} admin users allowed`);
      (capErr as NodeJS.ErrnoException).code = 'CAP_REACHED';
      throw capErr;
    }

    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      const dupErr = new Error('An admin user with that email already exists');
      (dupErr as NodeJS.ErrnoException).code = 'CONFLICT';
      throw dupErr;
    }

    const tempPassword = generateTempPassword();
    let authUserId: string;

    const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role, name },
    });

    if (createErr) {
      const msg = createErr.message?.toLowerCase() ?? '';
      if (msg.includes('already') || msg.includes('duplicate') || msg.includes('exists')) {
        const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
        const found = !listErr ? listData?.users?.find((u) => u.email === email) : null;
        if (!found) {
          logger.error('Email exists in Auth but could not be linked', { email });
          throw new Error('Email exists in Auth but could not be linked');
        }
        authUserId = found.id;
        await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: tempPassword });
      } else {
        logger.error('Failed to create admin auth user', { error: createErr.message, email });
        throw new Error(`Failed to create auth account: ${createErr.message}`);
      }
    } else {
      authUserId = createData.user.id;
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('admin_users')
      .insert({ auth_id: authUserId, name, email, role, status: 'active' })
      .select(COLUMNS)
      .single();

    if (insertErr || !inserted) {
      logger.error('Failed to insert admin_users row after auth create', {
        error: insertErr?.message,
        email,
        authUserId,
      });
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch((err) => {
        logger.error('Failed to rollback auth user after insert error', { err, authUserId });
      });
      throw new Error(`Failed to create admin user: ${insertErr?.message ?? 'insert failed'}`);
    }

    const invite = adminInviteEmail({ name, email, tempPassword });
    sendEmail(email, invite.subject, invite.html).catch((err) => {
      logger.error('Failed to send admin invite email', { err, email });
    });

    return toApi(inserted as AdminUserRow);
  }

  async reinvite(userId: string): Promise<AdminUser> {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('admin_users')
      .select(COLUMNS)
      .eq('id', userId)
      .single();

    if (fetchErr || !row) {
      const err = new Error(`Admin user not found: ${userId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    const userRow = row as AdminUserRow;
    const tempPassword = generateTempPassword();
    let authUserId = userRow.auth_id;

    if (authUserId) {
      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: tempPassword,
      });
      if (updateAuthErr) {
        logger.error('Failed to reset admin password on reinvite', { error: updateAuthErr.message, userId });
        throw new Error('Failed to reset password');
      }
    } else {
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: userRow.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role: userRow.role, name: userRow.name },
      });

      if (createErr) {
        const msg = createErr.message?.toLowerCase() ?? '';
        if (msg.includes('already') || msg.includes('duplicate') || msg.includes('exists')) {
          const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
          const found = !listErr ? listData?.users?.find((u) => u.email === userRow.email) : null;
          if (!found) {
            throw new Error('Email exists in Auth but could not be linked');
          }
          authUserId = found.id;
          await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: tempPassword });
        } else {
          logger.error('Failed to create auth user on reinvite', { error: createErr.message, userId });
          throw new Error(`Failed to create auth account: ${createErr.message}`);
        }
      } else {
        authUserId = createData.user.id;
      }

      const { error: linkErr } = await supabaseAdmin
        .from('admin_users')
        .update({ auth_id: authUserId })
        .eq('id', userId);

      if (linkErr) {
        logger.error('Failed to link auth_id on reinvite', { error: linkErr.message, userId, authUserId });
        throw new Error('Failed to link auth account');
      }
    }

    const invite = adminInviteEmail({ name: userRow.name, email: userRow.email, tempPassword });
    sendEmail(userRow.email, invite.subject, invite.html).catch((err) => {
      logger.error('Failed to send admin reinvite email', { err, email: userRow.email });
    });

    const { data: refreshed } = await supabaseAdmin
      .from('admin_users')
      .select(COLUMNS)
      .eq('id', userId)
      .single();

    return toApi((refreshed ?? { ...userRow, auth_id: authUserId }) as AdminUserRow);
  }

  async update(
    userId: string,
    patch: Partial<Pick<CreateAdminUserInput, 'name' | 'role'> & { status: 'active' | 'inactive' }>,
  ): Promise<AdminUser> {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update(patch)
      .eq('id', userId)
      .select(COLUMNS)
      .single();

    if (error || !data) {
      const err = new Error(`Admin user not found: ${userId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    return toApi(data as AdminUserRow);
  }

  async setPassword(userId: string, newPassword: string): Promise<AdminUser> {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('admin_users')
      .select(COLUMNS)
      .eq('id', userId)
      .single();

    if (fetchErr || !row) {
      const err = new Error(`Admin user not found: ${userId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    const userRow = row as AdminUserRow;

    if (!userRow.auth_id) {
      const err = new Error('User has no auth account. Send a reinvite first.');
      (err as NodeJS.ErrnoException).code = 'PRECONDITION_FAILED';
      throw err;
    }

    if (userRow.status !== 'active') {
      const err = new Error('User is inactive. Reactivate before changing password.');
      (err as NodeJS.ErrnoException).code = 'PRECONDITION_FAILED';
      throw err;
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userRow.auth_id, {
      password: newPassword,
    });

    if (updateErr) {
      logger.error('Failed to set admin user password', { error: updateErr.message, userId });
      throw new Error(`Failed to update password: ${updateErr.message}`);
    }

    return toApi(userRow);
  }

  async sendPasswordResetEmail(userId: string): Promise<{ email: string }> {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('admin_users')
      .select(COLUMNS)
      .eq('id', userId)
      .single();

    if (fetchErr || !row) {
      const err = new Error(`Admin user not found: ${userId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    const userRow = row as AdminUserRow;

    if (!userRow.auth_id) {
      const err = new Error('User has no auth account. Send a reinvite first.');
      (err as NodeJS.ErrnoException).code = 'PRECONDITION_FAILED';
      throw err;
    }

    if (userRow.status !== 'active') {
      const err = new Error('User is inactive. Reactivate before sending a reset.');
      (err as NodeJS.ErrnoException).code = 'PRECONDITION_FAILED';
      throw err;
    }

    const redirectTo = `${env.ADMIN_DASHBOARD_URL}/reset-password`;

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: userRow.email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      logger.error('Failed to generate password recovery link', { error: linkErr?.message, userId });
      throw new Error('Failed to generate recovery link');
    }

    const reset = adminPasswordResetEmail({ name: userRow.name, resetUrl: linkData.properties.action_link });
    sendEmail(userRow.email, reset.subject, reset.html).catch((err) => {
      logger.error('Failed to send password reset email', { err, email: userRow.email });
    });

    return { email: userRow.email };
  }
}

export const adminUserService = new AdminUserService();
