import axios from 'axios';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';

// FX rate service for USD -> PYG conversions on Bancard payments.
//
// Source of truth precedence (most -> least authoritative):
//   1. Latest row in fx_rates with source='manual' younger than 24h
//      (admin override always wins, but only briefly so we do not freeze a
//       stale value indefinitely)
//   2. Latest row in fx_rates from any source younger than 48h
//   3. env.USD_TO_PYG_RATE as last-resort safety net (logs a warning so
//      Sentry surfaces the degradation)
//
// Effective rate = market_rate * (1 + markup_pct / 100). Markup lives in the
// settings table (key='fx_markup_pct') and is operator-editable from the
// Settings UI.
//
// In-memory cache: 5 minutes. Avoids hammering Postgres on every checkout
// while still picking up admin overrides quickly. Bancard charge volume is
// low enough that 5 min staleness is acceptable.

const PRIMARY_SOURCE_URL = 'https://open.er-api.com/v6/latest/USD';
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const MANUAL_OVERRIDE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const FETCH_RETRY_COUNT = 3;

interface FxRateRow {
  id: string;
  market_rate: number;
  source: string;
  fetched_at: string;
}

export interface FxRateStatus {
  marketRate: number;
  effectiveRate: number;
  markupPct: number;
  source: string;
  fetchedAt: string;
  ageHours: number;
  stale: boolean;
  fallback: boolean;
}

interface CachedRate {
  status: FxRateStatus;
  cachedAt: number;
}

let cache: CachedRate | null = null;

function invalidateCache(): void {
  cache = null;
}

async function readMarkupPct(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'fx_markup_pct')
    .maybeSingle();

  if (error) {
    logger.warn('fx: markup read failed, defaulting to 3', { error: error.message });
    return 3;
  }

  const parsed = Number(data?.value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 30) {
    return 3;
  }
  return parsed;
}

async function readLatestRateRow(): Promise<FxRateRow | null> {
  // Prefer a recent manual override (admin set the rate by hand). If absent
  // or expired, fall through to the most recent automatic fetch.
  const overrideCutoff = new Date(Date.now() - MANUAL_OVERRIDE_TTL_MS).toISOString();

  const { data: manualRow } = await supabaseAdmin
    .from('fx_rates')
    .select('id, market_rate, source, fetched_at')
    .eq('base', 'USD')
    .eq('quote', 'PYG')
    .eq('source', 'manual')
    .gte('fetched_at', overrideCutoff)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (manualRow) {
    return manualRow as FxRateRow;
  }

  const { data: autoRow, error } = await supabaseAdmin
    .from('fx_rates')
    .select('id, market_rate, source, fetched_at')
    .eq('base', 'USD')
    .eq('quote', 'PYG')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('fx: latest row read failed', { error: error.message });
    return null;
  }
  return (autoRow as FxRateRow | null) ?? null;
}

function buildStatus(
  row: FxRateRow | null,
  markupPct: number
): FxRateStatus {
  if (!row) {
    const fallbackRate = env.USD_TO_PYG_RATE;
    logger.warn('fx: no rate row found, using env fallback', {
      fallback: fallbackRate
    });
    const effective = Math.round(fallbackRate * (1 + markupPct / 100) * 10000) / 10000;
    return {
      marketRate: fallbackRate,
      effectiveRate: effective,
      markupPct,
      source: 'env_fallback',
      fetchedAt: new Date(0).toISOString(),
      ageHours: Number.POSITIVE_INFINITY,
      stale: true,
      fallback: true
    };
  }

  const ageMs = Date.now() - new Date(row.fetched_at).getTime();
  const ageHours = ageMs / 3_600_000;
  const effective = Math.round(row.market_rate * (1 + markupPct / 100) * 10000) / 10000;

  return {
    marketRate: row.market_rate,
    effectiveRate: effective,
    markupPct,
    source: row.source,
    fetchedAt: row.fetched_at,
    ageHours,
    stale: ageMs > STALE_THRESHOLD_MS,
    fallback: false
  };
}

export async function getCurrentFxRate(): Promise<FxRateStatus> {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.status;
  }

  const [row, markupPct] = await Promise.all([readLatestRateRow(), readMarkupPct()]);
  const status = buildStatus(row, markupPct);

  if (status.stale && !status.fallback) {
    logger.warn('fx: latest rate is stale', {
      source: status.source,
      age_hours: status.ageHours.toFixed(1),
      market_rate: status.marketRate
    });
  }

  cache = { status, cachedAt: Date.now() };
  return status;
}

interface OpenErApiResponse {
  result: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
}

async function fetchPrimary(): Promise<number> {
  const response = await axios.get<OpenErApiResponse>(PRIMARY_SOURCE_URL, {
    timeout: FETCH_TIMEOUT_MS
  });

  if (response.data.result !== 'success' || !response.data.rates?.PYG) {
    throw new Error(`Unexpected open.er-api response: ${JSON.stringify(response.data).slice(0, 200)}`);
  }

  const rate = response.data.rates.PYG;
  if (!Number.isFinite(rate) || rate < 1000 || rate > 20000) {
    // Sanity check. PYG/USD has historically traded between 5000 and 8000.
    // A value outside this band almost certainly means a bad upstream payload
    // and we refuse to persist it.
    throw new Error(`PYG rate ${rate} outside sanity band [1000, 20000]`);
  }
  return rate;
}

export async function fetchAndStoreFxRate(): Promise<{ market_rate: number; source: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_COUNT; attempt++) {
    try {
      const rate = await fetchPrimary();
      const { error } = await supabaseAdmin.from('fx_rates').insert({
        base: 'USD',
        quote: 'PYG',
        market_rate: rate,
        source: 'open.er-api.com'
      });
      if (error) {
        throw new Error(`fx insert failed: ${error.message}`);
      }
      invalidateCache();
      logger.info('fx: rate fetched and stored', { market_rate: rate, attempt });
      return { market_rate: rate, source: 'open.er-api.com' };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('fx: fetch attempt failed', {
        attempt,
        error: lastError.message
      });
      if (attempt < FETCH_RETRY_COUNT) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error('fx fetch failed for unknown reason');
}

export async function setManualOverride(marketRate: number): Promise<FxRateStatus> {
  if (!Number.isFinite(marketRate) || marketRate < 1000 || marketRate > 20000) {
    throw new Error('Manual rate must be between 1000 and 20000');
  }
  const { error } = await supabaseAdmin.from('fx_rates').insert({
    base: 'USD',
    quote: 'PYG',
    market_rate: marketRate,
    source: 'manual'
  });
  if (error) {
    throw new Error(`fx manual override insert failed: ${error.message}`);
  }
  invalidateCache();
  return getCurrentFxRate();
}

export async function setMarkupPct(markupPct: number): Promise<FxRateStatus> {
  if (!Number.isFinite(markupPct) || markupPct < 0 || markupPct > 30) {
    throw new Error('Markup must be between 0 and 30 percent');
  }
  const { error } = await supabaseAdmin
    .from('settings')
    .upsert({ key: 'fx_markup_pct', value: String(markupPct) }, { onConflict: 'key' });
  if (error) {
    throw new Error(`fx markup upsert failed: ${error.message}`);
  }
  invalidateCache();
  return getCurrentFxRate();
}

export interface ConvertedAmount {
  amountPyg: number;
  effectiveRate: number;
}

export async function convertUsdToPygWithSnapshot(amountUsd: number): Promise<ConvertedAmount> {
  const status = await getCurrentFxRate();
  const amountPyg = Math.round(amountUsd * status.effectiveRate);
  return { amountPyg, effectiveRate: status.effectiveRate };
}
