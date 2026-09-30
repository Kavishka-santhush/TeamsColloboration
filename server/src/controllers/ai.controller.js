const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const aiService = require('../services/ai.service');
const messageService = require('../services/message.service');

/**
 * ai.controller — each endpoint is a thin wrapper over an OpenRouter feature.
 * Context (channel/DM history) is assembled here, then handed to ai.service.
 */
const summarizeChannel = asyncHandler(async (req, res) => {
  const { items } = await messageService.listMessages({ channelId: req.body.channelId, limit: Number(req.body.limit) || 100 });
  const text = items.map((m) => `${m.author?.displayName}: ${m.body}`).join('\n');
  return success(res, await aiService.summarizeText(text, { workspaceId: req.workspaceId, userId: req.user.id, focus: req.body.focus }));
});

const summarizeThread = asyncHandler(async (req, res) => {
  const thread = await messageService.getMessage(req.body.rootMessageId);
  const replies = await messageService.listMessages({ channelId: thread.channelId, limit: 200 });
  const text = replies.items.filter((m) => m.threadRootId === thread.id).map((m) => m.body).join('\n');
  return success(res, await aiService.summarizeText(text, { workspaceId: req.workspaceId, userId: req.user.id }));
});

const smartReplies = asyncHandler(async (req, res) => {
  const { items } = await messageService.listMessages({ channelId: req.body.channelId, limit: 20 });
  const context = items.map((m) => m.body).join('\n');
  return success(res, await aiService.smartReplies(req.body.incomingMessage || '', context, { workspaceId: req.workspaceId, userId: req.user.id }));
});

const translate = asyncHandler(async (req, res) => {
  return success(res, await aiService.translate(req.body.text, req.body.language, { workspaceId: req.workspaceId, userId: req.user.id }));
});

const sentiment = asyncHandler(async (req, res) => {
  const { items } = await messageService.listMessages({ channelId: req.body.channelId, limit: Number(req.body.limit) || 100 });
  return success(res, await aiService.sentiment(items, { workspaceId: req.workspaceId, userId: req.user.id }));
});

const meetingNotes = asyncHandler(async (req, res) => {
  return success(res, await aiService.meetingNotes(req.body.transcript, { workspaceId: req.workspaceId, userId: req.user.id }));
});

const actionItems = asyncHandler(async (req, res) => {
  return success(res, await aiService.extractActionItems(req.body.text, { workspaceId: req.workspaceId, userId: req.user.id }));
});

const writingAssistant = asyncHandler(async (req, res) => {
  return success(res, await aiService.writingAssistant(req.body.text, req.body.tone || 'professional', { workspaceId: req.workspaceId, userId: req.user.id }));
});

const chatbot = asyncHandler(async (req, res) => {
  return success(res, await aiService.chatbot(req.body.question, req.body.history || [], req.body.context || '', { workspaceId: req.workspaceId, userId: req.user.id }));
});

const suggestTopic = asyncHandler(async (req, res) => {
  const { items } = await messageService.listMessages({ channelId: req.body.channelId, limit: 50 });
  return success(res, await aiService.suggestTopic(items, { workspaceId: req.workspaceId, userId: req.user.id }));
});

const detectToxicity = asyncHandler(async (req, res) => {
  return success(res, await aiService.detectToxicity(req.body.text, { workspaceId: req.workspaceId, userId: req.user.id }));
});

const icebreaker = asyncHandler(async (req, res) => {
  return success(res, await aiService.icebreaker({ workspaceId: req.workspaceId, userId: req.user.id }));
});

module.exports = {
  summarizeChannel,
  summarizeThread,
  smartReplies,
  translate,
  sentiment,
  meetingNotes,
  actionItems,
  writingAssistant,
  chatbot,
  suggestTopic,
  detectToxicity,
  icebreaker,
};
