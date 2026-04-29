import { z } from 'zod';
import { api } from '../utils/api';

// Mirrors backend AdminUser shape exposed by /api/admin/users.
// Keep this in sync with backend/src/services/admin-user.service.ts -> toApi().
export const adminRoleSchema = z.enum(['admin', 'staff']);
export const adminStatusSchema = z.enum(['active', 'inactive']);

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  authId: z.string().uuid().nullable(),
  name: z.string().min(1),
  email: z.string().email(),
  role: adminRoleSchema,
  status: adminStatusSchema,
  notifyNewBooking: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminStatus = z.infer<typeof adminStatusSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;

export const inviteAdminUserSchema = z.object({
  name: z.string().trim().min(2, 'errorNameMin').max(200, 'errorNameMax'),
  email: z.string().trim().toLowerCase().email('errorEmailInvalid').max(320, 'errorEmailMax'),
  role: adminRoleSchema,
});

export type InviteAdminUserInput = z.infer<typeof inviteAdminUserSchema>;

export const setPasswordSchema = z
  .string()
  .min(10, 'errorPasswordMin')
  .max(128, 'errorPasswordMax')
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), 'errorPasswordComplexity');

interface ApiErrorBody { error?: string }

export class AdminUserApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function unwrap(err: unknown): never {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { status?: number; data?: ApiErrorBody } }).response;
    const status = r?.status ?? 500;
    const message = r?.data?.error ?? 'Request failed';
    throw new AdminUserApiError(message, status);
  }
  if (err instanceof Error) throw new AdminUserApiError(err.message, 0);
  throw new AdminUserApiError('Request failed', 0);
}

export const adminUsersApi = {
  async list(): Promise<AdminUser[]> {
    try {
      const { data } = await api.get<unknown>('/admin/users');
      return z.array(adminUserSchema).parse(data);
    } catch (err) {
      unwrap(err);
    }
  },

  async invite(input: InviteAdminUserInput): Promise<AdminUser> {
    try {
      const { data } = await api.post<unknown>('/admin/users', input);
      return adminUserSchema.parse(data);
    } catch (err) {
      unwrap(err);
    }
  },

  async reinvite(userId: string): Promise<AdminUser> {
    try {
      const { data } = await api.post<unknown>(`/admin/users/${userId}/reinvite`);
      return adminUserSchema.parse(data);
    } catch (err) {
      unwrap(err);
    }
  },

  async update(
    userId: string,
    patch: Partial<{ name: string; role: AdminRole; status: AdminStatus }>,
  ): Promise<AdminUser> {
    try {
      const { data } = await api.put<unknown>(`/admin/users/${userId}`, patch);
      return adminUserSchema.parse(data);
    } catch (err) {
      unwrap(err);
    }
  },

  async setPassword(userId: string, password: string): Promise<AdminUser> {
    try {
      const { data } = await api.post<unknown>(`/admin/users/${userId}/password`, { password });
      return adminUserSchema.parse(data);
    } catch (err) {
      unwrap(err);
    }
  },

  async sendPasswordReset(userId: string): Promise<{ email: string }> {
    try {
      const { data } = await api.post<{ ok: boolean; email: string }>(
        `/admin/users/${userId}/send-password-reset`,
      );
      return { email: data.email };
    } catch (err) {
      unwrap(err);
    }
  },

  async sendSelfPasswordReset(): Promise<{ email: string }> {
    try {
      const { data } = await api.post<{ ok: boolean; email: string }>(
        '/admin/users/me/send-password-reset',
      );
      return { email: data.email };
    } catch (err) {
      unwrap(err);
    }
  },

  async getMe(): Promise<AdminUser> {
    try {
      const { data } = await api.get<unknown>('/admin/users/me');
      return adminUserSchema.parse(data);
    } catch (err) {
      unwrap(err);
    }
  },

  async updateMyPreferences(prefs: { notifyNewBooking?: boolean }): Promise<AdminUser> {
    try {
      const { data } = await api.patch<unknown>('/admin/users/me/preferences', {
        notify_new_booking: prefs.notifyNewBooking,
      });
      return adminUserSchema.parse(data);
    } catch (err) {
      unwrap(err);
    }
  },
};
