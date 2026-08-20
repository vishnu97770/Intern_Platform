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
