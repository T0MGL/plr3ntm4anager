import axios from 'axios';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { PaymentStatus } from '../types';
import { logger } from '../config/logger';
import { convertUsdToPygWithSnapshot } from './fx-rate.service';

// Standalone payment links. An admin creates a link for a fixed USD amount and
// a concept; anyone with the link pays by card through the same Bancard vPOS
// flow as bookings. This service owns link CRUD and the link-specific Single
// Buy. The shared confirmation webhook lives in payment.service.ts and branches
// on whether the payment row carries a booking_id or a payment_link_id.

function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function generateShopProcessId(): number {
  return Date.now();
}

function tokenForSingleBuy(shopProcessId: number, amount: string, currency: string): string {
  return md5(`${env.BANCARD_PRIVATE_KEY}${shopProcessId}${amount}${currency}`);
}

const isStubMode = (): boolean => env.PAYMENT_MODE === 'stub';

function bancardUrl(path: string): string {
  return `${env.BANCARD_API_URL}/vpos/api/0.3/${path}`;
}

interface BancardApiResponse {
  status?: string;
  process_id?: string;
  messages?: Array<{ key?: string; level?: string; dsc?: string }>;
}

export interface PaymentLink {
  id: string;
  amount_usd: number;
  amount_pyg: number;
  fx_rate_snapshot: number;
  concept: string;
  status: 'active' | 'paid' | 'expired';
  shop_process_id: string | null;
  booking_id: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// Fields safe to expose on the public /pay page. The link id is unguessable by
// construction, but we still never leak shop_process_id or internal timestamps
// beyond what the page renders.
export interface PublicPaymentLink {
  id: string;
  amount_usd: number;
  amount_pyg: number;
  concept: string;
  status: 'active' | 'paid' | 'expired';
  expired: boolean;
}

interface CreatePaymentLinkInput {
  amountUsd: number;
  concept: string;
  bookingId?: string | null;
  expiresAt?: string | null;
}

export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink> {
  const { amountPyg, effectiveRate } = await convertUsdToPygWithSnapshot(input.amountUsd);

  const { data, error } = await supabaseAdmin
    .from('payment_links')
    .insert({
      amount_usd: input.amountUsd,
      amount_pyg: amountPyg,
      fx_rate_snapshot: effectiveRate,
      concept: input.concept,
      booking_id: input.bookingId ?? null,
      expires_at: input.expiresAt ?? null
    })
    .select(
      'id, amount_usd, amount_pyg, fx_rate_snapshot, concept, status, shop_process_id, booking_id, expires_at, paid_at, created_at, updated_at'
    )
    .single();

  if (error || !data) {
    logger.error('Failed to create payment link', { error: error?.message });
    throw new Error('Failed to create payment link');
  }

  return data as PaymentLink;
}

export async function listPaymentLinks(limit = 100, offset = 0): Promise<PaymentLink[]> {
  const { data, error } = await supabaseAdmin
    .from('payment_links')
    .select(
      'id, amount_usd, amount_pyg, fx_rate_snapshot, concept, status, shop_process_id, booking_id, expires_at, paid_at, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to list payment links', { error: error.message });
    throw new Error('Failed to list payment links');
  }

  return (data ?? []) as PaymentLink[];
}

function isExpired(link: Pick<PaymentLink, 'expires_at'>): boolean {
  return !!link.expires_at && new Date(link.expires_at).getTime() < Date.now();
}

export async function getPublicPaymentLink(id: string): Promise<PublicPaymentLink | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_links')
    .select('id, amount_usd, amount_pyg, concept, status, expires_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error('Failed to read payment link', { error: error.message, id });
    throw new Error('Failed to read payment link');
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    amount_usd: Number(data.amount_usd),
    amount_pyg: Number(data.amount_pyg),
    concept: data.concept,
    status: data.status,
    expired: isExpired(data)
  };
}

interface SingleBuyResult {
  process_id: string;
  shop_process_id: number;
  bancard_url: string;
}

// Single Buy DIRECTO for a payment link. Mirrors createSingleBuy in
// payment.service.ts but sources the amount from the link instead of a booking,
// and writes payment_link_id on the payment row so the webhook can branch.
export async function createSingleBuyForLink(linkId: string): Promise<SingleBuyResult> {
  const { data: link, error: linkError } = await supabaseAdmin
    .from('payment_links')
    .select('id, status, amount_usd, amount_pyg, expires_at')
    .eq('id', linkId)
    .single();

  if (linkError || !link) {
    throw new Error('Payment link not found');
  }

  if (link.status === 'paid') {
    throw new Error('This payment link has already been paid');
  }

  if (link.status === 'expired' || isExpired(link)) {
    throw new Error('This payment link has expired');
  }

  // Reuse an in-flight payment for the same link instead of creating a
  // duplicate Bancard process. A denied card leaves the payment as `failed`,
  // so a retry falls through to a fresh process_id.
  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id, bancard_process_id, shop_process_id')
    .eq('payment_link_id', linkId)
    .in('payment_status', [PaymentStatus.Pending, PaymentStatus.Preauthorized])
    .maybeSingle();

  if (existingPayment?.bancard_process_id) {
    return {
      process_id: existingPayment.bancard_process_id,
      shop_process_id: Number(existingPayment.shop_process_id),
      bancard_url: env.BANCARD_API_URL
    };
  }

  const shopProcessId = generateShopProcessId();
  const amountStr = formatAmount(Number(link.amount_pyg));
  const currency = 'PYG';

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert({
      payment_link_id: linkId,
      amount_usd: link.amount_usd,
      amount_pyg: link.amount_pyg,
      shop_process_id: String(shopProcessId),
      payment_status: PaymentStatus.Pending,
      payment_method: 'bancard',
      is_preauthorization: false
    })
    .select('id')
    .single();

  if (paymentError || !payment) {
    logger.error('Failed to create payment record for link', {
      error: paymentError?.message,
      link_id: linkId
    });
    throw new Error('Failed to create payment record');
  }

  // Stamp the shop_process_id on the link so the webhook can fall back to it
  // if needed and the admin list shows the latest attempt.
  await supabaseAdmin
    .from('payment_links')
    .update({ shop_process_id: String(shopProcessId) })
    .eq('id', linkId);

  if (isStubMode()) {
    const stubProcessId = `stub_${shopProcessId}`;
    await supabaseAdmin
      .from('payments')
      .update({
        bancard_process_id: stubProcessId,
        bancard_response: { mode: 'stub', type: 'single_buy_link' }
      })
      .eq('id', payment.id);

    return {
      process_id: stubProcessId,
      shop_process_id: shopProcessId,
      bancard_url: env.BANCARD_API_URL
    };
  }

  const token = tokenForSingleBuy(shopProcessId, amountStr, currency);
  const returnUrl = `${env.FRONTEND_URL}/pay/${linkId}?status=success`;
  const cancelUrl = `${env.FRONTEND_URL}/pay/${linkId}?status=cancelled`;
  const description = `Park Lofts ${linkId.substring(0, 8)}`.substring(0, 20);

  const requestBody = {
    public_key: env.BANCARD_PUBLIC_KEY,
    operation: {
      token,
      shop_process_id: shopProcessId,
      currency,
      amount: amountStr,
      additional_data: '',
      description,
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  };

  try {
    logger.info('Bancard single_buy request (link)', {
      shop_process_id: shopProcessId,
      amount_pyg: amountStr,
      link_id: linkId
    });

    const response = await axios.post(bancardUrl('single_buy'), requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const data = response.data as BancardApiResponse;

    if (data.status !== 'success' || !data.process_id) {
      const errorMsg = data.messages?.[0]?.dsc || 'Bancard returned an error';
      logger.error('Bancard single_buy (link) failed', { response: data });
      throw new Error(errorMsg);
    }

    await supabaseAdmin
      .from('payments')
      .update({
        bancard_process_id: data.process_id,
        bancard_response: data
      })
      .eq('id', payment.id);

    return {
      process_id: data.process_id,
      shop_process_id: shopProcessId,
      bancard_url: env.BANCARD_API_URL
    };
  } catch (error: unknown) {
    await supabaseAdmin
      .from('payments')
      .update({
        payment_status: PaymentStatus.Failed,
        failed_at: new Date().toISOString(),
        failure_reason: error instanceof Error ? error.message : 'Bancard request failed'
      })
      .eq('id', payment.id);

    if (axios.isAxiosError(error) && error.response) {
      logger.error('Bancard API error (link)', {
        status: error.response.status,
        data: error.response.data
      });
    }

    throw error instanceof Error ? error : new Error('Bancard request failed');
  }
}

// Open payment from the public /pay/:amount route. The amount in USD comes from
// the URL, is validated at the route layer, and is converted to PYG here at the
// day's FX (the same snapshot path as admin links). We never accept a PYG amount
// from the client: the authoritative charge is derived server-side from the USD
// value. Each open payment materializes one payment_link row so the existing
// Single Buy, return_url, retry-on-denial and confirmation webhook all apply
// unchanged. The link id is unguessable and only lives for this one charge.
export interface OpenPaymentResult extends SingleBuyResult {
  link_id: string;
  amount_usd: number;
  amount_pyg: number;
}

const OPEN_PAYMENT_CONCEPT = 'Pago a Park Lofts';

export async function createOpenPayment(amountUsd: number): Promise<OpenPaymentResult> {
  const link = await createPaymentLink({
    amountUsd,
    concept: OPEN_PAYMENT_CONCEPT
  });

  const singleBuy = await createSingleBuyForLink(link.id);

  return {
    ...singleBuy,
    link_id: link.id,
    amount_usd: Number(link.amount_usd),
    amount_pyg: Number(link.amount_pyg)
  };
}

// Marks the link paid on an approved charge. Called from the shared
// confirmation handler. Idempotent: a replayed webhook on an already-paid link
// is a no-op.
export async function markPaymentLinkPaid(linkId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('payment_links')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('status', 'active');

  if (error) {
    logger.error('Failed to mark payment link paid', { error: error.message, link_id: linkId });
    throw new Error('Failed to mark payment link paid');
  }
}
