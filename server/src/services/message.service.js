const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');
const { parseMentions, buildMentionMetadata } = require('../utils/mention.util');
const { toChannel, toUser } = require('../socket/registry');
const notificationService = require('./notification.service');

/**
 * message.service — the core chat engine. Sending a message does four things:
 *   1. resolve @mentions / #channel refs to ids (for notifications + links)
 *   2. persist the Message (+ Thread bookkeeping if it is a reply)
 *   3. broadcast in realtime over Socket.io
 *   4. fan out notifications for mentions / DMs / thread replies
 */

const AUTHOR_SELECT = { id: true, username: true, displayName: true, avatarUrl: true };

async function resolveMentions(workspaceId, parsed) {
  const users = parsed.userMentions.length
    ? await prisma.user.findMany({ where: { username: { in: parsed.userMentions } }, select: { id: true } })
    : [];
  const channels = parsed.channelRefs.length
    ? await prisma.channel.findMany({ where: { workspaceId, normalizedSlug: { in: parsed.channelRefs } }, select: { id: true } })
    : [];
  return buildMentionMetadata(parsed, users.map((u) => u.id), channels.map((c) => c.id));
}

/** Send a message into a channel or DM (or as a thread reply). */
async function sendMessage({ authorId, workspaceId, channelId, dmConversationId, threadRootId, body, richContent, type = 'TEXT', metadata = {}, scheduledAt }) {
  if (!channelId && !dmConversationId) throw ApiError.badRequest('A channelId or dmConversationId is required');

  const parsed = parseMentions(body);
  const mentions = await resolveMentions(workspaceId, parsed);

  const message = await prisma.message.create({
    data: {
      workspaceId,
      channelId: channelId || null,
      dmConversationId: dmConversationId || null,
      authorId,
      type,
      body,
      richContent: richContent || undefined,
      mentions,
      metadata,
      threadRootId: threadRootId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      sentAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      status: 'SENT',
    },
    include: { author: { select: AUTHOR_SELECT }, attachments: true },
  });

  // Thread bookkeeping: the first reply to a root creates the Thread row.
  if (threadRootId) {
    await upsertThreadReply(workspaceId, threadRootId, channelId, message.id, message.sentAt);
  }

  await broadcast(message);
  await notificationService.notifyForMessage(message, {
    workspaceId,
    channelId,
    isDm: !!dmConversationId,
  });

  return message;
}

async function upsertThreadReply(workspaceId, rootMessageId, channelId, _replyId, sentAt) {
  const existing = await prisma.thread.findUnique({ where: { rootMessageId } });
  if (existing) {
    await prisma.thread.update({ where: { id: existing.id }, data: { replyCount: { increment: 1 }, lastReplyAt: sentAt } });
    return existing;
  }
  return prisma.thread.create({
    data: { workspaceId, rootMessageId, channelId, replyCount: 1, lastReplyAt: sentAt },
  });
}

async function broadcast(message) {
  if (message.channelId) toChannel(message.channelId, 'message:new', message);
  else if (message.dmConversationId) {
    const dm = await prisma.dmParticipant.findMany({ where: { dmId: message.dmConversationId }, select: { userId: true } });
    dm.forEach((p) => toUser(p.userId, 'message:new', message));
  }
}

/** Cursor-based message history: newest first page, older via `before`. */
async function listMessages({ channelId, dmConversationId, before, limit = 50, includeThreads = true }) {
  const where = {
    ...(channelId ? { channelId } : {}),
    ...(dmConversationId ? { dmConversationId } : {}),
    isDeleted: false,
    scheduledAt: null,
    ...(before ? { sentAt: { lt: new Date(before) } } : {}),
  };
  const rows = await prisma.message.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: limit + 1,
    include: {
      author: { select: AUTHOR_SELECT },
      attachments: true,
      reactions: { select: { emoji: true, userId: true, isCustom: true } },
      parentThread: { select: { id: true, replyCount: true } },
    },
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).reverse(); // return chronological order
  return {
    items: items.map(aggregateReactions),
    hasMore,
    nextCursor: hasMore ? items[0]?.sentAt : null,
    includeThreads,
  };
}

/** Collapse the flat reaction rows into { emoji: { count, users } } for the UI. */
function aggregateReactions(message) {
  const grouped = {};
  (message.reactions || []).forEach((r) => {
    grouped[r.emoji] = grouped[r.emoji] || { emoji: r.emoji, count: 0, users: [], isCustom: r.isCustom };
    grouped[r.emoji].count += 1;
    grouped[r.emoji].users.push(r.userId);
  });
  const { reactions, ...rest } = message;
  void reactions;
  return { ...rest, reactions: Object.values(grouped), threadReplyCount: message.parentThread?.replyCount || 0, threadId: message.parentThread?.id || null };
}

async function getMessage(messageId) {
  const message = await prisma.message.findUnique({ where: { id: messageId }, include: { author: { select: AUTHOR_SELECT }, attachments: true } });
  if (!message) throw ApiError.notFound('Message not found');
  return message;
}

async function editMessage(messageId, editorId, { body, richContent }) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');
  if (message.authorId !== editorId) throw ApiError.forbidden('You can only edit your own messages');

  // Preserve prior version in edit history.
  await prisma.messageEdit.create({ data: { messageId, body: message.body, editedBy: editorId } });

  const parsed = parseMentions(body);
  const mentions = await resolveMentions(message.workspaceId, parsed);

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body, richContent: richContent || message.richContent, mentions, isEdited: true },
    include: { author: { select: AUTHOR_SELECT } },
  });
  await broadcast(updated);
  return updated;
}

async function deleteMessage(messageId, requesterId, { isSuperAdmin = false, mode = 'placeholder' } = {}) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');
  if (message.authorId !== requesterId && !isSuperAdmin) throw ApiError.forbidden('You can only delete your own messages');
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, deleteMode: mode, body: mode === 'placeholder' ? 'Message deleted' : '' },
  });
  toChannel(message.channelId, 'message:deleted', { id: messageId, channelId: message.channelId });
  return updated;
}

/** Toggle a reaction on/off (unique per user+emoji). */
async function toggleReaction(messageId, userId, emoji, isCustom = false) {
  const existing = await prisma.reaction.findUnique({ where: { messageId_userId_emoji: { messageId, userId, emoji } } });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return { removed: true };
  }
  await prisma.reaction.create({ data: { messageId, userId, emoji, isCustom } });
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (message && message.authorId !== userId) {
    await notificationService.notify(message.authorId, { workspaceId: message.workspaceId, type: 'REACTION', title: `${emoji} reaction`, body: 'Someone reacted to your message', data: { messageId } });
  }
  return { removed: false };
}

/** Forward an existing message to another channel / DM. */
async function forwardMessage(messageId, actorId, { toChannelId, toDmId }) {
  const original = await getMessage(messageId);
  return sendMessage({
    authorId: actorId,
    workspaceId: original.workspaceId,
    channelId: toChannelId,
    dmConversationId: toDmId,
    body: original.body,
    type: original.type,
    metadata: { forwardedFrom: messageId },
  });
}

// --- Personal message state -------------------------------------------------
async function starMessage(userId, messageId, starred = true) {
  if (starred) {
    return prisma.starredMessage.upsert({ where: { userId_messageId: { userId, messageId } }, update: {}, create: { userId, messageId } });
  }
  return prisma.starredMessage.deleteMany({ where: { userId, messageId } });
}

async function bookmark(userId, { messageId, fileId, linkUrl, label }) {
  return prisma.bookmark.create({ data: { userId, messageId, fileId, linkUrl, label } });
}

async function setReminder(userId, { messageId, channelId, note, remindAt }) {
  return prisma.reminder.create({ data: { userId, messageId, channelId, note, remindAt: new Date(remindAt) } });
}

async function markDelivered(messageIds, userId) {
  return prisma.message.updateMany({ where: { id: { in: messageIds } }, data: { status: 'DELIVERED' } })
    .then(() => recordRead(messageIds, userId));
}

async function recordRead(messageIds, userId) {
  await prisma.messageReadReceipt.createMany({
    data: messageIds.map((messageId) => ({ messageId, userId })),
    skipDuplicates: true,
  });
  return prisma.message.updateMany({ where: { id: { in: messageIds }, status: { not: 'READ' } }, data: { status: 'READ' } });
}

module.exports = {
  sendMessage,
  listMessages,
  getMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  forwardMessage,
  starMessage,
  bookmark,
  setReminder,
  markDelivered,
  recordRead,
  aggregateReactions,
};

