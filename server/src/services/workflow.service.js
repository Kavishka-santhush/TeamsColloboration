const prisma = require('../config/prisma');
const axios = require('axios');
const { ApiError } = require('../utils/response.util');
const messageService = require('./message.service');
const logger = require('../utils/logger.util');

/**
 * workflow.service — trigger -> action automation. Triggers are emitted from
 * elsewhere in the app (e.g. a new message posts, a member joins) via
 * `runTriggers()`; each matching enabled workflow executes its actions and
 * records a WorkflowRun log.
 */

async function create(workspaceId, createdBy, { name, description, triggerType, triggerConfig, actions, formFields, isTemplate }) {
  return prisma.workflow.create({
    data: { workspaceId, createdBy, name, description, triggerType, triggerConfig: triggerConfig || {}, actions: actions || [], formFields: formFields || null, isTemplate: !!isTemplate },
  });
}

async function list(workspaceId) {
  return prisma.workflow.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
}

async function get(id) {
  const wf = await prisma.workflow.findUnique({ where: { id }, include: { runs: { orderBy: { startedAt: 'desc' }, take: 20 } } });
  if (!wf) throw ApiError.notFound('Workflow not found');
  return wf;
}

async function update(id, patch) {
  return prisma.workflow.update({ where: { id }, data: patch });
}

async function toggle(id, enabled) {
  return prisma.workflow.update({ where: { id }, data: { enabled } });
}

async function remove(id) {
  return prisma.workflow.delete({ where: { id } });
}

/** Execute a single action step. */
async function executeAction(workspaceId, action, ctx) {
  const { type, config = {} } = action;
  switch (type) {
    case 'SEND_CHANNEL_MESSAGE':
      return messageService.sendMessage({
        authorId: config.authorId || ctx.triggeredBy || workspaceId,
        workspaceId,
        channelId: config.channelId,
        body: renderTemplate(config.text, ctx),
        type: 'BOT',
      });
    case 'SEND_DM':
      return messageService.sendMessage({
        authorId: ctx.triggeredBy,
        workspaceId,
        dmConversationId: config.dmId,
        body: renderTemplate(config.text, ctx),
        type: 'BOT',
      });
    case 'CREATE_REMINDER':
      return prisma.reminder.create({ data: { userId: config.userId, note: renderTemplate(config.note, ctx), remindAt: new Date(config.remindAt) } });
    case 'POST_WEBHOOK':
      return axios.post(config.url, { ...ctx, text: renderTemplate(config.text, ctx) }, { timeout: 8000 }).then((r) => ({ status: r.status }));
    case 'ADD_REACTION':
      return messageService.toggleReaction(config.messageId, config.userId || ctx.triggeredBy, config.emoji);
    case 'ARCHIVE_CHANNEL':
      return prisma.channel.update({ where: { id: config.channelId }, data: { isArchived: true } });
    default:
      throw ApiError.badRequest(`Unknown action type: ${type}`);
  }
}

/** Tiny {{variable}} template substitution from the trigger context. */
function renderTemplate(text = '', ctx) {
  return text.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
    return val == null ? '' : String(val);
  });
}

/** Fire all matching workflows for a trigger event. */
async function runTriggers(workspaceId, triggerType, ctx) {
  const workflows = await prisma.workflow.findMany({ where: { workspaceId, enabled: true, triggerType } });
  const results = [];
  for (const wf of workflows) {
    if (!matchesTriggerConfig(wf.triggerConfig, ctx)) continue;
    const run = await prisma.workflowRun.create({ data: { workflowId: wf.id, status: 'SUCCESS', input: ctx } });
    try {
      const outputs = [];
      for (const action of wf.actions || []) {
        outputs.push(await executeAction(workspaceId, action, ctx));
      }
      await prisma.workflowRun.update({ where: { id: run.id }, data: { status: 'SUCCESS', output: { outputs }, finishedAt: new Date() } });
      results.push({ workflowId: wf.id, ok: true });
    } catch (err) {
      logger.error(`workflow ${wf.id} failed: ${err.message}`);
      await prisma.workflowRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: err.message, finishedAt: new Date() } });
      results.push({ workflowId: wf.id, ok: false, error: err.message });
    }
  }
  return results;
}

function matchesTriggerConfig(config, ctx) {
  if (!config) return true;
  if (config.channelId && ctx.channelId && config.channelId !== ctx.channelId) return false;
  if (config.command && ctx.command && config.command !== ctx.command) return false;
  return true;
}

module.exports = {
  create,
  list,
  get,
  update,
  toggle,
  remove,
  runTriggers,
  executeAction,
  renderTemplate,
};
