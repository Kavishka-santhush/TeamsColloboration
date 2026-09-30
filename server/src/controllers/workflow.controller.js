const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const workflowService = require('../services/workflow.service');

const create = asyncHandler(async (req, res) => {
  const wf = await workflowService.create(req.workspaceId, req.user.id, req.body);
  return success(res, wf, 'Workflow created', 201);
});

const list = asyncHandler(async (req, res) => {
  const items = await workflowService.list(req.workspaceId);
  return success(res, items);
});

const getOne = asyncHandler(async (req, res) => {
  const wf = await workflowService.get(req.params.workflowId);
  return success(res, wf);
});

const update = asyncHandler(async (req, res) => {
  const wf = await workflowService.update(req.params.workflowId, req.body);
  return success(res, wf, 'Workflow updated');
});

const toggle = asyncHandler(async (req, res) => {
  const wf = await workflowService.toggle(req.params.workflowId, req.body.enabled !== false);
  return success(res, wf, 'Workflow toggled');
});

const remove = asyncHandler(async (req, res) => {
  const result = await workflowService.remove(req.params.workflowId);
  return success(res, result, 'Workflow deleted');
});

/** Manually run a workflow's actions (used by "Try it" in the builder). */
const run = asyncHandler(async (req, res) => {
  const wf = await workflowService.get(req.params.workflowId);
  const outputs = [];
  for (const action of wf.actions || []) {
    outputs.push(await workflowService.executeAction(req.workspaceId, action, req.body.context || {}));
  }
  return success(res, outputs, 'Workflow executed');
});

module.exports = { create, list, getOne, update, toggle, remove, run };
