const prisma = require('../config/prisma');
const axios = require('axios');
const crypto = require('crypto');
const { ApiError } = require('../utils/response.util');
const messageService = require('./message.service');
const { encrypt, decrypt, generateApiKey, sha256 } = require('../utils/encryption.util');

/**
 * integration.service — incoming/outgoing webhooks and provider event handlers
 * (GitHub, GitLab, Jira, Google Calendar, RSS, custom apps). Outbound secrets
 * are encrypted at rest; incoming webhook payloads are normalised into chat
 * messages posted to a channel.
 */

async function createIntegration(workspaceId, createdBy, { channelId, type, name, config, secret }) {
  const data = {
    workspaceId,
    channelId: channelId || null,
    type,
    name,
    config: config || {},
    createdBy,
    secretEncrypted: secret ? encrypt(secret) : null,
  };
  if (type === 'INCOMING_WEBHOOK' || type === 'CUSTOM_APP') {
    const apiKey = generateApiKey('int');
    data.apiKeyHash = sha256(apiKey);
    data.config = { ...config, apiKey }; // returned once to the creator
  }
  const integration = await prisma.integration.create({ data });
  return integration;
}

async function list(workspaceId) {
  const items = await prisma.integration.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
  // Never leak secrets/api keys on read.
  return items.map(({ secretEncrypted, config, ...rest }) => ({ ...rest, config: { ...(config || {}), apiKey: undefined } }));
}

async function toggle(id, enabled) {
  return prisma.integration.update({ where: { id }, data: { enabled } });
}

async function remove(id) {
  return prisma.integration.delete({ where: { id } });
}

/** Verify an incoming webhook's API key by hashing the presented token. */
async function verifyIncomingToken(integration, presentedToken) {
  if (!integration.apiKeyHash) return false;
  return sha256(presentedToken) === integration.apiKeyHash;
}

/** Handle an inbound webhook payload for a channel. */
async function handleIncoming(integrationId, payload, presentedToken) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId }, include: { channel: true } });
  if (!integration || !integration.enabled) throw ApiError.notFound('Integration disabled or missing');
  if (!(await verifyIncomingToken(integration, presentedToken))) throw ApiError.unauthorized('Invalid webhook token');

  const text = payload.text || payload.content || formatGeneric(payload);
  const message = await messageService.sendMessage({
    authorId: integration.createdBy,
    workspaceId: integration.workspaceId,
    channelId: integration.channelId,
    body: text,
    type: 'BOT',
    metadata: { integration: integration.type, source: 'webhook' },
  });
  await prisma.integrationLog.create({ data: { integrationId, direction: 'inbound', event: payload.event || 'webhook', payload, statusCode: 200 } });
  return message;
}

// --- Provider event normalizers --------------------------------------------
const EVENT_HANDLERS = {
  GITHUB: (payload) => {
    const repo = payload.repository?.full_name || 'repo';
    if (payload.pull_request) return `[${repo}] PR #${payload.number} ${payload.action}: ${payload.pull_request.title}`;
    if (payload.issue) return `[${repo}] Issue #${payload.issue.number} ${payload.action}: ${payload.issue.title}`;
    if (payload.commits) return `[${repo}] ${payload.commits.length} new commit(s) pushed to ${payload.ref}`;
    return `[${repo}] GitHub event: ${payload.action || 'unknown'}`;
  },
  GITLAB: (payload) => {
    const proj = payload.project?.path || 'project';
    if (payload.object_kind === 'merge_request') return `[${proj}] MR !${payload.object_attributes.iid} ${payload.object_attributes.state}: ${payload.object_attributes.title}`;
    if (payload.object_kind === 'push') return `[${proj}] ${payload.total_commits_count || 0} commit(s) pushed to ${payload.ref}`;
    return `[${proj}] GitLab ${payload.object_kind}`;
  },
  JIRA: (payload) => {
    const issue = payload.issue;
    if (!issue) return 'Jira event';
    return `[JIRA] ${issue.key} ${payload.webhookEvent}: ${issue.fields?.summary || ''}`;
  },
  GOOGLE_CALENDAR: (payload) => `[Calendar] ${payload.summary || 'Event'} — ${payload.hangoutsLink || payload.location || ''}`,
  RSS: (payload) => `[RSS] New item: ${payload.title}\n${payload.link}`,
};

function formatGeneric(payload) {
  return '```json\n' + JSON.stringify(payload, null, 2).slice(0, 1500) + '\n```';
}

async function handleProviderEvent(integrationId, provider, payload) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId }, include: { channel: true } });
  if (!integration || !integration.enabled) throw ApiError.notFound('Integration disabled or missing');
  const formatter = EVENT_HANDLERS[provider] || formatGeneric;
  const text = formatter(payload);
  const message = await messageService.sendMessage({
    authorId: integration.createdBy,
    workspaceId: integration.workspaceId,
    channelId: integration.channelId,
    body: text,
    type: 'BOT',
    metadata: { integration: provider },
  });
  await prisma.integrationLog.create({ data: { integrationId, direction: 'inbound', event: provider, payload, statusCode: 200 } });
  return message;
}

/** Outbound webhook: POST a channel event to every matching external URL. */
async function dispatchOutgoing(workspaceId, channelId, event, data) {
  const integrations = await prisma.integration.findMany({
    where: { workspaceId, channelId, type: { in: ['OUTGOING_WEBHOOK', 'ZAPIER'] }, enabled: true },
  });
  await Promise.all(
    integrations.map(async (integ) => {
      const url = integ.config?.url;
      if (!url) return;
      try {
        const signature = integ.secretEncrypted ? crypto.createHmac('sha256', decrypt(integ.secretEncrypted)).update(JSON.stringify(data)).digest('hex') : undefined;
        const res = await axios.post(url, { event, ...data }, { headers: { 'X-Webhook-Signature': signature }, timeout: 8000 });
        await prisma.integrationLog.create({ data: { integrationId: integ.id, direction: 'outbound', event, payload: data, statusCode: res.status } });
      } catch (err) {
        await prisma.integrationLog.create({ data: { integrationId: integ.id, direction: 'outbound', event, payload: data, statusCode: err.response?.status || 0 } });
      }
    }),
  );
}

async function logs(integrationId, limit = 50) {
  return prisma.integrationLog.findMany({ where: { integrationId }, orderBy: { createdAt: 'desc' }, take: limit });
}

module.exports = {
  createIntegration,
  list,
  toggle,
  remove,
  handleIncoming,
  handleProviderEvent,
  dispatchOutgoing,
  logs,
  verifyIncomingToken,
};
