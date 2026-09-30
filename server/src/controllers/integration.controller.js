const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const integrationService = require('../services/integration.service');

const create = asyncHandler(async (req, res) => {
  const integration = await integrationService.createIntegration(req.workspaceId, req.user.id, req.body);
  return success(res, integration, 'Integration created', 201);
});

const list = asyncHandler(async (req, res) => {
  const items = await integrationService.list(req.workspaceId);
  return success(res, items);
});

const toggle = asyncHandler(async (req, res) => {
  const result = await integrationService.toggle(req.params.integrationId, req.body.enabled !== false);
  return success(res, result, 'Integration toggled');
});

const remove = asyncHandler(async (req, res) => {
  const result = await integrationService.remove(req.params.integrationId);
  return success(res, result, 'Integration deleted');
});

const logs = asyncHandler(async (req, res) => {
  const items = await integrationService.logs(req.params.integrationId, Number(req.query.limit) || 50);
  return success(res, items);
});

/** Public incoming webhook endpoint (auth via the integration's token). */
const incoming = asyncHandler(async (req, res) => {
  const token = req.headers['x-webhook-token'] || req.query.token || req.params.token;
  const message = await integrationService.handleIncoming(req.params.integrationId, req.body, token);
  return success(res, message, 'Webhook processed', 201);
});

/** Provider event endpoint (GitHub/GitLab/Jira etc.), keyed by provider name. */
const providerEvent = asyncHandler(async (req, res) => {
  const message = await integrationService.handleProviderEvent(req.params.integrationId, req.params.provider.toUpperCase(), req.body);
  return success(res, message, 'Event processed', 201);
});

module.exports = { create, list, toggle, remove, logs, incoming, providerEvent };
