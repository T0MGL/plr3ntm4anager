import rateLimit from 'express-rate-limit';

export const bookingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking requests, please try later.' }
});

export const manualSyncRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sync attempts, please try later.' }
});

// Protects the booking-flow Bancard single_buy creation against brute force.
// A legitimate guest may retry after a declined card or a typo, so 3 in 5 min
// was hostile to real use. 8 in 15 min still blocks scripted abuse while never
// getting in a real payer's way. The per-card 7-attempt block in Bancard spec
// v1.22 pg 84 is enforced by Bancard against the card, not by this IP limiter.
export const paymentCreateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment attempts, please wait a few minutes.' }
});

// Public open/link payment portal (rent.parkloftsparaguay.com/pay/...). The
// payer has no account and may legitimately retry several times: declined card,
// wrong CVV, then a second card. A tight limit locks out a paying customer mid
// checkout, which is worse than the marginal abuse risk on an unguessable link.
// 12 attempts per 15 minutes per IP is the balance.
export const openPaymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment attempts, please wait a few minutes.' }
});

// Protects admin user write operations (password set/reset, invite). Generous
// enough for normal admin use but blocks automated abuse.
export const adminWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try later.' }
});
