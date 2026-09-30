const cron = require('node-cron');
const prisma = require('../config/prisma');
const logger = require('../utils/logger.util');
const adminService = require('../services/admin.service');

/**
 * cleanup.job — housekeeping that keeps the DB tidy and enforces policy:
 *   - retention enforcement per workspace (respects legal holds)
 *   - guest account expiry
 *   - stale presence (users idle > 10 min marked AWAY)
 *   - purge very old search history
 */
function startCleanupJobs() {
  // Daily 02:00 UTC: enforce retention across every workspace with a window.
  cron.schedule('0 2 * * *', async () => {
    try {
      const workspaces = await prisma.workspace.findMany({
        where: { deletedAt: null, OR: [{ retentionDays: { not: null } }, { fileRetentionDays: { not: null } }] },
        select: { id: true },
      });
      let msgs = 0; let files = 0;
      for (const ws of workspaces) {
        const r = await adminService.enforceRetention(ws.id);
        msgs += r.messagesDeleted; files += r.filesDeleted;
      }
      logger.info(`[jobs:retention] checked ${workspaces.length} workspace(s): ${msgs} msg, ${files} file removed`);
    } catch (err) {
      logger.error(`[jobs:retention] ${err.message}`);
    }
  });

  // Every 15 min: deactivate expired guest accounts.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await prisma.user.updateMany({
        where: { isGuest: true, guestExpiry: { lte: new Date() }, isDeactivated: false },
        data: { isDeactivated: true },
      });
      if (result.count) logger.info(`[jobs:guest-expiry] deactivated ${result.count} expired guest(s)`);
    } catch (err) {
      logger.error(`[jobs:guest-expiry] ${err.message}`);
    }
  });

  // Every 10 min: flip long-idle ONLINE users to AWAY.
  cron.schedule('*/10 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000);
      await prisma.user.updateMany({
        where: { presence: 'ONLINE', lastActiveAt: { lt: cutoff } },
        data: { presence: 'AWAY' },
      });
    } catch (err) {
      logger.error(`[jobs:presence] ${err.message}`);
    }
  });

  // Weekly: drop search history older than 180 days.
  cron.schedule('0 3 * * 0', async () => {
    try {
      await prisma.searchHistory.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 180 * 86400000) } } });
    } catch (err) {
      logger.error(`[jobs:searchHistory] ${err.message}`);
    }
  });

  logger.info('Cleanup jobs scheduled');
}

module.exports = { startCleanupJobs };
