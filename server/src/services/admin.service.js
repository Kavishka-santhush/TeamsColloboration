const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');

/**
 * admin.service — capabilities that straddle "workspace admin" and "platform
 * super admin": the audit trail, legal hold, retention enforcement, bulk
 * exports, subscription management and platform-wide oversight.
 */

// --- Audit trail ------------------------------------------------------------
async function recordAudit({ workspaceId, actorId, action, targetType, targetId, details, ipAddress }) {
  return prisma.auditLog.create({ data: { workspaceId: workspaceId || null, actorId: actorId || null, action, targetType, targetId, details: details || {}, ipAddress } });
}

async function auditLogs(workspaceId, { actorId, action, from, to, limit = 100 }) {
  return prisma.auditLog.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      ...(actorId ? { actorId } : {}),
      ...(action ? { action } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    include: { actor: { select: { id: true, displayName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// --- Legal hold -------------------------------------------------------------
async function createLegalHold(workspaceId, createdBy, { userId, reason }) {
  const hold = await prisma.legalHold.create({ data: { workspaceId, userId: userId || null, reason, createdBy } });
  await recordAudit({ workspaceId, actorId: createdBy, action: 'legal_hold.created', targetType: 'LegalHold', targetId: hold.id, details: { userId, reason } });
  return hold;
}

async function releaseLegalHold(id, actorId) {
  const hold = await prisma.legalHold.update({ where: { id }, data: { active: false } });
  await recordAudit({ workspaceId: hold.workspaceId, actorId, action: 'legal_hold.released', targetType: 'LegalHold', targetId: id });
  return hold;
}

async function listLegalHolds(workspaceId) {
  return prisma.legalHold.findMany({ where: { workspaceId, active: true }, include: { user: { select: { id: true, displayName: true } } } });
}

// --- Retention enforcement --------------------------------------------------
/**
 * Delete messages/files older than the workspace retention window, skipping
 * anything covered by an active legal hold. Returns counts (used by a cron).
 */
async function enforceRetention(workspaceId) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw ApiError.notFound('Workspace not found');

  const protectedUserIds = (await prisma.legalHold.findMany({ where: { workspaceId, active: true, userId: { not: null } } })).map((h) => h.userId);
  const results = { messagesDeleted: 0, filesDeleted: 0 };

  const deleteOlderThan = (days) => (days ? new Date(Date.now() - days * 86400000) : null);
  const msgCutoff = deleteOlderThan(ws.retentionDays);
  const fileCutoff = deleteOlderThan(ws.fileRetentionDays);

  if (msgCutoff) {
    const deleted = await prisma.message.deleteMany({
      where: { workspaceId, sentAt: { lt: msgCutoff }, isDeleted: true, ...(protectedUserIds.length ? { authorId: { notIn: protectedUserIds } } : {}) },
    });
    results.messagesDeleted = deleted.count;
  }
  if (fileCutoff) {
    const deleted = await prisma.fileAsset.updateMany({ where: { workspaceId, createdAt: { lt: fileCutoff }, deletedAt: null }, data: { deletedAt: new Date() } });
    results.filesDeleted = deleted.count;
  }
  await recordAudit({ workspaceId, action: 'retention.enforced', targetType: 'Workspace', targetId: workspaceId, details: results });
  return results;
}

// --- Data export ------------------------------------------------------------
/** Export a workspace's structural data (members, channels, messages) as JSON. */
async function exportWorkspace(workspaceId) {
  const [workspace, members, channels, messages, files] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: { select: { id: true, displayName: true, email: true, username: true } } } }),
    prisma.channel.findMany({ where: { workspaceId } }),
    prisma.message.findMany({ where: { workspaceId }, orderBy: { sentAt: 'asc' } }),
    prisma.fileAsset.findMany({ where: { workspaceId } }),
  ]);
  return { exportedAt: new Date().toISOString(), workspace, members, channels, messages, files };
}

async function exportUserData(userId) {
  const [user, messages, files, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.message.findMany({ where: { authorId: userId } }),
    prisma.fileAsset.findMany({ where: { uploaderId: userId } }),
    prisma.workspaceMember.findMany({ where: { userId } }),
  ]);
  return { exportedAt: new Date().toISOString(), user, messages, files, memberships };
}

// --- Subscriptions ----------------------------------------------------------
async function getSubscription(workspaceId) {
  return prisma.workspaceSubscription.findUnique({ where: { workspaceId }, include: { plan: true } });
}

async function changePlan(workspaceId, tier, actorId) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { tier } });
  if (!plan) throw ApiError.badRequest(`Unknown plan tier: ${tier}`);
  const sub = await prisma.workspaceSubscription.upsert({
    where: { workspaceId },
    update: { planId: plan.id },
    create: { workspaceId, planId: plan.id, seats: 1 },
  });
  await recordAudit({ workspaceId, actorId, action: 'subscription.plan.changed', targetType: 'Subscription', targetId: sub.id, details: { tier } });
  return sub;
}

// --- Platform super-admin ---------------------------------------------------
async function listWorkspaces({ search, suspended, limit = 100, offset = 0 }) {
  const where = {
    deletedAt: null,
    ...(suspended != null ? { isSuspended: suspended } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { slug: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.workspace.findMany({ where, include: { _count: { select: { members: true, channels: true } }, subscription: { include: { plan: true } } }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.workspace.count({ where }),
  ]);
  return { items, total, limit, offset };
}

async function suspendWorkspace(workspaceId, reason, actorId) {
  const ws = await prisma.workspace.update({ where: { id: workspaceId }, data: { isSuspended: true, suspendedReason: reason } });
  await recordAudit({ workspaceId, actorId, action: 'workspace.suspended', targetType: 'Workspace', targetId: workspaceId, details: { reason } });
  return ws;
}

async function reinstateWorkspace(workspaceId, actorId) {
  const ws = await prisma.workspace.update({ where: { id: workspaceId }, data: { isSuspended: false, suspendedReason: null } });
  await recordAudit({ workspaceId, actorId, action: 'workspace.reinstated', targetType: 'Workspace', targetId: workspaceId });
  return ws;
}

async function listUsers({ search, deactivated, limit = 100, offset = 0 }) {
  const where = {
    ...(deactivated != null ? { isDeactivated: deactivated } : {}),
    ...(search ? { OR: [{ displayName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { username: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where: { ...where, NOT: { platformRole: 'SUPER_ADMIN' } }, select: { id: true, displayName: true, email: true, username: true, avatarUrl: true, presence: true, isDeactivated: true, isSuperAdmin: true, platformRole: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.user.count({ where }),
  ]);
  return { items, total, limit, offset };
}

async function setSuperAdmin(userId, value) {
  return prisma.user.update({ where: { id: userId }, data: { isSuperAdmin: value, platformRole: value ? 'SUPER_ADMIN' : 'USER' } });
}

async function deactivateUser(userId, deactivated = true) {
  return prisma.user.update({ where: { id: userId }, data: { isDeactivated: deactivated } });
}

/** Platform-wide counters for the super-admin dashboard. */
async function platformStats() {
  const [workspaces, users, messages, files, activeSubs] = await Promise.all([
    prisma.workspace.count({ where: { deletedAt: null, isSuspended: false } }),
    prisma.user.count({ where: { isDeactivated: false } }),
    prisma.message.count(),
    prisma.fileAsset.count({ where: { deletedAt: null } }),
    prisma.workspaceSubscription.count({ where: { status: 'ACTIVE' } }),
  ]);
  return { workspaces, users, messages, files, activeSubs };
}

module.exports = {
  recordAudit,
  auditLogs,
  createLegalHold,
  releaseLegalHold,
  listLegalHolds,
  enforceRetention,
  exportWorkspace,
  exportUserData,
  getSubscription,
  changePlan,
  listWorkspaces,
  suspendWorkspace,
  reinstateWorkspace,
  listUsers,
  setSuperAdmin,
  deactivateUser,
  platformStats,
};

