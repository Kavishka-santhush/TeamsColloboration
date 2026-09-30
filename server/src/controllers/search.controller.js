const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const searchService = require('../services/search.service');

const search = asyncHandler(async (req, res) => {
  const results = await searchService.search({
    workspaceId: req.workspaceId,
    query: req.query.q || req.query.query || '',
    userId: req.user.id,
    semantic: req.query.semantic === 'true',
    limit: Number(req.query.limit) || 50,
  });
  return success(res, results);
});

const history = asyncHandler(async (req, res) => {
  const items = await searchService.history(req.user.id, Number(req.query.limit) || 10);
  return success(res, items);
});

const save = asyncHandler(async (req, res) => {
  const saved = await searchService.saveSearch(req.user.id, { workspaceId: req.workspaceId, ...req.body });
  return success(res, saved, 'Search saved', 201);
});

const listSaved = asyncHandler(async (req, res) => {
  const items = await searchService.listSavedSearches(req.user.id);
  return success(res, items);
});

module.exports = { search, history, save, listSaved };
