import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Every request through these routes triggers a paid Groq/embedding call.
// With no throttle, a leaked/expired-but-accepted credential (or the auth
// bypass this session's audit found and fixed) turns straight into an open
// billing tap. Key by authenticated user id when available, falling back to
// IP for the rare unauthenticated case, so one user can't exhaust another's
// quota.
export const llmRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: { error: 'Too many requests. Please wait a few minutes and try again.' }
});
