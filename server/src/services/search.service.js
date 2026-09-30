const prisma = require('../config/prisma');
const db = require('../config/db');
const aiService = require('./ai.service');
const logger = require('../utils/logger.util');

/**
 * search.service — PostgreSQL full-text (tsvector) + trigram (pg_trgm) search
 * over messages, plus fuzzy search across files, channels and members. An
 * optional `semantic` mode uses AI to interpret the query by meaning.
 */

/** Parse Slack-like filter tokens: from:, in:, before:, after:, has:, type:. */
function parseFilters(query) {
  const filters = {};
  const clean = query.replace(/\b(from|in|before|after|has|type):(\S+)/gi, (_, key, val) => {
    filters[key.toLowerCase()] = val;
    return '';
  }).trim();
  return { clean, filters };
}

async function searchMessages({ workspaceId, query, userId, filters = {}, limit = 50 }) {
  const params = [workspaceId, query, limit];
  let sql = `
    SELECT m.*, u."displayName", u."username", u."avatarUrl",
           ts_rank(m."searchVector", plainto_tsquery('english', $2)) AS rank
    FROM "Message" m
    JOIN "User" u ON u."id" = m."authorId"
    WHERE m."workspaceId" = $1
      AND m."isDeleted" = false
      AND m."scheduledAt" IS NULL
      AND (m."searchVector" @@ plainto_tsquery('english', $2) OR m."body" ILIKE '%' || $2 || '%')`;

  if (filters.from) { sql += ` AND u."username" = (SELECT "username" FROM "User" WHERE "id" = $${params.push(filters.from) - 1})`; }
  if (filters.channelId) { sql += ` AND m."channelId" = $${params.push(filters.channelId) - 1}`; }
  if (filters.before) { sql += ` AND m."sentAt" < $${params.push(filters.before) - 1}`; }
  if (filters.after) { sql += ` AND m."sentAt" > $${params.push(filters.after) - 1}`; }
  if (filters.has === 'file') { sql += ` AND EXISTS (SELECT 1 FROM "FileAsset" f WHERE f."messageId" = m."id")`; }
  if (filters.has === 'reaction') { sql += ` AND EXISTS (SELECT 1 FROM "Reaction" r WHERE r."messageId" = m."id")`; }

  sql += ` ORDER BY rank DESC, m."sentAt" DESC`;
  const { rows } = await db.query(sql, params);
  return rows;
}

async function searchFiles(workspaceId, query, limit = 30) {
  const like = `%${query}%`;
  return prisma.fileAsset.findMany({
    where: { workspaceId, deletedAt: null, originalName: { contains: query, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    // pg_trgm could accelerate this via raw SQL; Prisma contains() is fine here.
    ...{ include: { uploader: { select: { id: true, displayName: true } } } },
  }).catch(() => prisma.fileAsset.findMany({ where: { workspaceId, originalName: { startsWith: like.slice(1, -1) } }, take: limit }));
}

async function searchChannels(workspaceId, query) {
  return prisma.channel.findMany({
    where: { workspaceId, isArchived: false, OR: [{ name: { contains: query, mode: 'insensitive' } }, { topic: { contains: query, mode: 'insensitive' } }] },
    take: 20,
  });
}

async function searchMembers(workspaceId, query) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId, user: { OR: [{ displayName: { contains: query, mode: 'insensitive' } }, { username: { contains: query, mode: 'insensitive' } }] } },
    include: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true, presence: true, title: true } } },
    take: 20,
  }).then((r) => r.map((m) => m.user));
}

/** Global search entrypoint. */
async function search({ workspaceId, query, userId, semantic = false, limit = 50 }) {
  const { clean, filters } = parseFilters(query);
  let effectiveQuery = clean;

  if (semantic) {
    // AI-enhanced: expand the natural-language query into keywords first.
    try {
      effectiveQuery = await aiService
        .chatbot(`Rewrite this search intent into 5-10 space-separated keywords for full-text search: "${query}"`, [], '', { workspaceId, userId })
        .then((r) => r.answer);
    } catch (e) {
      logger.warn(`semantic expansion failed, using raw query: ${e.message}`);
    }
  }

  const resolvedFilters = {};
  if (filters.in) {
    const ch = await prisma.channel.findFirst({ where: { workspaceId, normalizedSlug: filters.in.replace(/^#/, '').toLowerCase() } });
    if (ch) resolvedFilters.channelId = ch.id;
  }
  if (filters.from) {
    const u = await prisma.user.findUnique({ where: { username: filters.from.replace(/^@/, '') } });
    if (u) resolvedFilters.from = u.id;
  }

  const [messages, files, channels, members] = await Promise.all([
    searchMessages({ workspaceId, query: effectiveQuery, userId, filters: { ...filters, ...resolvedFilters }, limit }).catch((e) => { logger.error(`searchMessages: ${e.message}`); return []; }),
    searchFiles(workspaceId, effectiveQuery),
    searchChannels(workspaceId, effectiveQuery),
    searchMembers(workspaceId, effectiveQuery),
  ]);

  // Record search history (best effort).
  await prisma.searchHistory.create({ data: { userId, query, filters } }).catch(() => {});

  return { messages, files, channels, members };
}

// --- Saved searches & history ----------------------------------------------
async function history(userId, limit = 10) {
  return prisma.searchHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
}

async function saveSearch(userId, { workspaceId, name, query, filters }) {
  return prisma.savedSearch.create({ data: { userId, workspaceId, name, query, filters } });
}

async function listSavedSearches(userId) {
  return prisma.savedSearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

module.exports = { search, searchMessages, searchFiles, searchChannels, searchMembers, history, saveSearch, listSavedSearches, parseFilters };
