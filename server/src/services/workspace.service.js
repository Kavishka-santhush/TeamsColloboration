const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');
const { generateApiKey } = require('../utils/encryption.util');

/**
 * workspace.service — the company-level container. Handles membership,
 * invite links, join requests, and the default-channel auto-join behaviour.
 */

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function createWorkspace(userId, { name, description, industry, sizeRange, iconUrl, timezone }) {
  const slug = await ensureUniqueSlug(slugify(name));
  const ws = await prisma.workspace.create({
    data: { name, slug, description, industry, sizeRange, iconUrl, timezone, ownerId: userId },
  });
  await prisma.workspaceMember.create({ data: { userId, workspaceId: ws.id, role: 'OWNER' } });

  // Every workspace starts with #general + #announcements.
  await prisma.channel.createMany({
    data: [
      { workspaceId: ws.id, name: 'general', normalizedSlug: 'general', type: 'PUBLIC', isDefault: true },
      { workspaceId: ws.id, name: 'announcements', normalizedSlug: 'announcements', type: 'ANNOUNCEMENT', isDefault: true },
    ],
  });
  return ws;
}

async function ensureUniqueSlug(base) {
  let slug = base || 'workspace';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await prisma.workspace.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${slug}-${Math.floor(Math.random() * 10000)}`;
  }
}

/** All workspaces the user belongs to (for the switcher). */
async function listForUser(userId) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { deletedAt: null } },
    include: { workspace: { select: { id: true, name: true, slug: true, iconUrl: true } } },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

async function getWorkspace(workspaceId) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, presence: true } } } }, owner: true },
  });
  if (!ws) throw ApiError.notFound('Workspace not found');
  return ws;
}

async function updateWorkspace(workspaceId, patch) {
  const allowed = ['name', 'description', 'industry', 'sizeRange', 'iconUrl', 'timezone', 'discoverable', 'retentionDays', 'fileRetentionDays', 'settings', 'defaultChannelIds', 'allowMessageRequests'];
  const data = {};
  for (const k of allowed) if (k in patch) data[k] = patch[k];
  return prisma.workspace.update({ where: { id: workspaceId }, data });
}

/** Add a member with a workspace-scoped role + auto-join default channels. */
async function addMember(workspaceId, { userId, role = 'MEMBER' }) {
  const existing = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });
  if (existing) throw ApiError.conflict('User is already a member');

  const membership = await prisma.workspaceMember.create({ data: { userId, workspaceId, role } });

  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const defaults = await prisma.channel.findMany({ where: { workspaceId, isDefault: true } });
  if (defaults.length) {
    await prisma.channelMember.createMany({
      data: defaults.map((c) => ({ userId, channelId: c.id, workspaceMembershipId: membership.id })),
    });
  }
  void ws;
  return membership;
}

async function changeRole(workspaceId, userId, role) {
  return prisma.workspaceMember.update({
    where: { userId_workspaceId: { userId, workspaceId } },
    data: { role },
  });
}

async function deactivateMember(workspaceId, userId, deactivated = true) {
  return prisma.workspaceMember.update({
    where: { userId_workspaceId: { userId, workspaceId } },
    data: { isDeactivated: deactivated },
  });
}

async function removeMember(workspaceId, userId) {
  await prisma.channelMember.deleteMany({ where: { userId, channel: { workspaceId } } });
  return prisma.workspaceMember.delete({ where: { userId_workspaceId: { userId, workspaceId } } });
}

// --- Invite links -----------------------------------------------------------
async function createInviteLink(workspaceId, createdBy, { role = 'MEMBER', maxUses, expiresAt } = {}) {
  const code = generateApiKey('inv').replace('inv_', '');
  return prisma.inviteLink.create({
    data: { workspaceId, createdBy, code, role, maxUses: maxUses || null, expiresAt: expiresAt ? new Date(expiresAt) : null },
  });
}

async function joinByInviteCode(userId, code) {
  const link = await prisma.inviteLink.findUnique({ where: { code } });
  if (!link || link.revoked) throw ApiError.badRequest('Invite link is invalid');
  if (link.expiresAt && link.expiresAt < new Date()) throw ApiError.badRequest('Invite link has expired');
  if (link.maxUses && link.useCount >= link.maxUses) throw ApiError.badRequest('Invite link usage limit reached');
  const membership = await addMember(link.workspaceId, { userId, role: link.role });
  await prisma.inviteLink.update({ where: { id: link.id }, data: { useCount: { increment: 1 } } });
  return membership;
}

// --- Join requests (discoverable workspaces) --------------------------------
async function requestToJoin(workspaceId, userId, message) {
  return prisma.joinRequest.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: { status: 'PENDING', message },
    create: { workspaceId, userId, message },
  });
}

async function reviewJoinRequest(workspaceId, requestId, reviewerId, approve) {
  const req = await prisma.joinRequest.findUnique({ where: { id: requestId } });
  if (!req || req.workspaceId !== workspaceId) throw ApiError.notFound('Join request not found');
  await prisma.joinRequest.update({ where: { id: requestId }, data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedBy: reviewerId } });
  if (approve) await addMember(workspaceId, { userId: req.userId });
  return req;
}

async function softDelete(workspaceId) {
  return prisma.workspace.update({ where: { id: workspaceId }, data: { deletedAt: new Date() } });
}

module.exports = {
  createWorkspace,
  listForUser,
  getWorkspace,
  updateWorkspace,
  addMember,
  changeRole,
  deactivateMember,
  removeMember,
  createInviteLink,
  joinByInviteCode,
  requestToJoin,
  reviewJoinRequest,
  softDelete,
};
