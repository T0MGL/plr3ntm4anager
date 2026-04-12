import axios from 'axios';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { BookingStatus, PaymentStatus } from '../types';
import { logger } from '../config/logger';
import { sendEmail } from './email.service';
import { paymentConfirmedEmail, paymentFailedEmail } from '../templates/emails';

// Bancard VPOS 2.0 Token Generation (MD5)
// Spec: Token is always MD5 (32 chars). Numbers must be strings with 2 decimals.

function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function generateShopProcessId(): number {
  // Bancard requires Entero(15), max 15 digit integer.
  // Date.now() gives 13 digits, unique enough for our volume.
  return Date.now();
}

// Token formulas per Bancard VPOS 2.0 spec (page 8):
// single_buy:               md5(private_key + shop_process_id + amount + currency)
// single_buy_confirm:       md5(private_key + shop_process_id + "confirm" + amount + currency)
// single_buy_rollback:      md5(private_key + shop_process_id + "rollback" + "0.00")
// get_confirmation:         md5(private_key + shop_process_id + "get_confirmation")
// preauthorization_confirm: md5(private_key + shop_process_id + "pre-authorization-confirm")

function tokenForSingleBuy(shopProcessId: number, amount: string, currency: string): string {
  return md5(`${env.BANCARD_PRIVATE_KEY}${shopProcessId}${amount}${currency}`);
}

function tokenForConfirm(shopProcessId: string, amount: string, currency: string): string {
  return md5(`${env.BANCARD_PRIVATE_KEY}${shopProcessId}confirm${amount}${currency}`);
}

function tokenForRollback(shopProcessId: string): string {
  return md5(`${env.BANCARD_PRIVATE_KEY}${shopProcessId}rollback0.00`);
}

function tokenForGetConfirmation(shopProcessId: string): string {
  return md5(`${env.BANCARD_PRIVATE_KEY}${shopProcessId}get_confirmation`);
}

function tokenForPreauthorizationConfirm(shopProcessId: string): string {
  return md5(`${env.BANCARD_PRIVATE_KEY}${shopProcessId}pre-authorization-confirm`);
}

// True when PAYMENT_MODE is stub (no real Bancard calls)
const isStubMode = (): boolean => env.PAYMENT_MODE === 'stub';

// Currency conversion

function convertUsdToPyg(amountUsd: number): number {
  return Math.round(amountUsd * env.USD_TO_PYG_RATE);
}

// Bancard API URL helper

function bancardUrl(path: string): string {
  // Environments per spec:
  //   Production: https://vpos.infonet.com.py
  //   Staging:    https://vpos.infonet.com.py:8888
  return `${env.BANCARD_API_URL}/vpos/api/0.3/${path}`;
}

// Interfaces

interface SingleBuyResult {
  process_id: string;
  shop_process_id: number;
  bancard_url: string;
}

interface BancardConfirmationPayload {
  operation: {
    token: string;
    shop_process_id: string;
    response: string; // "S" = success, "N" = denied
    response_details: string;
    extended_response_description?: string;
    currency: string;
    amount: string;
    authorization_number?: string;
    ticket_number?: string;
    response_code: string;
    response_description: string;
    security_information?: Record<string, unknown>;
    billing_response?: Record<string, unknown>;
  };
}

interface BancardApiResponse {
  status?: string;
  process_id?: string;
  confirmation?: Record<string, unknown>;
  messages?: Array<{ key?: string; level?: string; dsc?: string }>;
}

// Single Buy (Pedido de pago)
// POST {environment}/vpos/api/0.3/single_buy
// Spec pages 9-17
//
// Park Lofts policy: Single Buy DIRECTO (no preauthorization). Simplicity
// over features. `options.preauthorization` is kept for flexibility but
// defaults to false.
//
// IMPORTANT: The request body MUST NOT include a `test_client` field.
// Per Bancard spec v1.22 pg 10/44/51/55, sending `test_client` keeps the
// transaction out of the production test list, which breaks certification.

export async function createSingleBuy(
  bookingId: string,
  options?: { preauthorization?: boolean }
): Promise<SingleBuyResult> {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id, status, total_price_usd, guest_name, guest_email')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    throw new Error('Booking not found');
  }

  if (![BookingStatus.Pending, BookingStatus.Approved].includes(booking.status as BookingStatus)) {
    throw new Error('Booking is not eligible for payment');
  }

  // Per-booking attempt cap. Bancard blocks cards for 30 days after 7
  // attempts in 24h (spec v1.22 pg 84), so we cap aggressively by booking
  // to stay under that limit regardless of how many IPs a client uses.
  const recentFailuresCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: failedAttempts } = await supabaseAdmin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('payment_status', PaymentStatus.Failed)
    .gte('created_at', recentFailuresCutoff);

  if ((failedAttempts ?? 0) >= 5) {
    logger.warn('Booking hit payment attempt cap', {
      booking_id: bookingId,
      failed_attempts: failedAttempts
    });
    throw new Error('Too many payment attempts for this booking, please contact support');
  }

  // Reuse any existing active payment instead of creating a duplicate.
  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id, bancard_process_id, shop_process_id, payment_status')
    .eq('booking_id', bookingId)
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
  const amountPyg = convertUsdToPyg(booking.total_price_usd);
  const amountStr = formatAmount(amountPyg);
  const currency = 'PYG';
  const usePreauth = options?.preauthorization ?? false;

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert({
      booking_id: bookingId,
      amount_usd: booking.total_price_usd,
      amount_pyg: amountPyg,
      shop_process_id: String(shopProcessId),
      payment_status: PaymentStatus.Pending,
      payment_method: 'bancard',
      is_preauthorization: usePreauth
    })
    .select('id')
    .single();

  if (paymentError || !payment) {
    logger.error('Failed to create payment record', {
      error: paymentError?.message,
      bookingId
    });
    throw new Error('Failed to create payment record');
  }

  // Stub mode for local development
  if (isStubMode()) {
    const stubProcessId = `stub_${shopProcessId}`;
    await supabaseAdmin
      .from('payments')
      .update({
        bancard_process_id: stubProcessId,
        bancard_response: { mode: 'stub', type: 'single_buy' }
      })
      .eq('id', payment.id);

    return {
      process_id: stubProcessId,
      shop_process_id: shopProcessId,
      bancard_url: env.BANCARD_API_URL
    };
  }

  const token = tokenForSingleBuy(shopProcessId, amountStr, currency);
  const returnUrl = `${env.FRONTEND_URL}/payment/result?booking=${bookingId}`;
  const cancelUrl = `${env.FRONTEND_URL}/payment/cancelled?booking=${bookingId}`;
  const description = `Reserva ${bookingId.substring(0, 8)}`.substring(0, 20);

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
      cancel_url: cancelUrl,
      ...(usePreauth ? { preauthorization: 'S' } : {})
    }
  };

  try {
    logger.info('Bancard single_buy request', {
      shop_process_id: shopProcessId,
      amount_pyg: amountStr,
      preauthorization: usePreauth
    });

    const response = await axios.post(bancardUrl('single_buy'), requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const data = response.data as BancardApiResponse;

    if (data.status !== 'success' || !data.process_id) {
      const errorMsg = data.messages?.[0]?.dsc || 'Bancard returned an error';
      logger.error('Bancard single_buy failed', { response: data });
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
      logger.error('Bancard API error', {
        status: error.response.status,
        data: error.response.data
      });
    }

    throw error instanceof Error ? error : new Error('Bancard request failed');
  }
}

// Handle Bancard Confirmation (Buy Single Confirm)
// Bancard POSTs to our confirmation URL when a transaction completes.
// We MUST respond with HTTP 200 and {"status":"success"} within 30 seconds.
// Spec pages 44-49
//
// Split into two phases:
//   1. verifyAndMarkBancardConfirmation: critical path (<500ms). Validates
//      the MD5 token and flips payment + booking status. This MUST finish
//      before we reply 200 so state is consistent on Bancard retries.
//   2. processBancardConfirmationBackground: fire-and-forget side effects
//      (emails, audit logs, extra sync). Safe to run after sending 200.

interface BancardConfirmationResult {
  paymentId: string;
  bookingId: string;
  approved: boolean;
}

export async function verifyAndMarkBancardConfirmation(
  payload: BancardConfirmationPayload
): Promise<BancardConfirmationResult> {
  const { operation } = payload;

  if (!operation?.shop_process_id || !operation?.response) {
    throw new Error('Invalid confirmation payload');
  }

  const expectedToken = tokenForConfirm(
    String(operation.shop_process_id),
    operation.amount,
    operation.currency
  );

  if (operation.token !== expectedToken) {
    // Debug: show both tokens + the inputs used to compute the expected one.
    // Helps diagnose test wizard mismatches (different private key, amount
    // format, currency casing, etc). Remove once Bancard certifies.
    logger.warn('Invalid confirmation token', {
      shop_process_id: operation.shop_process_id,
      token_received: operation.token,
      token_expected: expectedToken,
      amount_used: operation.amount,
      currency_used: operation.currency,
      private_key_prefix: env.BANCARD_PRIVATE_KEY.slice(0, 8) + '...',
      formula: 'md5(private_key + shop_process_id + "confirm" + amount + currency)'
    });
    throw new Error('Invalid confirmation token');
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, amount_pyg, is_preauthorization')
    .eq('shop_process_id', String(operation.shop_process_id))
    .single();

  if (paymentError || !payment) {
    logger.error('Payment not found for confirmation', {
      shop_process_id: operation.shop_process_id,
      error: paymentError?.message
    });
    throw new Error(`Payment not found for shop_process_id: ${operation.shop_process_id}`);
  }

  const approved = operation.response === 'S';

  if (approved) {
    const newStatus = payment.is_preauthorization
      ? PaymentStatus.Preauthorized
      : PaymentStatus.Completed;

    await supabaseAdmin
      .from('payments')
      .update({
        payment_status: newStatus,
        completed_at: newStatus === PaymentStatus.Completed ? new Date().toISOString() : null,
        bancard_response: operation as unknown as Record<string, unknown>,
        authorization_number: operation.authorization_number || null,
        response_code: operation.response_code
      })
      .eq('id', payment.id);

    if (!payment.is_preauthorization) {
      await supabaseAdmin
        .from('booking_requests')
        .update({
          status: BookingStatus.Paid,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.booking_id);
    }
  } else {
    await supabaseAdmin
      .from('payments')
      .update({
        payment_status: PaymentStatus.Failed,
        failed_at: new Date().toISOString(),
        failure_reason:
          operation.response_description || operation.response_details || 'Payment denied',
        bancard_response: operation as unknown as Record<string, unknown>,
        response_code: operation.response_code
      })
      .eq('id', payment.id);
  }

  return {
    paymentId: payment.id,
    bookingId: payment.booking_id,
    approved
  };
}

export function processBancardConfirmationBackground(
  payload: BancardConfirmationPayload,
  result: BancardConfirmationResult
): void {
  setImmediate(async () => {
    try {
      logger.info('Bancard confirmation processed', {
        shop_process_id: payload.operation.shop_process_id,
        approved: result.approved,
        booking_id: result.bookingId,
        response_code: payload.operation.response_code
      });

      const { data: booking } = await supabaseAdmin
        .from('booking_requests')
        .select('guest_email, guest_name, check_in_date, check_out_date, total_price_usd, unit_id, locale')
        .eq('id', result.bookingId)
        .single();

      if (!booking?.guest_email) {
        logger.warn('No guest email for payment confirmation', { booking_id: result.bookingId });
        return;
      }

      const { data: unit } = await supabaseAdmin
        .from('units')
        .select('name')
        .eq('id', booking.unit_id)
        .single();

      const unitName = unit?.name ?? 'Park Lofts';

      if (result.approved) {
        const confirmed = paymentConfirmedEmail({
          guestName: booking.guest_name,
          unitName,
          checkIn: booking.check_in_date,
          checkOut: booking.check_out_date,
          totalUsd: booking.total_price_usd,
          locale: booking.locale
        });
        await sendEmail(booking.guest_email, confirmed.subject, confirmed.html);
      } else {
        const failed = paymentFailedEmail({ guestName: booking.guest_name, locale: booking.locale });
        await sendEmail(booking.guest_email, failed.subject, failed.html);
      }
    } catch (err) {
      logger.error('Bancard confirmation background job failed', {
        error: err instanceof Error ? err.message : 'unknown',
        booking_id: result.bookingId
      });
    }
  });
}


// Confirm Preauthorization (Capture)
// POST {environment}/vpos/api/0.3/preauthorizations/confirm
// Spec pages 61-65

export async function confirmPreauthorization(
  bookingId: string,
  amountOverride?: number
): Promise<void> {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('id, shop_process_id, payment_status, amount_pyg, is_preauthorization')
    .eq('booking_id', bookingId)
    .eq('payment_status', PaymentStatus.Preauthorized)
    .maybeSingle();

  if (paymentError || !payment) {
    throw new Error('No preauthorized payment found for this booking');
  }

  if (isStubMode()) {
    await supabaseAdmin
      .from('payments')
      .update({
        payment_status: PaymentStatus.Completed,
        completed_at: new Date().toISOString(),
        bancard_response: { mode: 'stub', type: 'preauthorization_confirm' }
      })
      .eq('id', payment.id);

    await supabaseAdmin
      .from('booking_requests')
      .update({
        status: BookingStatus.Paid,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);
    return;
  }

  const token = tokenForPreauthorizationConfirm(payment.shop_process_id);

  const operationBody: Record<string, unknown> = {
    token,
    shop_process_id: payment.shop_process_id
  };

  if (amountOverride != null) {
    operationBody.amount = formatAmount(amountOverride);
  }

  const requestBody = {
    public_key: env.BANCARD_PUBLIC_KEY,
    operation: operationBody
  };

  logger.info('Bancard preauthorization confirm', {
    shop_process_id: payment.shop_process_id,
    booking_id: bookingId
  });

  const response = await axios.post(bancardUrl('preauthorizations/confirm'), requestBody, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  });

  const data = response.data as BancardApiResponse;

  if (data.status !== 'success') {
    const errorMsg = data.messages?.[0]?.dsc || 'Preauthorization confirmation failed';
    logger.error('Preauthorization confirm failed', { response: data });
    throw new Error(errorMsg);
  }

  await supabaseAdmin
    .from('payments')
    .update({
      payment_status: PaymentStatus.Completed,
      completed_at: new Date().toISOString(),
      bancard_response: data
    })
    .eq('id', payment.id);

  await supabaseAdmin
    .from('booking_requests')
    .update({
      status: BookingStatus.Paid,
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId);
}

// Rollback (Reversa de transaccion)
// POST {environment}/vpos/api/0.3/single_buy/rollback
// Spec v1.22 pages 50-54. v1.20 used single_buy_rollback (404 now).

export async function rollbackPayment(bookingId: string): Promise<void> {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('id, shop_process_id, payment_status')
    .eq('booking_id', bookingId)
    .in('payment_status', [
      PaymentStatus.Pending,
      PaymentStatus.Preauthorized,
      PaymentStatus.Completed
    ])
    .maybeSingle();

  if (paymentError || !payment) {
    logger.info('No active payment to rollback', { booking_id: bookingId });
    return;
  }

  if (isStubMode()) {
    await supabaseAdmin
      .from('payments')
      .update({
        payment_status: PaymentStatus.Refunded,
        bancard_response: { mode: 'stub', type: 'rollback' }
      })
      .eq('id', payment.id);
    return;
  }

  const token = tokenForRollback(payment.shop_process_id);

  const requestBody = {
    public_key: env.BANCARD_PUBLIC_KEY,
    operation: {
      token,
      shop_process_id: payment.shop_process_id
    }
  };

  logger.info('Bancard rollback', {
    shop_process_id: payment.shop_process_id,
    booking_id: bookingId
  });

  const response = await axios.post(bancardUrl('single_buy/rollback'), requestBody, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true
  });

  const data = response.data as BancardApiResponse;

  if (data.status !== 'success') {
    const errorKey = data.messages?.[0]?.key;
    // Idempotent states: treat as already-done so admin retries never fail.
    if (errorKey === 'PaymentNotFoundError') {
      logger.info('Rollback: no payment found (user never completed)', {
        shop_process_id: payment.shop_process_id
      });
    } else if (errorKey === 'AlreadyRollbackedError') {
      logger.info('Rollback: already rollbacked (idempotent)', {
        shop_process_id: payment.shop_process_id
      });
    } else {
      const errorMsg = data.messages?.[0]?.dsc || 'Rollback failed';
      logger.error('Rollback failed', { response: data, status: response.status });
      throw new Error(errorMsg);
    }
  }

  await supabaseAdmin
    .from('payments')
    .update({
      payment_status: PaymentStatus.Refunded,
      bancard_response: data
    })
    .eq('id', payment.id);
}

// Get Confirmation (Consulta de transaccion)
// POST {environment}/vpos/api/0.3/single_buy/confirmations
// Spec pages 55-60

export async function getPaymentConfirmation(
  bookingId: string
): Promise<BancardApiResponse> {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('id, shop_process_id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (paymentError || !payment) {
    throw new Error('Payment not found for this booking');
  }

  if (isStubMode()) {
    return { status: 'success', messages: [{ key: 'stub', dsc: 'Stub mode' }] };
  }

  const token = tokenForGetConfirmation(payment.shop_process_id);

  const requestBody = {
    public_key: env.BANCARD_PUBLIC_KEY,
    operation: {
      token,
      shop_process_id: payment.shop_process_id
    }
  };

  const response = await axios.post(bancardUrl('single_buy/confirmations'), requestBody, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  });

  return response.data as BancardApiResponse;
}

// Backward-compatible alias used by admin.routes.ts when approving a booking.
// In Single Buy DIRECTO mode there is nothing to capture because the payment
// is already completed, so this becomes a no-op for non-preauth payments.

export async function capturePaymentForBooking(bookingId: string): Promise<void> {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, payment_status, is_preauthorization')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (!payment) {
    return;
  }

  if (payment.payment_status === PaymentStatus.Preauthorized && payment.is_preauthorization) {
    await confirmPreauthorization(bookingId);
    return;
  }

  if (payment.payment_status === PaymentStatus.Pending && isStubMode()) {
    await supabaseAdmin
      .from('payments')
      .update({
        payment_status: PaymentStatus.Completed,
        completed_at: new Date().toISOString(),
        bancard_response: { mode: 'stub', type: 'capture' }
      })
      .eq('id', payment.id);

    await supabaseAdmin
      .from('booking_requests')
      .update({
        status: BookingStatus.Paid,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);
  }
}
