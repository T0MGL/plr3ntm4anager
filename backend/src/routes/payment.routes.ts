import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { paymentCreateRateLimit, openPaymentRateLimit } from '../middleware/rate-limit.middleware';
import { supabaseAdmin } from '../config/supabase';
import {
  createSingleBuy,
  verifyAndMarkBancardConfirmation,
  processBancardConfirmationBackground,
  rollbackPayment,
  getPaymentConfirmation
} from '../services/payment.service';
import {
  createSingleBuyForLink,
  createOpenPayment,
  getPublicPaymentLink,
  getLinkReceiptData
} from '../services/payment-link.service';
import { buildReceiptPdf } from '../services/receipt-pdf.service';
import { getCurrentFxRate } from '../services/fx-rate.service';
import { decideApprovalPath } from '../services/approval-routing.service';
import { logger } from '../config/logger';
import { BookingStatus } from '../types';

const router = Router();

// POST /payments/preauth
//
// Dual-path entrypoint. The widget calls this after the guest confirms the
// booking request. We:
//
//   1. Load the booking and its unit (needed for inline sync + availability).
//   2. Run decideApprovalPath() which does an inline sync, checks sync
//      freshness, and verifies dates are free.
//   3. Persist the decision on the booking row so the admin dashboard and
//      audit trail always know which path a booking took.
//   4. Delegate to createSingleBuy() with preauthorization=true for manual,
//      preauthorization=false for auto. Bancard renders the same iframe in
//      both cases; the difference is whether the card is captured instantly
//      or only authorized for later capture.
//
// Clients may still pass `preauthorization` explicitly (used by internal
// tests). If present, it wins over the routing decision.

const preauthSchema = z.object({
  body: z.object({
    booking_id: z.string().uuid(),
    preauthorization: z.boolean().optional()
  })
});

router.post('/preauth', paymentCreateRateLimit, validate(preauthSchema), async (req, res) => {
  const bookingId = req.body.booking_id;
  const overridePreauth = req.body.preauthorization;

  try {
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('id, status, unit_id, check_in_date, check_out_date')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (![BookingStatus.Pending, BookingStatus.Approved].includes(booking.status as BookingStatus)) {
      return res.status(400).json({ error: 'Booking is not eligible for payment' });
    }

    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('id, airbnb_ical_url')
      .eq('id', booking.unit_id)
      .single();

    if (unitError || !unit) {
      logger.error('Preauth: unit lookup failed', {
        booking_id: bookingId,
        error: unitError?.message
      });
      return res.status(500).json({ error: 'Unit lookup failed' });
    }

    const decision = await decideApprovalPath({
      unitId: unit.id,
      unitIcalUrl: unit.airbnb_ical_url ?? null,
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      excludeBookingId: booking.id
    });

    logger.info('Approval path decided', {
      booking_id: bookingId,
      path: decision.path,
      reason: decision.reason,
      sync_age_min: decision.syncAgeMinutes,
      inline_sync: decision.inlineSyncStatus
    });

    const { error: decisionUpdateError } = await supabaseAdmin
      .from('booking_requests')
      .update({
        approval_path: decision.path,
        approval_decision_reason: decision.reason,
        sync_age_minutes_at_decision: decision.syncAgeMinutes,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (decisionUpdateError) {
      logger.error('Preauth: failed to persist approval decision', {
        booking_id: bookingId,
        error: decisionUpdateError.message
      });
      return res.status(500).json({ error: 'Failed to record approval decision' });
    }

    const usePreauth = overridePreauth ?? decision.path === 'manual';

    const result = await createSingleBuy(bookingId, { preauthorization: usePreauth });

    return res.json({
      process_id: result.process_id,
      shop_process_id: result.shop_process_id,
      bancard_url: result.bancard_url,
      approval_path: decision.path
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    logger.error('Payment preauth failed', {
      error: message,
      booking_id: bookingId
    });
    return res.status(400).json({ error: message });
  }
});

// POST /payments/confirmation
// Bancard POSTs here when a transaction completes (Buy Single Confirm).
// MUST respond with HTTP 200 + {"status":"success"} within 30 seconds.
//
// Critical path:
//   1. Validate MD5 token
//   2. Flip payment + booking status in DB
//   3. Reply 200
//   4. Everything else runs in setImmediate (emails, audit, notifications).

router.post('/confirmation', async (req, res) => {
  // Hard timeout guard: if anything in the handler stalls, close the socket
  // before Bancard's 30s window expires so we never get marked as invalid.
  res.setTimeout(25000, () => {
    logger.error('Bancard confirmation handler timed out', {
      shop_process_id: req.body?.operation?.shop_process_id
    });
    if (!res.headersSent) {
      res.status(200).json({ status: 'success' });
    }
  });

  const startedAt = Date.now();

  try {
    logger.info('Bancard confirmation received', {
      shop_process_id: req.body?.operation?.shop_process_id,
      response: req.body?.operation?.response,
      amount: req.body?.operation?.amount,
      currency: req.body?.operation?.currency,
      token_received: req.body?.operation?.token,
      full_body: JSON.stringify(req.body)
    });

    const result = await verifyAndMarkBancardConfirmation(req.body);

    res.status(200).json({ status: 'success' });

    logger.info('Bancard confirmation ack', {
      shop_process_id: req.body?.operation?.shop_process_id,
      booking_id: result.bookingId,
      approved: result.approved,
      elapsed_ms: Date.now() - startedAt
    });

    processBancardConfirmationBackground(req.body, result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Confirmation processing failed';
    logger.error('Bancard confirmation error', {
      error: message,
      shop_process_id: req.body?.operation?.shop_process_id,
      elapsed_ms: Date.now() - startedAt
    });
    // Bancard spec: always return 200 with success body, otherwise the
    // confirmation is marked invalid and the transaction state is poisoned.
    if (!res.headersSent) {
      res.status(200).json({ status: 'success' });
    }
  }
});

// POST /payments/rollback
// Rollback/reverse a payment. Used by admin when rejecting bookings.

const rollbackSchema = z.object({
  body: z.object({
    booking_id: z.string().uuid()
  })
});

router.post('/rollback', requireAuth, validate(rollbackSchema), async (req, res) => {
  try {
    await rollbackPayment(req.body.booking_id);
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Rollback failed';
    logger.error('Payment rollback failed', {
      error: message,
      booking_id: req.body?.booking_id
    });
    return res.status(400).json({ error: message });
  }
});

// POST /payments/check-status
// Query Bancard for the status of a transaction (get_single_buy_confirmation).

const checkStatusSchema = z.object({
  body: z.object({
    booking_id: z.string().uuid()
  })
});

router.post('/check-status', requireAuth, validate(checkStatusSchema), async (req, res) => {
  try {
    const result = await getPaymentConfirmation(req.body.booking_id);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Status check failed';
    logger.error('Payment status check failed', {
      error: message,
      booking_id: req.body?.booking_id
    });
    return res.status(400).json({ error: message });
  }
});

// GET /payments/links/:id
// Public lookup for the /pay/:id page. Returns only render-safe fields. The
// UUID is unguessable by construction so no auth is required, matching the
// public booking lookup posture in booking.routes.ts.

const linkParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

router.get('/links/:id', validate(linkParamsSchema), async (req, res) => {
  try {
    const link = await getPublicPaymentLink(req.params.id);
    if (!link) {
      return res.status(404).json({ error: 'Payment link not found' });
    }
    return res.json(link);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load payment link';
    logger.error('GET /payments/links/:id failed', { error: message, id: req.params.id });
    return res.status(500).json({ error: message });
  }
});

// GET /payments/links/:id/receipt
// Streams the branded comprobante PDF for a paid link. Emits only when the link
// is paid and a completed payment exists: getLinkReceiptData returns null for a
// pending or failed charge and we answer 404, so a receipt can never leak for an
// unpaid link. The id is the same unguessable UUID the public lookup uses, so no
// auth, matching the rest of the public link surface.
router.get('/links/:id/receipt', validate(linkParamsSchema), async (req, res) => {
  try {
    const data = await getLinkReceiptData(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'No hay un comprobante disponible para este pago' });
    }

    const pdf = await buildReceiptPdf(data);
    const filename = `comprobante-park-lofts-${data.linkId.slice(0, 8)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(pdf);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el comprobante';
    logger.error('GET /payments/links/:id/receipt failed', { error: message, id: req.params.id });
    return res.status(500).json({ error: message });
  }
});

// POST /payments/links/:id/pay
// Starts a Bancard Single Buy for a payment link and returns the process_id the
// frontend feeds to the Bancard Checkout iframe. Rate limited the same as
// booking checkouts to stay under the Bancard per-card attempt block.

router.post(
  '/links/:id/pay',
  openPaymentRateLimit,
  validate(linkParamsSchema),
  async (req, res) => {
    try {
      const result = await createSingleBuyForLink(req.params.id);
      return res.json({
        process_id: result.process_id,
        shop_process_id: result.shop_process_id,
        bancard_url: result.bancard_url
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Payment initiation failed';
      logger.error('POST /payments/links/:id/pay failed', {
        error: message,
        id: req.params.id
      });
      return res.status(400).json({ error: message });
    }
  }
);

// GET /payments/fx
// Public effective USD -> PYG rate for the open /pay page so it can show the PYG
// equivalent before the user pays. Render-only: the authoritative charge amount
// is always recomputed server-side at Single Buy time, never trusted from here.

router.get('/fx', async (_req, res) => {
  try {
    const status = await getCurrentFxRate();
    return res.json({ effective_rate: status.effectiveRate });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load FX rate';
    logger.error('GET /payments/fx failed', { error: message });
    return res.status(500).json({ error: message });
  }
});

// POST /payments/open
// Open card payment for the public rent.parkloftsparaguay.com/pay/:amount page.
// The amount in USD arrives in the request body (parsed from the URL by the
// widget) and is validated here: positive, at least 1 USD, at most 50000 USD,
// and no more than 2 decimals. We convert to PYG server-side at the day's FX and
// fire a Bancard Single Buy. The PYG amount the card is charged is derived from
// this USD value, never sent by the client.

const MAX_OPEN_PAYMENT_USD = 50_000;

const openPaymentSchema = z.object({
  body: z.object({
    amount_usd: z
      .number({ invalid_type_error: 'amount_usd must be a number' })
      .finite('amount_usd must be a finite number')
      .gt(0, 'amount_usd must be greater than 0')
      .min(1, 'El monto mínimo es 1 USD')
      .max(MAX_OPEN_PAYMENT_USD, `El monto máximo es ${MAX_OPEN_PAYMENT_USD} USD`)
      .refine(
        (value) => Math.round(value * 100) === value * 100,
        'El monto admite hasta 2 decimales'
      )
  })
});

router.post(
  '/open',
  openPaymentRateLimit,
  validate(openPaymentSchema),
  async (req, res) => {
    try {
      const result = await createOpenPayment(req.body.amount_usd);
      return res.json({
        process_id: result.process_id,
        shop_process_id: result.shop_process_id,
        bancard_url: result.bancard_url,
        link_id: result.link_id,
        amount_usd: result.amount_usd,
        amount_pyg: result.amount_pyg
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Payment initiation failed';
      logger.error('POST /payments/open failed', {
        error: message,
        amount_usd: req.body?.amount_usd
      });
      return res.status(400).json({ error: message });
    }
  }
);

export default router;
