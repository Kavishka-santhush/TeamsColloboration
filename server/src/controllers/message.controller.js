const asyncHandler = require('../utils/asyncHandler.util');
const { success, paginated } = require('../utils/response.util');
const prisma = require('../config/prisma');
const messageService = require('../services/message.service');

/**
 * Message controller. A single send endpoint serves channels, DMs and thread
 * replies — the destination is inferred from which id is present in the body.
 */
const send = asyncHandler(async (req, res) => {
  const { channelId, dmConversationId, threadRootId, body, richContent, type, metadata, scheduledAt, attachments, workspaceId } = req.body;
  const message = await messageService.sendMessage({
    authorId: req.user.id,
    workspaceId: req.workspaceId || workspaceId,
    channelId,
    dmConversationId,
    threadRootId,
    body,
    richContent,
    type,
    metadata: { ...metadata, attachments },
    scheduledAt,
  });
  return success(res, message, 'Message sent', 201);
});

// listMessages already aggregates reactions + returns { items, hasMore, nextCursor }.
const list = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const result = await messageService.listMessages({
    channelId: req.params.channelId,
    dmConversationId: req.query.dmConversationId,
    before: req.query.before,
    limit,
  });
  return paginated(res, result.items, { limit, hasMore: result.hasMore, nextCursor: result.nextCursor });
});

const getOne = asyncHandler(async (req, res) => {
  const message = await messageService.getMessage(req.params.messageId);
  return success(res, message);
});

const edit = asyncHandler(async (req, res) => {
  const message = await messageService.editMessage(req.params.messageId, req.user.id, { body: req.body.body, richContent: req.body.richContent });
  return success(res, message, 'Message updated');
});

const remove = asyncHandler(async (req, res) => {
  const result = await messageService.deleteMessage(req.params.messageId, req.user.id, {
    isSuperAdmin: req.user.isSuperAdmin,
    mode: req.body.mode,
  });
  return success(res, result, 'Message deleted');
});

const react = asyncHandler(async (req, res) => {
  const result = await messageService.toggleReaction(req.params.messageId, req.user.id, req.body.emoji, !!req.body.isCustom);
  return success(res, result, 'Reaction toggled');
});

const forward = asyncHandler(async (req, res) => {
  const message = await messageService.forwardMessage(req.params.messageId, req.user.id, { toChannelId: req.body.toChannelId, toDmId: req.body.toDmId });
  return success(res, message, 'Message forwarded', 201);
});

// NOTE: personal-state service calls take userId first.
const star = asyncHandler(async (req, res) => {
  const result = await messageService.starMessage(req.user.id, req.params.messageId, req.body.starred !== false);
  return success(res, result, 'Star updated');
});

const bookmark = asyncHandler(async (req, res) => {
  const result = await messageService.bookmark(req.user.id, { messageId: req.params.messageId, ...req.body });
  return success(res, result, 'Bookmark created', 201);
});

const reminder = asyncHandler(async (req, res) => {
  const result = await messageService.setReminder(req.user.id, { messageId: req.params.messageId, channelId: req.body.channelId, note: req.body.note, remindAt: req.body.remindAt });
  return success(res, result, 'Reminder set', 201);
});

const read = asyncHandler(async (req, res) => {
  // Accept either a single messageId or an array of ids.
  const ids = Array.isArray(req.body.messageIds) ? req.body.messageIds : [req.params.messageId || req.body.messageId].filter(Boolean);
  const result = await messageService.recordRead(ids, req.user.id);
  return success(res, result, 'Read recorded');
});

/**
 * Unified history endpoint the client uses for any conversation id: resolve
 * whether the id is a channel or a DM, then delegate to the same list logic.
 */
const listByConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const limit = Number(req.query.limit) || 50;
  const channel = await prisma.channel.findFirst({ where: { id: conversationId, workspaceId: req.workspaceId }, select: { id: true } });
  let result;
  if (channel) {
    result = await messageService.listMessages({ channelId: conversationId, before: req.query.before, limit });
  } else {
    const dm = await prisma.dmConversation.findFirst({ where: { id: conversationId, workspaceId: req.workspaceId }, select: { id: true } });
    if (!dm) throw (require('../utils/response.util').ApiError).notFound('Conversation not found');
    result = await messageService.listMessages({ dmConversationId: conversationId, before: req.query.before, limit });
  }
  return paginated(res, result.items, { limit, hasMore: result.hasMore, nextCursor: result.nextCursor });
});

module.exports = { send, list, listByConversation, getOne, edit, remove, react, forward, star, bookmark, reminder, read };
