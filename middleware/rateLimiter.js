/**
 * Rate Limiting Middleware
 * Prevents brute-force attacks on sensitive endpoints
 */

const rateLimit = require('express-rate-limit');

/**
 * Login rate limiter: 5 attempts per 15 minutes
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for requests with correct credentials (optional)
    return false;
  },
  keyGenerator: (req) => {
    // Use username as key if provided, otherwise use IP
    return req.body?.username || req.ip;
  }
});

/**
 * General API rate limiter: 100 requests per 15 minutes
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Strict rate limiter: 3 requests per 1 minute (for high-risk operations)
 */
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // 3 requests per windowMs
  message: 'Too many requests. Please try again after 1 minute.',
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  loginLimiter,
  apiLimiter,
  strictLimiter
};
