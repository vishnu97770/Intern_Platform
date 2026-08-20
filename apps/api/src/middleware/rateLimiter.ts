import rateLimit from "express-rate-limit";

/**
 * Tighter limit for auth endpoints (login/register/refresh) to slow down
 * credential-stuffing and brute-force attempts without a CAPTCHA dependency.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
});

/** General-purpose limiter applied to the whole API. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
});

/**
 * Tighter limit for expensive/high-impact operations that the general
 * limiter's 300/15min is too loose for on its own: parsing an uploaded
 * file, re-fetching every provider's full listing set, and running the
 * auto-apply pipeline (which itself fans out into a match calculation per
 * internship and can enqueue real submissions).
 */
export const heavyOperationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests for this operation. Try again later." } },
});
