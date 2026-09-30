const asyncHandler = require('../utils/asyncHandler.util');
const { success, paginated } = require('../utils/response.util');
const workspaceService = require('../services/workspace.service');
const adminService = require('../services/admin.service');

const create = asyncHandler(async (req, res) => {
  const ws = await workspaceService.createWorkspace(req.user.id, req.body);
  await adminService.recordAudit({ workspaceId: ws.id, actorId: req.user.id, action: 'workspace.created', targetType: 'Workspace', targetId: ws.id, ipAddress: req.ip });
  return success(res, ws, 'Workspace created', 201);
});

const listMine = asyncHandler(async (req, res) => {
  const items = await workspaceService.listForUser(req.user.id);
  return success(res, items);
});

const getOne = asyncHandler(async (req, res) => {
  const ws = await workspaceService.getWorkspace(req.params.workspaceId);
  return success(res, ws);
});

const update = asyncHandler(async (req, res) => {
  const ws = await workspaceService.updateWorkspace(req.params.workspaceId, req.body);
  await adminService.recordAudit({ workspaceId: ws.id, actorId: req.user.id, action: 'workspace.updated', targetType: 'Workspace', targetId: ws.id, ipAddress: req.ip });
  return success(res, ws, 'Workspace updated');
});

const listMembers = asyncHandler(async (req, res) => {
  const members = await workspaceService.getWorkspace(req.params.workspaceId).then((w) => w.members);
  return success(res, members);
});

const addMember = asyncHandler(async (req, res) => {
  const member = await workspaceService.addMember(req.params.workspaceId, req.body);
  await adminService.recordAudit({ workspaceId: req.params.workspaceId, actorId: req.user.id, action: 'member.added', targetType: 'WorkspaceMember', targetId: member.id, details: req.body, ipAddress: req.ip });
  return success(res, member, 'Member added', 201);
});

const changeRole = asyncHandler(async (req, res) => {
  const member = await workspaceService.changeRole(req.params.workspaceId, req.params.userId, req.body.role);
  await adminService.recordAudit({ workspaceId: req.params.workspaceId, actorId: req.user.id, action: 'member.role.changed', targetType: 'WorkspaceMember', targetId: member.id, details: { role: req.body.role }, ipAddress: req.ip });
  return success(res, member, 'Role updated');
});

const deactivateMember = asyncHandler(async (req, res) => {
  const member = await workspaceService.deactivateMember(req.params.workspaceId, req.params.userId, req.body.deactivated !== false);
  return success(res, member, 'Membership updated');
});

const removeMember = asyncHandler(async (req, res) => {
  const result = await workspaceService.removeMember(req.params.workspaceId, req.params.userId);
  await adminService.recordAudit({ workspaceId: req.params.workspaceId, actorId: req.user.id, action: 'member.removed', targetType: 'WorkspaceMember', targetId: req.params.userId, ipAddress: req.ip });
  return success(res, result, 'Member removed');
});

const createInvite = asyncHandler(async (req, res) => {
  const invite = await workspaceService.createInviteLink(req.params.workspaceId, req.user.id, req.body);
  return success(res, invite, 'Invite link created', 201);
});

const joinByCode = asyncHandler(async (req, res) => {
  const ws = await workspaceService.joinByInviteCode(req.user.id, req.body.code);
  return success(res, ws, 'Joined workspace');
});

const requestJoin = asyncHandler(async (req, res) => {
  const request = await workspaceService.requestToJoin(req.params.workspaceId, req.user.id, req.body.message);
  return success(res, request, 'Join request submitted', 201);
});

const listJoinRequests = asyncHandler(async (req, res) => {
  const ws = await workspaceService.getWorkspace(req.params.workspaceId);
  return success(res, ws.joinRequests);
});

const reviewJoinRequest = asyncHandler(async (req, res) => {
  const result = await workspaceService.reviewJoinRequest(req.params.workspaceId, req.params.requestId, req.user.id, req.body.approve !== false);
  return success(res, result, 'Request reviewed');
});

const remove = asyncHandler(async (req, res) => {
  const result = await workspaceService.softDelete(req.params.workspaceId);
  await adminService.recordAudit({ workspaceId: req.params.workspaceId, actorId: req.user.id, action: 'workspace.deleted', targetType: 'Workspace', targetId: req.params.workspaceId, ipAddress: req.ip });
  return success(res, result, 'Workspace deleted');
});

module.exports = {
  create,
  listMine,
  getOne,
  update,
  listMembers,
  addMember,
  changeRole,
  deactivateMember,
  removeMember,
  createInvite,
  joinByCode,
  requestJoin,
  listJoinRequests,
  reviewJoinRequest,
  remove,
};
