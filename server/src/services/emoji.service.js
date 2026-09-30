const path = require('path');
const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');
const { uploadRoot } = require('../config/upload');

/**
 * emoji.service — full Unicode picker support lives client-side; this service
 * manages *custom* workspace emoji, aliases, animated emoji and recents.
 */

async function listForWorkspace(workspaceId) {
  return prisma.customEmoji.findMany({ where: { workspaceId, approved: true }, orderBy: { name: 'asc' } });
}

async function listPending(workspaceId) {
  return prisma.customEmoji.findMany({ where: { workspaceId, approved: false } });
}

/** Register an uploaded custom emoji (image already saved by Multer). */
async function createCustom(workspaceId, createdBy, { name, file, isAnimated }) {
  const cleanName = name.replace(/^:|:$/g, '').toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(cleanName)) throw ApiError.badRequest('Emoji name may only contain a-z, 0-9, _ and -');
  const relativePath = path.relative(uploadRoot, file.path).split(path.sep).join('/');
  return prisma.customEmoji.upsert({
    where: { workspaceId_name: { workspaceId, name: cleanName } },
    update: { imageUrl: `/uploads/${relativePath}`, isAnimated: !!isAnimated, approved: true },
    create: { workspaceId, name: cleanName, imageUrl: `/uploads/${relativePath}`, isAnimated: !!isAnimated, createdBy },
  });
}

async function approve(id, approved = true) {
  return prisma.customEmoji.update({ where: { id }, data: { approved } });
}

async function remove(id) {
  return prisma.customEmoji.delete({ where: { id } });
}

// --- Aliases ----------------------------------------------------------------
async function addAlias(workspaceId, alias, targetEmoji) {
  return prisma.emojiAlias.upsert({
    where: { workspaceId_alias: { workspaceId, alias } },
    update: { targetEmoji },
    create: { workspaceId, alias, targetEmoji },
  });
}

async function resolveAlias(workspaceId, name) {
  const alias = await prisma.emojiAlias.findUnique({ where: { workspaceId_alias: { workspaceId, alias: name } } });
  return alias ? alias.targetEmoji : null;
}

// --- Recently used ----------------------------------------------------------
async function recordRecent(userId, emoji) {
  await prisma.emojiRecentlyUsed.upsert({
    where: { userId_emoji: { userId, emoji } },
    update: { usedAt: new Date() },
    create: { userId, emoji },
  });
}

async function getRecents(userId, limit = 24) {
  return prisma.emojiRecentlyUsed.findMany({ where: { userId }, orderBy: { usedAt: 'desc' }, take: limit, select: { emoji: true } });
}

module.exports = {
  listForWorkspace,
  listPending,
  createCustom,
  approve,
  remove,
  addAlias,
  resolveAlias,
  recordRecent,
  getRecents,
};
