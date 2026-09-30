const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');
const channelService = require('./channel.service');

/**
 * dm.service — 1:1 and group direct-message conversations, plus blocking and
 * DM-to-private-channel conversion.
 */

/** Find an existing 1:1 conversation between two users or create it. */
async function startDm(workspaceId, initiatorId, userIds) {
  const participantIds = [...new Set([initiatorId, ...userIds])];
  if (participantIds.length < 2) throw ApiError.badRequest('Need at least one other participant');
  if (participantIds.length > 9) throw ApiError.badRequest('Group DMs are limited to 8 people');
  const isGroup = participantIds.length > 2;

  if (!isGroup) {
    const existing = await findExisting1to1(workspaceId, participantIds);
    if (existing) return existing;
  }

  return prisma.dmConversation.create({
    data: {
      workspaceId,
      isGroup,
      participants: { create: participantIds.map((userId) => ({ userId })) },
    },
    include: { participants: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, presence: true } } } } },
  });
}

async function findExisting1to1(workspaceId, participantIds) {
  const candidates = await prisma.dmConversation.findMany({
    where: { workspaceId, isGroup: false, participants: { every: { userId: { in: participantIds } } } },
    include: { participants: true },
  });
  return candidates.find((c) => c.participants.length === 2) || null;
}

async function listForUser(workspaceId, userId) {
  const parts = await prisma.dmParticipant.findMany({
    where: { userId, dm: { workspaceId } },
    include: {
      dm: {
        include: {
          participants: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, presence: true } } } },
          messages: { orderBy: { sentAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { dm: { lastActivityAt: 'desc' } },
  });
  return parts.map((p) => p.dm);
}

async function getDm(dmId) {
  const dm = await prisma.dmConversation.findUnique({
    where: { id: dmId },
    include: { participants: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, presence: true } } } } },
  });
  if (!dm) throw ApiError.notFound('Conversation not found');
  return dm;
}

async function markRead(dmId, userId) {
  return prisma.dmParticipant.update({ where: { dmId_userId: { dmId, userId } }, data: { lastReadAt: new Date() } });
}

async function mute(dmId, muted = true) {
  return prisma.dmConversation.update({ where: { id: dmId }, data: { isMuted: muted } });
}

/** Convert a group DM into a private channel and link them. */
async function convertToChannel(dmId, { name, createdBy }) {
  const dm = await getDm(dmId);
  if (!dm.isGroup) throw ApiError.badRequest('Only group DMs can be converted');
  const memberIds = dm.participants.map((p) => p.userId);
  const channel = await channelService.createChannel(dm.workspaceId, createdBy, { name, type: 'PRIVATE' });
  await channelService.addMembers(channel.id, memberIds);
  await prisma.dmConversation.update({ where: { id: dmId }, data: { convertedChannelId: channel.id } });
  return channel;
}

// --- Blocking ---------------------------------------------------------------
async function blockUser(blockerId, blockedId) {
  return prisma.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    update: {},
    create: { blockerId, blockedId },
  });
}

async function unblockUser(blockerId, blockedId) {
  return prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
}

async function isBlocked(userIdA, userIdB) {
  const b = await prisma.blockedUser.findFirst({
    where: { OR: [{ blockerId: userIdA, blockedId: userIdB }, { blockerId: userIdB, blockedId: userIdA }] },
  });
  return !!b;
}

// --- Message requests (outside users) ---------------------------------------
async function createMessageRequest(workspaceId, { requesterId, recipientId, dmId, body }) {
  const req = await prisma.messageRequest.create({ data: { workspaceId, requesterId, recipientId, dmId } });
  await prisma.notification.create({ data: { userId: recipientId, workspaceId, type: 'MESSAGE_REQUEST', title: 'New message request', body: (body || '').slice(0, 120), data: { requestId: req.id, dmId } } });
  return req;
}

async function respondToRequest(requestId, recipientId, status) {
  const req = await prisma.messageRequest.findUnique({ where: { id: requestId } });
  if (!req || req.recipientId !== recipientId) throw ApiError.forbidden('Cannot respond to this request');
  return prisma.messageRequest.update({ where: { id: requestId }, data: { status } });
}

module.exports = {
  startDm,
  listForUser,
  getDm,
  markRead,
  mute,
  convertToChannel,
  blockUser,
  unblockUser,
  isBlocked,
  createMessageRequest,
  respondToRequest,
};
