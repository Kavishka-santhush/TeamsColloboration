const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const { ApiError } = require('../utils/response.util');
const emojiService = require('../services/emoji.service');

const list = asyncHandler(async (req, res) => {
  const items = await emojiService.listForWorkspace(req.workspaceId);
  return success(res, items);
});

const listPending = asyncHandler(async (req, res) => {
  const items = await emojiService.listPending(req.workspaceId);
  return success(res, items);
});

const create = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('An emoji image is required');
  const emoji = await emojiService.createCustom(req.workspaceId, req.user.id, {
    name: req.body.name,
    file: req.file,
    isAnimated: req.body.isAnimated === 'true' || req.body.isAnimated === true,
  });
  return success(res, emoji, 'Custom emoji created', 201);
});

const approve = asyncHandler(async (req, res) => {
  const emoji = await emojiService.approve(req.params.emojiId, req.body.approved !== false);
  return success(res, emoji, 'Emoji approval updated');
});

const remove = asyncHandler(async (req, res) => {
  const result = await emojiService.remove(req.params.emojiId);
  return success(res, result, 'Emoji deleted');
});

const addAlias = asyncHandler(async (req, res) => {
  const alias = await emojiService.addAlias(req.workspaceId, req.body.alias, req.body.targetEmoji);
  return success(res, alias, 'Alias created', 201);
});

const recents = asyncHandler(async (req, res) => {
  const items = await emojiService.getRecents(req.user.id, Number(req.query.limit) || 24);
  return success(res, items);
});

const recordRecent = asyncHandler(async (req, res) => {
  const result = await emojiService.recordRecent(req.user.id, req.body.emoji);
  return success(res, result, 'Recent emoji recorded');
});

module.exports = { list, listPending, create, approve, remove, addAlias, recents, recordRecent };
