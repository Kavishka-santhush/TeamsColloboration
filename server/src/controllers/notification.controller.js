const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const notificationService = require('../services/notification.service');

const list = asyncHandler(async (req, res) => {
  const items = await notificationService.list(req.user.id, { workspaceId: req.workspaceId, limit: Number(req.query.limit) || 50 });
  return success(res, items);
});

const markRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markRead(req.user.id, req.params.notificationId);
  return success(res, result, 'Notification read');
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.user.id, req.workspaceId);
  return success(res, result, 'All notifications read');
});

const getPreferences = asyncHandler(async (req, res) => {
  const prefs = await notificationService.getPreferences(req.user.id, req.workspaceId);
  return success(res, prefs);
});

const setPreferences = asyncHandler(async (req, res) => {
  const prefs = await notificationService.setPreferences(req.user.id, req.body);
  return success(res, prefs, 'Preferences saved');
});

module.exports = { list, markRead, markAllRead, getPreferences, setPreferences };
