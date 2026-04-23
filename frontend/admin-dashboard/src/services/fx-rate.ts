import { z } from 'zod';
import { api } from '../utils/api';

// Mirrors backend FxRateStatus from backend/src/services/fx-rate.service.ts.
// Keep in sync if fields change.
export const fxRateStatusSchema = z.object({
  marketRate: z.number(),
  effectiveRate: z.number(),
  markupPct: z.number(),
  source: z.string(),
  fetchedAt: z.string(),
  ageHours: z.number(),
  stale: z.boolean(),
  fallback: z.boolean()
});

export type FxRateStatus = z.infer<typeof fxRateStatusSchema>;

interface ApiErrorBody {
  error?: string;
}

export class FxRateApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'FxRateApiError';
  }
}

function toError(err: unknown, fallback: string): never {
  const anyErr = err as { response?: { status?: number; data?: ApiErrorBody }; message?: string };
  const status = anyErr.response?.status ?? 500;
  const message = anyErr.response?.data?.error ?? anyErr.message ?? fallback;
  throw new FxRateApiError(message, status);
}

export const fxRateService = {
  async getStatus(): Promise<FxRateStatus> {
    try {
      const { data } = await api.get('/admin/fx/status');
      return fxRateStatusSchema.parse(data);
    } catch (err) {
      toError(err, 'Failed to load FX status');
    }
  },

  async setMarkup(markupPct: number): Promise<FxRateStatus> {
    try {
      const { data } = await api.post('/admin/fx/markup', { markup_pct: markupPct });
      return fxRateStatusSchema.parse(data);
    } catch (err) {
      toError(err, 'Failed to update markup');
    }
  },

  async setManualOverride(marketRate: number): Promise<FxRateStatus> {
    try {
      const { data } = await api.post('/admin/fx/override', { market_rate: marketRate });
      return fxRateStatusSchema.parse(data);
    } catch (err) {
      toError(err, 'Failed to set manual rate');
    }
  },

  async refresh(): Promise<FxRateStatus> {
    try {
      const { data } = await api.post('/admin/fx/refresh', {});
      return fxRateStatusSchema.parse(data);
    } catch (err) {
      toError(err, 'Failed to refresh FX rate');
    }
  }
};
