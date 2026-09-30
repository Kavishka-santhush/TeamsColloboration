const prisma = require('../config/prisma');
const { toUser } = require('../socket/registry');
const { notifiesUser } = require('../utils/mention.util');

/**
 * notification.service — creates Notification rows and pushes them in realtime.
 * Honours per-user NotificationPreference (mentions_only vs all_messages) and
 * channel mute so we do not spam muted/quiet conversations.
 */

async function notify(userId, { workspaceId, type, title, body, data = {}, channel = 'in_app' }) {
  const pref = await prisma.notificationPreference.findFirst({
    where: { userId, workspaceId: workspaceId || null },
  });

  // Respect "mentions_only": skip plain activity notifications.
  if (pref?.scope === 'mentions_only' && !['MENTION', 'DM', 'THREAD_REPLY', 'REACTION', 'CALL_INCOMING', 'REMINDER'].includes(type)) {
    return null;
  }
  // Respect DND schedule (stored but not suppressed here for simplicity).
  const note = await prisma.notification.create({
    data: { userId, workspaceId, type, title, body, data, channel },
  });
  toUser(userId, 'notification:new', note);
  return note;
}

/** Fan-out for a message: mentions, broadcasts, DMs, thread replies. */
async function notifyForMessage(message, { workspaceId, channelId, isDm }) {
  if (isDm) {
    const dm = await prisma.dmConversation.findUnique({ where: { id: message.dmConversationId }, include: { participants: true } });
    const recipients = (dm?.participants || []).map((p) => p.userId).filter((id) => id !== message.authorId);
    await Promise.all(recipients.map((userId) => notify(userId, {
      workspaceId, type: 'DM', title: 'New direct message', body: message.body.slice(0, 120), data: { messageId: message.id, dmId: message.dmConversationId },
    })));
    return;
  }

  const members = await prisma.channelMember.findMany({
    where: { channelId, isMuted: false },
    select: { userId: true },
  });
  const memberIds = members.map((m) => m.userId).filter((id) => id !== message.authorId);

  const online = await prisma.user.findMany({ where: { id: { in: memberIds }, presence: 'ACTIVE' }, select: { id: true } });
  const onlineSet = new Set(online.map((u) => u.id));

  for (const userId of memberIds) {
    const shouldNotify = notifiesUser(message.mentions, { userId, isOnline: onlineSet.has(userId) });
    if (shouldNotify) {
      await notify(userId, {
        workspaceId, type: 'MENTION', title: 'You were mentioned', body: message.body.slice(0, 120), data: { messageId: message.id, channelId },
      });
    }
  }
}

async function list(userId, { workspaceId, limit = 50 }) {
  return prisma.notification.findMany({
    where: { userId, ...(workspaceId ? { workspaceId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function markRead(userId, notificationId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

async function markAllRead(userId, workspaceId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false, ...(workspaceId ? { workspaceId } : {}) },
    data: { isRead: true, readAt: new Date() },
  });
}

async function getPreferences(userId, workspaceId) {
  return prisma.notificationPreference.findFirst({ where: { userId, workspaceId: workspaceId || null } });
}

async function setPreferences(userId, patch) {
  const where = { userId, workspaceId: patch.workspaceId || null };
  const existing = await prisma.notificationPreference.findFirst({ where });
  if (existing) return prisma.notificationPreference.update({ where: { id: existing.id }, data: patch });
  return prisma.notificationPreference.create({ data: { ...patch, userId } });
}

module.exports = { notify, notifyForMessage, list, markRead, markAllRead, getPreferences, setPreferences };
