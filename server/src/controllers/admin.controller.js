const asyncHandler = require('../utils/asyncHandler.util');
const { success, paginated } = require('../utils/response.util');
const adminService = require('../services/admin.service');

// --- Audit ------------------------------------------------------------------
const auditLogs = asyncHandler(async (req, res) => {
  const items = await adminService.auditLogs(req.workspaceId, { ...req.query, limit: Number(req.query.limit) || 100 });
  return success(res, items);
});

// --- Legal hold -------------------------------------------------------------
const createLegalHold = asyncHandler(async (req, res) => {
  const hold = await adminService.createLegalHold(req.workspaceId, req.user.id, req.body);
  return success(res, hold, 'Legal hold created', 201);
});

const releaseLegalHold = asyncHandler(async (req, res) => {
  const hold = await adminService.releaseLegalHold(req.params.holdId, req.user.id);
  return success(res, hold, 'Legal hold released');
});

const listLegalHolds = asyncHandler(async (req, res) => {
  return success(res, await adminService.listLegalHolds(req.workspaceId));
});

// --- Retention & export -----------------------------------------------------
const enforceRetention = asyncHandler(async (req, res) => {
  return success(res, await adminService.enforceRetention(req.workspaceId), 'Retention enforced');
});

const exportWorkspace = asyncHandler(async (req, res) => {
  return success(res, await adminService.exportWorkspace(req.workspaceId), 'Export ready');
});

const exportUserData = asyncHandler(async (req, res) => {
  return success(res, await adminService.exportUserData(req.user.id), 'Export ready');
});

// --- Subscriptions ----------------------------------------------------------
const getSubscription = asyncHandler(async (req, res) => {
  return success(res, await adminService.getSubscription(req.workspaceId));
});

const changePlan = asyncHandler(async (req, res) => {
  const sub = await adminService.changePlan(req.workspaceId, req.body.tier, req.user.id);
  return success(res, sub, 'Plan changed');
});

// --- Platform super-admin ---------------------------------------------------
const listWorkspaces = asyncHandler(async (req, res) => {
  const { items, total, limit, offset } = await adminService.listWorkspaces(req.query);
  return paginated(res, items, { limit, offset, total, totalPages: Math.ceil(total / limit) });
});

const suspendWorkspace = asyncHandler(async (req, res) => {
  return success(res, await adminService.suspendWorkspace(req.params.workspaceId, req.body.reason, req.user.id), 'Workspace suspended');
});

const reinstateWorkspace = asyncHandler(async (req, res) => {
  return success(res, await adminService.reinstateWorkspace(req.params.workspaceId, req.user.id), 'Workspace reinstated');
});

const listUsers = asyncHandler(async (req, res) => {
  const { items, total, limit, offset } = await adminService.listUsers(req.query);
  return paginated(res, items, { limit, offset, total, totalPages: Math.ceil(total / limit) });
});

const setSuperAdmin = asyncHandler(async (req, res) => {
  return success(res, await adminService.setSuperAdmin(req.params.userId, req.body.value !== false), 'Role updated');
});

const deactivateUser = asyncHandler(async (req, res) => {
  return success(res, await adminService.deactivateUser(req.params.userId, req.body.deactivated !== false), 'User updated');
});

const platformStats = asyncHandler(async (req, res) => {
  return success(res, await adminService.platformStats());
});

module.exports = {
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
