const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const { ApiError } = require('../utils/response.util');
const fileService = require('../services/file.service');

/**
 * File controller. Multer (configured in the routes) populates req.file /
 * req.files before these handlers run; we only persist metadata + streams.
 */
const upload = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) throw ApiError.badRequest('No file uploaded');

  const quota = await fileService.checkQuota(req.workspaceId, files.reduce((s, f) => s + f.size, 0));
  if (!quota.allowed) throw new ApiError(413, 'Storage quota exceeded', quota, 'QUOTA_EXCEEDED');

  const created = [];
  for (const f of files) {
    created.push(await fileService.registerFile({
      workspaceId: req.workspaceId,
      uploaderId: req.user.id,
      channelId: req.body.channelId,
      messageId: req.body.messageId,
      file: f,
    }));
  }
  return success(res, created, 'File uploaded', 201);
});

const list = asyncHandler(async (req, res) => {
  const items = await fileService.listFiles(req.workspaceId, req.query);
  return success(res, items);
});

const getOne = asyncHandler(async (req, res) => {
  const file = await fileService.getFile(req.params.fileId);
  return success(res, file);
});

const download = asyncHandler(async (req, res) => {
  const { abs, name, mimeType } = await fileService.getDownloadPath(req.params.fileId);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
  return fs.createReadStream(abs).pipe(res);
});

const versions = asyncHandler(async (req, res) => {
  const items = await fileService.listVersions(req.params.fileId);
  return success(res, items);
});

const uploadNewVersion = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const file = await fileService.uploadVersion(req.params.fileId, { uploaderId: req.user.id, file: req.file });
  return success(res, file, 'New version uploaded', 201);
});

const rename = asyncHandler(async (req, res) => {
  const file = await fileService.rename(req.params.fileId, req.body.name);
  return success(res, file, 'File renamed');
});

const remove = asyncHandler(async (req, res) => {
  const result = await fileService.softDelete(req.params.fileId);
  return success(res, result, 'File deleted');
});

const comment = asyncHandler(async (req, res) => {
  const result = await fileService.addComment(req.params.fileId, req.user.id, req.body.body);
  return success(res, result, 'Comment added', 201);
});

const createSnippet = asyncHandler(async (req, res) => {
  const snippet = await fileService.createSnippet(req.workspaceId, req.user.id, req.body);
  return success(res, snippet, 'Snippet created', 201);
});

const storage = asyncHandler(async (req, res) => {
  const used = await fileService.workspaceStorageUsed(req.workspaceId);
  const quota = await fileService.checkQuota(req.workspaceId, 0);
  return success(res, { used, ...quota });
});

module.exports = { upload, list, getOne, download, versions, uploadNewVersion, rename, remove, comment, createSnippet, storage };
