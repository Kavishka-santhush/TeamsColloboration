const { PrismaClient } = require('@prisma/client');
const env = require('./env');

/**
 * Single shared PrismaClient instance for the whole app.
 * In development we log queries to help with debugging.
 */
const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
