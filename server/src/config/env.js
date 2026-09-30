require('dotenv').config();

/**
 * Centralised, validated environment configuration.
 * Every part of the app imports this instead of reading process.env directly,
 * which keeps defaults and validation in a single place.
 */
const required = ['DATABASE_URL', 'CLERK_SECRET_KEY'];

function warnMissing() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length && process.env.NODE_ENV !== 'test') {
    // We do not hard-crash so the codebase remains browsable without a fully
    // populated .env, but we surface what is missing in the logs.
    // eslint-disable-next-line no-console
    console.warn(`[config] Missing required env vars: ${missing.join(', ')}`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigin: (process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),

  databaseUrl: process.env.DATABASE_URL,

  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o',
    fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4o-mini',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'no-reply@teamcomm.local',
  },

  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || '0'.repeat(32),
    jwtSecret: process.env.JWT_SECRET || 'dev-insecure-jwt-secret',
  },

  turn: {
    url: process.env.TURN_SERVER_URL,
    username: process.env.TURN_USERNAME,
    password: process.env.TURN_PASSWORD,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  giphy: {
    apiKey: process.env.GIPHY_API_KEY,
  },
};

warnMissing();

module.exports = env;
