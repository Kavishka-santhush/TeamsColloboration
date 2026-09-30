const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const channelService = require('../services/channel.service');
const adminService = require('../services/admin.service');

const create = asyncHandler(async (req, res) => {
  const channel = await channelService.createChannel(req.params.workspaceId, req.user.id, req.body);
  await adminService.recordAudit({ workspaceId: req.params.workspaceId, actorId: req.user.id, action: 'channel.created', targetType: 'Channel', targetId: channel.id, details: { name: channel.name }, ipAddress: req.ip });
  return success(res, channel, 'Channel created', 201);
});

const listMine = asyncHandler(async (req, res) => {
  const channels = await channelService.listForUser(req.params.workspaceId, req.user.id);
  return success(res, channels);
});

const getOne = asyncHandler(async (req, res) => {
  const channel = await channelService.getChannel(req.params.channelId);
  return success(res, channel);
});

const update = asyncHandler(async (req, res) => {
  const channel = await channelService.updateChannel(req.params.channelId, req.body);
  return success(res, channel, 'Channel updated');
});

const addMembers = asyncHandler(async (req, res) => {
  const result = await channelService.addMembers(req.params.channelId, req.body.userIds);
  return success(res, result, 'Members added');
});

const removeMember = asyncHandler(async (req, res) => {
  const result = await channelService.removeMember(req.params.channelId, req.params.userId);
  return success(res, result, 'Member removed');
});

const setManager = asyncHandler(async (req, res) => {
  const result = await channelService.setManager(req.params.channelId, req.params.userId, req.body.isManager !== false);
  return success(res, result, 'Manager updated');
});

const mute = asyncHandler(async (req, res) => {
  // note: muteChannel/markRead take userId FIRST
  const result = await channelService.muteChannel(req.user.id, req.params.channelId, req.body.muted !== false);
  return success(res, result, 'Channel mute updated');
});

const markRead = asyncHandler(async (req, res) => {
  const result = await channelService.markRead(req.user.id, req.params.channelId);
  return success(res, result, 'Marked read');
});

const archive = asyncHandler(async (req, res) => {
  const channel = await channelService.archiveChannel(req.params.channelId, req.body.archived !== false);
  return success(res, channel, 'Channel archived state updated');
});

const remove = asyncHandler(async (req, res) => {
  const result = await channelService.deleteChannel(req.params.channelId);
  await adminService.recordAudit({ actorId: req.user.id, action: 'channel.deleted', targetType: 'Channel', targetId: req.params.channelId, ipAddress: req.ip });
  return success(res, result, 'Channel deleted');
});

const pin = asyncHandler(async (req, res) => {
  const result = await channelService.pinMessage(req.params.channelId, req.params.messageId, req.user.id);
  return success(res, result, 'Message pinned', 201);
});

const unpin = asyncHandler(async (req, res) => {
  const result = await channelService.unpinMessage(req.params.channelId, req.params.messageId);
  return success(res, result, 'Message unpinned');
});

const createSection = asyncHandler(async (req, res) => {
  const section = await channelService.createSection(req.params.workspaceId, req.body.name, req.body.position || 0);
  return success(res, section, 'Section created', 201);
});

const moveChannelToSection = asyncHandler(async (req, res) => {
  // signature: moveChannelToSection(sectionId, channelId, position)
  const result = await channelService.moveChannelToSection(req.body.sectionId, req.params.channelId, req.body.position || 0);
  return success(res, result, 'Channel moved');
});

module.exports = {
  create,
  listMine,
  getOne,
  update,
  addMembers,
  removeMember,
  setManager,
  mute,
  markRead,
  archive,
  remove,
  pin,
  unpin,
  createSection,
  moveChannelToSection,
};
