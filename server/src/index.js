const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger.util');
const prisma = require('./config/prisma');
const { assertDbReachable } = require('./config/db');
const { initSocket } = require('./socket');
const { startJobs } = require('./jobs');
const pdfUtil = require('./utils/pdf.util');

/**
 * index.js — process entrypoint. Creates the HTTP server, boots Socket.io on
 * top of it, starts background jobs, and wires graceful shutdown so in-flight
 * connections, the headless browser and DB pools are released cleanly.
 */
async function main() {
  // Fail fast (but informatively) if the database isn't reachable yet.
  try {
    await assertDbReachable();
    logger.info('Database connection OK');
  } catch (err) {
    logger.warn(`Database not reachable at startup: ${err.message}. Continuing — migrations/seed may be pending.`);
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    logger.info(`TeamComm API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  // Background jobs only run in a single "worker" process; gate via env so
  // multiple API replicas don't each schedule their own cron.
  if (process.env.ENABLE_JOBS !== 'false') {
    startJobs();
  }

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      try {
        await pdfUtil.shutdown();
        await prisma.$disconnect();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error(`Error during shutdown: ${err.message}`);
        process.exit(1);
      }
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => {
      logger.error('Forced shutdown after 10s timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error(`Unhandled rejection: ${reason}`));
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.stack || err.message}`);
  });
}

main().catch((err) => {
  logger.error(`Failed to start server: ${err.stack || err.message}`);
  process.exit(1);
});
