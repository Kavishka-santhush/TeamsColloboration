const cron = require('node-cron');
const prisma = require('../config/prisma');
const logger = require('../utils/logger.util');
const analyticsService = require('../services/analytics.service');

/**
 * analytics.job — writes a daily AnalyticsSnapshot per active workspace so the
 * dashboards can chart long-range trends without scanning raw messages each
 * time. Runs just after midnight UTC.
 */
function startAnalyticsJobs() {
  cron.schedule('5 0 * * *', async () => {
    try {
      const workspaces = await prisma.workspace.findMany({
        where: { deletedAt: null, isSuspended: false },
        select: { id: true },
      });
      for (const ws of workspaces) {
        await analyticsService.snapshotDay(ws.id);
      }
      logger.info(`[jobs:analytics] snapshotted ${workspaces.length} workspace(s)`);
    } catch (err) {
      logger.error(`[jobs:analytics] ${err.message}`);
    }
  });

  logger.info('Analytics jobs scheduled');
}

module.exports = { startAnalyticsJobs };
