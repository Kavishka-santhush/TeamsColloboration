const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');

/**
 * channel.service — public/private/shared/announcement/read-only channels,
 * membership, pinning, sections and channel-level settings.
 */

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
}

async function createChannel(workspaceId, createdBy, { name, type = 'PUBLIC', topic, purpose, iconEmoji, postingAllowedRoles, canMembersAddOthers, retentionDays }) {
  const normalizedSlug = normalize(name);
  const exists = await prisma.channel.findUnique({ where: { workspaceId_normalizedSlug: { workspaceId, normalizedSlug } } });
  if (exists) throw ApiError.conflict('A channel with that name already exists');

  const channel = await prisma.channel.create({
    data: {
      workspaceId, name, normalizedSlug, type, topic, purpose, iconEmoji,
      postingAllowedRoles: postingAllowedRoles || ['OWNER', 'ADMIN', 'CHANNEL_MANAGER', 'MEMBER'],
      canMembersAddOthers: canMembersAddOthers ?? true,
      retentionDays: retentionDays || null,
    },
  });

  // Creator auto-joins.
  const membership = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: createdBy, workspaceId } } });
  await prisma.channelMember.create({ data: { userId: createdBy, channelId: channel.id, workspaceMembershipId: membership.id, isManager: true } });
  return channel;
}

/** Channels visible to a user in a workspace (public + those they joined). */
async function listForUser(workspaceId, userId) {
  const channels = await prisma.channel.findMany({
    where: {
      workspaceId,
      isArchived: false,
      OR: [{ type: 'PUBLIC' }, { type: 'ANNOUNCEMENT' }, { members: { some: { userId } } }],
    },
    include: { _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  });
  const myMemberships = await prisma.channelMember.findMany({ where: { userId, channel: { workspaceId } }, select: { channelId: true, isMuted: true, lastReadAt: true } });
  const map = Object.fromEntries(myMemberships.map((m) => [m.channelId, m]));
  return channels.map((c) => ({ ...c, isMember: !!map[c.id] || c.type === 'PUBLIC', isMuted: map[c.id]?.isMuted || false, lastReadAt: map[c.id]?.lastReadAt || null }));
}

async function getChannel(channelId) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      _count: { select: { members: true, messages: true } },
      members: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, presence: true } } } },
      pinned: { include: { message: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!channel) throw ApiError.notFound('Channel not found');
  return channel;
}

async function updateChannel(channelId, patch) {
  const allowed = ['name', 'topic', 'purpose', 'iconEmoji', 'type', 'postingAllowedRoles', 'canMembersAddOthers', 'retentionDays', 'settings'];
  const data = {};
  for (const k of allowed) if (k in patch) data[k] = patch[k];
  if (data.name) data.normalizedSlug = normalize(data.name);
  return prisma.channel.update({ where: { id: channelId }, data });
}

async function addMembers(channelId, userIds) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  const memberships = await prisma.workspaceMember.findMany({ where: { workspaceId: channel.workspaceId, userId: { in: userIds } } });
  const byUser = Object.fromEntries(memberships.map((m) => [m.userId, m.id]));
  await prisma.channelMember.createMany({
    data: userIds.filter((u) => byUser[u]).map((u) => ({ userId: u, channelId, workspaceMembershipId: byUser[u] })),
    skipDuplicates: true,
  });
  return getChannel(channelId);
}

async function removeMember(channelId, userId) {
  return prisma.channelMember.delete({ where: { userId_channelId: { userId, channelId } } });
}

async function setManager(channelId, userId, isManager) {
  return prisma.channelMember.update({ where: { userId_channelId: { userId, channelId } }, data: { isManager } });
}

async function muteChannel(userId, channelId, muted) {
  return prisma.channelMember.update({ where: { userId_channelId: { userId, channelId } }, data: { isMuted: muted } });
}

async function markRead(userId, channelId) {
  return prisma.channelMember.update({ where: { userId_channelId: { userId, channelId } }, data: { lastReadAt: new Date() } });
}

async function archiveChannel(channelId, archived = true) {
  return prisma.channel.update({ where: { id: channelId }, data: { isArchived: archived } });
}

async function deleteChannel(channelId) {
  return prisma.channel.update({ where: { id: channelId }, data: { isArchived: true } });
}

// --- Pinned messages & sections ---------------------------------------------
async function pinMessage(channelId, messageId, pinnedBy) {
  return prisma.pinnedMessage.upsert({
    where: { channelId_messageId: { channelId, messageId } },
    update: {},
    create: { channelId, messageId, pinnedBy },
  });
}

async function unpinMessage(channelId, messageId) {
  return prisma.pinnedMessage.delete({ where: { channelId_messageId: { channelId, messageId } } });
}

async function createSection(workspaceId, name, position = 0) {
  return prisma.channelSection.create({ data: { workspaceId, name, position } });
}

async function moveChannelToSection(sectionId, channelId, position = 0) {
  return prisma.channelSectionMember.upsert({
    where: { sectionId_channelId: { sectionId, channelId } },
    update: { position },
    create: { sectionId, channelId, position },
  });
}

module.exports = {
  createChannel,
  listForUser,
  getChannel,
  updateChannel,
  addMembers,
  removeMember,
  setManager,
  muteChannel,
  markRead,
  archiveChannel,
  deleteChannel,
  pinMessage,
  unpinMessage,
  createSection,
  moveChannelToSection,
};
