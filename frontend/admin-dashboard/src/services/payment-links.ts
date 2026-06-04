import { z } from 'zod';
import { api } from '../utils/api';

// Mirrors backend PaymentLink from backend/src/services/payment-link.service.ts.
// Keep in sync if fields change.
export const paymentLinkSchema = z.object({
  id: z.string().uuid(),
  amount_usd: z.coerce.number(),
  amount_pyg: z.coerce.number(),
  fx_rate_snapshot: z.coerce.number(),
  concept: z.string(),
  status: z.enum(['active', 'paid', 'expired']),
  shop_process_id: z.string().nullable(),
  booking_id: z.string().nullable(),
  expires_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PaymentLink = z.infer<typeof paymentLinkSchema>;

interface ApiErrorBody {
  error?: string;
}

export class PaymentLinkApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PaymentLinkApiError';
  }
}

function toError(err: unknown, fallback: string): never {
  const anyErr = err as { response?: { status?: number; data?: ApiErrorBody }; message?: string };
  const status = anyErr.response?.status ?? 500;
  const message = anyErr.response?.data?.error ?? anyErr.message ?? fallback;
  throw new PaymentLinkApiError(message, status);
}

export const paymentLinksService = {
  async list(): Promise<PaymentLink[]> {
    try {
      const { data } = await api.get('/admin/payment-links', { params: { limit: 200 } });
      return z.array(paymentLinkSchema).parse(data);
    } catch (err) {
      toError(err, 'Failed to load payment links');
    }
  },

  async create(input: { amountUsd: number; concept: string }): Promise<PaymentLink> {
    try {
      const { data } = await api.post('/admin/payment-links', {
        amount_usd: input.amountUsd,
        concept: input.concept,
      });
      return paymentLinkSchema.parse(data);
    } catch (err) {
      toError(err, 'Failed to create payment link');
    }
  },
};

// Builds the public /pay URL for a link. Prefers the configured widget origin,
// falls back to the production rent domain so a copied link is always valid.
export function buildPublicPayUrl(linkId: string): string {
  const base =
    (import.meta.env.VITE_WIDGET_URL as string | undefined) ??
    'https://rent.parkloftsparaguay.com';
  return `${base.replace(/\/$/, '')}/pay/${linkId}`;
}
