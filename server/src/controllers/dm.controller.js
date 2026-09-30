const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const dmService = require('../services/dm.service');

const start = asyncHandler(async (req, res) => {
  const dm = await dmService.startDm(req.workspaceId, req.user.id, req.body.userIds);
  return success(res, dm, 'Conversation ready', 201);
});

const listMine = asyncHandler(async (req, res) => {
  const dms = await dmService.listForUser(req.workspaceId, req.user.id);
  return success(res, dms);
});

const getOne = asyncHandler(async (req, res) => {
  const dm = await dmService.getDm(req.params.dmId);
  return success(res, dm);
});

const markRead = asyncHandler(async (req, res) => {
  const result = await dmService.markRead(req.params.dmId, req.user.id);
  return success(res, result, 'Marked read');
});

const mute = asyncHandler(async (req, res) => {
  const result = await dmService.mute(req.params.dmId, req.body.muted !== false);
  return success(res, result, 'DM mute updated');
});

const convertToChannel = asyncHandler(async (req, res) => {
  const channel = await dmService.convertToChannel(req.params.dmId, { name: req.body.name, createdBy: req.user.id });
  return success(res, channel, 'Converted to channel', 201);
});

const block = asyncHandler(async (req, res) => {
  const result = await dmService.blockUser(req.user.id, req.body.userId || req.params.userId);
  return success(res, result, 'User blocked');
});

const unblock = asyncHandler(async (req, res) => {
  const result = await dmService.unblockUser(req.user.id, req.body.userId || req.params.userId);
  return success(res, result, 'User unblocked');
});

const createRequest = asyncHandler(async (req, res) => {
  const request = await dmService.createMessageRequest(req.workspaceId, {
    requesterId: req.user.id,
    recipientId: req.body.recipientId,
    dmId: req.body.dmId,
    body: req.body.body,
  });
  return success(res, request, 'Message request sent', 201);
});

const respondToRequest = asyncHandler(async (req, res) => {
  const result = await dmService.respondToRequest(req.params.requestId, req.user.id, req.body.status);
  return success(res, result, 'Request responded');
});

module.exports = { start, listMine, getOne, markRead, mute, convertToChannel, block, unblock, createRequest, respondToRequest };
