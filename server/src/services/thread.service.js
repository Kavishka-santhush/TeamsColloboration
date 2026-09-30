const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');
const messageService = require('./message.service');
const { toChannel } = require('../socket/registry');

/**
 * thread.service — replies that hang off a root message. Reusing
 * message.sendMessage with a threadRootId keeps a single send pipeline, so
 * threads share reactions, mentions and realtime behaviour with channels.
 */

async function getThread(rootMessageId) {
  const thread = await prisma.thread.findUnique({ where: { rootMessageId } });
  const root = await messageService.getMessage(rootMessageId);
  const replies = thread
    ? (await prisma.message.findMany({ where: { threadRootId: rootMessageId, isDeleted: false }, orderBy: { sentAt: 'asc' }, include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } }, reactions: true } })).map(messageService.aggregateReactions)
    : [];
  const participants = thread
    ? (await prisma.threadParticipant.findMany({ where: { threadId: thread.id }, select: { userId: true } })).map((p) => p.userId)
    : [];
  return { thread, root, replies, participants };
}

async function reply({ authorId, rootMessageId, body, richContent, alsoSendChannel }) {
  const root = await prisma.message.findUnique({ where: { id: rootMessageId } });
  if (!root) throw ApiError.notFound('Root message not found');

  const replyMsg = await messageService.sendMessage({
    authorId,
    workspaceId: root.workspaceId,
    channelId: root.channelId,
    threadRootId: rootMessageId,
    body,
    richContent,
  });

  const thread = await prisma.thread.findUnique({ where: { rootMessageId } });
  if (thread) {
    await prisma.threadParticipant.upsert({
      where: { threadId_userId: { threadId: thread.id, userId: authorId } },
      update: {},
      create: { threadId: thread.id, userId: authorId },
    });
    // Notify followers of the thread.
    const followers = await prisma.threadFollower.findMany({ where: { threadId: thread.id }, select: { userId: true } });
    await Promise.all(
      followers.filter((f) => f.userId !== authorId).map((f) =>
        prisma.notification.create({ data: { userId: f.userId, workspaceId: root.workspaceId, type: 'THREAD_REPLY', title: 'New thread reply', body: body.slice(0, 120), data: { threadId: thread.id, messageId: replyMsg.id } } })),
      );
    if (root.channelId) toChannel(root.channelId, 'thread:updated', { threadId: thread.id, replyCount: thread.replyCount + 1 });
  }

  if (alsoSendChannel && root.channelId) {
    await messageService.sendMessage({ authorId, workspaceId: root.workspaceId, channelId: root.channelId, body, richContent });
  }
  return replyMsg;
}

async function follow(threadId, userId) {
  return prisma.threadFollower.upsert({ where: { threadId_userId: { threadId, userId } }, update: {}, create: { threadId, userId } });
}

async function unfollow(threadId, userId) {
  return prisma.threadFollower.deleteMany({ where: { threadId, userId } });
}

/** "All Threads" inbox: threads the user participates in, most recent first. */
async function listUserThreads(workspaceId, userId, limit = 30) {
  const participations = await prisma.threadParticipant.findMany({
    where: { thread: { workspaceId }, userId },
    include: { thread: { include: { rootMessage: { include: { author: { select: { id: true, displayName: true } } } } } } },
    orderBy: { thread: { lastReplyAt: 'desc' } },
    take: limit,
  });
  return participations.map((p) => p.thread);
}

module.exports = { getThread, reply, follow, unfollow, listUserThreads };

