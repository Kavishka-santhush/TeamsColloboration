const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const analyticsService = require('../services/analytics.service');

const overview = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.workspaceOverview(req.workspaceId));
});

const messageVolume = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.messageVolume(req.workspaceId, Number(req.query.days) || 30));
});

const topContributors = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.topContributors(req.workspaceId, Number(req.query.limit) || 10));
});

const peakHours = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.peakHours(req.workspaceId));
});

const channel = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.channelAnalytics(req.workspaceId, req.params.channelId));
});

const memberEngagement = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.memberEngagement(req.workspaceId));
});

const searchAnalytics = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.searchAnalytics(req.workspaceId));
});

const fileStorageByType = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.fileStorageByType(req.workspaceId));
});

const aiInsights = asyncHandler(async (req, res) => {
  return success(res, await analyticsService.aiInsights(req.workspaceId));
});

module.exports = { overview, messageVolume, topContributors, peakHours, channel, memberEngagement, searchAnalytics, fileStorageByType, aiInsights };
