const cron = require('node-cron');
const prisma = require('../config/prisma');
const logger = require('../utils/logger.util');
const { toUser } = require('../socket/registry');
const notificationService = require('../services/notification.service');
const emailUtil = require('../utils/email.util');

/**
 * notification.job — two recurring responsibilities:
 *   1. fire due reminders every minute (create an in-app notification + push)
 *   2. send email digests to users whose preference is daily/hourly
 */
function startNotificationJobs() {
  // Every minute: process reminders whose time has arrived and are un-notified.
  cron.schedule('* * * * *', async () => {
    try {
      const due = await prisma.reminder.findMany({
        where: { notified: false, remindAt: { lte: new Date() } },
        include: { user: { select: { id: true, displayName: true } }, message: { select: { workspaceId: true } } },
        take: 200,
      });
      for (const r of due) {
        await notificationService.notify(r.userId, {
          workspaceId: r.message?.workspaceId || null,
          type: 'REMINDER',
          title: 'Reminder',
          body: r.note || 'You set a reminder',
          data: { reminderId: r.id, messageId: r.messageId, channelId: r.channelId },
        });
        toUser(r.userId, 'notification:new', { type: 'REMINDER', title: 'Reminder', body: r.note });
        await prisma.reminder.update({ where: { id: r.id }, data: { notified: true } });
      }
      if (due.length) logger.info(`[jobs:reminder] fired ${due.length} reminder(s)`);
    } catch (err) {
      logger.error(`[jobs:reminder] ${err.message}`);
    }
  });

  // Hourly: roll up unread in-app notifications into an email digest.
  cron.schedule('0 * * * *', async () => {
    try {
      const prefs = await prisma.notificationPreference.findMany({ where: { emailDigest: { in: ['hourly', 'daily'] } } });
      const isDaily = new Date().getUTCHours() === 8; // daily digest sent at 08:00 UTC
      for (const p of prefs) {
        if (p.emailDigest === 'daily' && !isDaily) continue;
        const unread = await prisma.notification.count({ where: { userId: p.userId, isRead: false } });
        if (!unread) continue;
        const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { email: true, displayName: true } });
        if (!user?.email) continue;
        await emailUtil.sendSummary(user.email, {
          subject: `You have ${unread} unread notification(s)`,
          text: `Hi ${user.displayName}, you have ${unread} unread notifications on TeamComm.`,
          bodyHtml: `<p>Hi ${user.displayName},</p><p>You have <b>${unread}</b> unread notifications. Open TeamComm to catch up.</p>`,
        });
      }
    } catch (err) {
      logger.error(`[jobs:digest] ${err.message}`);
    }
  });

  logger.info('Notification jobs scheduled');
}

module.exports = { startNotificationJobs };
