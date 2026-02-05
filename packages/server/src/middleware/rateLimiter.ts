import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const standardResponse = {
  message: 'Too many requests, please try again later.',
};

/** 10 req / 15 min — login, register, forgot-password, reset-password */
export const authStrictLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardResponse,
});

/** 30 req / 15 min — token refresh, OAuth callbacks */
export const authModerateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardResponse,
});

/** 200 req / 15 min — all authenticated API routes */
export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardResponse,
});
