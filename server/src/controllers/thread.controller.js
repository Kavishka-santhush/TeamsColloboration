const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const threadService = require('../services/thread.service');

const getThread = asyncHandler(async (req, res) => {
  const thread = await threadService.getThread(req.params.rootMessageId);
  return success(res, thread);
});

const reply = asyncHandler(async (req, res) => {
  const message = await threadService.reply({
    authorId: req.user.id,
    rootMessageId: req.params.rootMessageId,
    body: req.body.body,
    richContent: req.body.richContent,
    alsoSendChannel: req.body.alsoSendChannel,
  });
  return success(res, message, 'Reply posted', 201);
});

const follow = asyncHandler(async (req, res) => {
  const result = await threadService.follow(req.params.threadId, req.user.id);
  return success(res, result, 'Following thread');
});

const unfollow = asyncHandler(async (req, res) => {
  const result = await threadService.unfollow(req.params.threadId, req.user.id);
  return success(res, result, 'Unfollowed thread');
});

const listMine = asyncHandler(async (req, res) => {
  const threads = await threadService.listUserThreads(req.workspaceId, req.user.id, Number(req.query.limit) || 30);
  return success(res, threads);
});

module.exports = { getThread, reply, follow, unfollow, listMine };
