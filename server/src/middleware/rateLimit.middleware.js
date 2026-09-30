const rateLimit = require('express-rate-limit');

/**
 * Rate limiters. Separate buckets so a heavy AI call budget does not throttle
 * ordinary message sending, and vice-versa.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
});

const messageLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 40, // 40 messages / 10s
  message: { success: false, message: 'Sending messages too fast.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // AI calls are expensive (OpenRouter cost)
  message: { success: false, message: 'AI request limit reached, try again shortly.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many uploads.' },
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, message: 'Webhook rate limit exceeded.' },
});

module.exports = { globalLimiter, messageLimiter, aiLimiter, uploadLimiter, webhookLimiter };
