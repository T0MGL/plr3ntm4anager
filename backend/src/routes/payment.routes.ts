import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { paymentCreateRateLimit } from '../middleware/rate-limit.middleware';
import {
  createSingleBuy,
  verifyAndMarkBancardConfirmation,
  processBancardConfirmationBackground,
  rollbackPayment,
  getPaymentConfirmation
} from '../services/payment.service';
import { logger } from '../config/logger';

const router = Router();

// POST /payments/preauth
// Initiates a Bancard single_buy. Single Buy DIRECTO by default (no preauth).
// Returns process_id for the Bancard checkout iframe.

const preauthSchema = z.object({
  body: z.object({
    booking_id: z.string().uuid(),
    preauthorization: z.boolean().optional()
  })
});

router.post('/preauth', paymentCreateRateLimit, validate(preauthSchema), async (req, res) => {
  try {
    const result = await createSingleBuy(req.body.booking_id, {
      preauthorization: req.body.preauthorization ?? false
    });

    return res.json({
      process_id: result.process_id,
      shop_process_id: result.shop_process_id,
      bancard_url: result.bancard_url
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    logger.error('Payment preauth failed', {
      error: message,
      booking_id: req.body?.booking_id
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
    // Debug: full payload dump to diagnose token mismatches during Bancard
    // staging certification. Remove once certified.
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

export default router;
