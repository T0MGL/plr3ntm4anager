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

// Protects Bancard single_buy creation against brute force and the 7-attempt
// 30-day block documented in Bancard spec v1.22 pg 84. 3 create attempts per
// IP every 5 minutes is generous for legitimate checkouts and aggressive for
// abuse.
export const paymentCreateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 3,
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
