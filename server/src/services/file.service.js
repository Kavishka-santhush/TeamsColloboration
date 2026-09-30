const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');
const { uploadRoot } = require('../config/upload');

/**
 * file.service — persists Multer-uploaded files to the DB, classifies them,
 * manages version history, comments, downloads and a per-workspace quota.
 */

function categorize(mimeType = '', originalName = '') {
  const ext = path.extname(originalName).toLowerCase();
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType === 'application/pdf' || ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf'].includes(ext)) return 'DOCUMENT';
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return 'ARCHIVE';
  if (['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rb', '.css', '.html', '.json', '.sql', '.sh'].includes(ext)) return 'CODE';
  return 'OTHER';
}

/** Record an uploaded file (called after Multer wrote it to disk). */
async function registerFile({ workspaceId, uploaderId, channelId, messageId, file }) {
  const relativePath = path.relative(uploadRoot, file.path).split(path.sep).join('/');
  return prisma.fileAsset.create({
    data: {
      workspaceId,
      uploaderId,
      channelId: channelId || null,
      messageId: messageId || null,
      originalName: file.originalname,
      storedName: file.filename,
      path: `/uploads/${relativePath}`,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      category: categorize(file.mimetype, file.originalname),
    },
  });
}

/** Upload a new *version* of an existing file. */
async function uploadVersion(previousId, { uploaderId, file }) {
  const previous = await prisma.fileAsset.findUnique({ where: { id: previousId } });
  if (!previous) throw ApiError.notFound('Previous file version not found');
  const relativePath = path.relative(uploadRoot, file.path).split(path.sep).join('/');
  return prisma.$transaction(async (tx) => {
    const updated = await tx.fileAsset.create({
      data: {
        workspaceId: previous.workspaceId,
        uploaderId,
        channelId: previous.channelId,
        originalName: file.originalname,
        storedName: file.filename,
        path: `/uploads/${relativePath}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        category: categorize(file.mimetype, file.originalname),
        version: previous.version + 1,
        previousId: previous.id,
      },
    });
    await tx.fileAsset.update({ where: { id: previous.id }, data: { deletedAt: new Date() } });
    return updated;
  });
}

async function listVersions(fileId) {
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId } });
  if (!file) throw ApiError.notFound('File not found');
  return prisma.fileAsset.findMany({
    where: { originalName: file.originalName, workspaceId: file.workspaceId },
    orderBy: { version: 'desc' },
  });
}

async function listFiles(workspaceId, { channelId, category, uploaderId, before, limit = 50 }) {
  return prisma.fileAsset.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(channelId ? { channelId } : {}),
      ...(category ? { category } : {}),
      ...(uploaderId ? { uploaderId } : {}),
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: { uploader: { select: { id: true, displayName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function getFile(fileId) {
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId }, include: { comments: { include: { user: { select: { id: true, displayName: true } } } } } });
  if (!file || file.deletedAt) throw ApiError.notFound('File not found');
  return file;
}

async function getDownloadPath(fileId) {
  const file = await getFile(fileId);
  const abs = path.join(uploadRoot, file.path.replace(/^\/uploads\//, ''));
  if (!fs.existsSync(abs)) throw ApiError.notFound('Stored file is missing on disk');
  return { abs, name: file.originalName, mimeType: file.mimeType };
}

async function rename(fileId, name) {
  return prisma.fileAsset.update({ where: { id: fileId }, data: { originalName: name } });
}

async function softDelete(fileId) {
  return prisma.fileAsset.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
}

// --- Comments & snippets ----------------------------------------------------
async function addComment(fileId, userId, body) {
  return prisma.fileComment.create({ data: { fileId, userId, body } });
}

async function createSnippet(workspaceId, authorId, { title, language, body, channelId, visibility }) {
  return prisma.snippet.create({ data: { workspaceId, authorId, title, language, body, channelId, visibility } });
}

// --- Quota ------------------------------------------------------------------
async function workspaceStorageUsed(workspaceId) {
  const agg = await prisma.fileAsset.aggregate({ where: { workspaceId, deletedAt: null }, _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes || 0;
}

async function checkQuota(workspaceId, incomingSize) {
  const subscription = await prisma.workspaceSubscription.findUnique({ where: { workspaceId }, include: { plan: true } });
  const perMemberMb = subscription?.plan?.storagePerMemberMb;
  if (!perMemberMb) return { allowed: true, unlimited: true }; // null => unlimited tier
  const memberCount = await prisma.workspaceMember.count({ where: { workspaceId } });
  const limitBytes = perMemberMb * 1024 * 1024 * memberCount;
  const used = await workspaceStorageUsed(workspaceId);
  return { allowed: used + incomingSize <= limitBytes, used, limitBytes };
}

module.exports = {
  registerFile,
  uploadVersion,
  listVersions,
  listFiles,
  getFile,
  getDownloadPath,
  rename,
  softDelete,
  addComment,
  createSnippet,
  workspaceStorageUsed,
  checkQuota,
  categorize,
};
