const prisma = require('../config/prisma');
const aiService = require('./ai.service');

/**
 * analytics.service — aggregation queries that power the Recharts dashboards
 * (workspace overview, per-channel activity, member engagement, storage, calls,
 * search) plus an AI "team health" narrative.
 */

const dayStart = (days = 30) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function workspaceOverview(workspaceId) {
  const since = dayStart(30);
  const [activeMembers, messagesSent, filesShared, channelsActive, storageAgg, calls] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId, isDeactivated: false } }),
    prisma.message.count({ where: { workspaceId, sentAt: { gte: since }, isDeleted: false } }),
    prisma.fileAsset.count({ where: { workspaceId, createdAt: { gte: since }, deletedAt: null } }),
    prisma.channel.count({ where: { workspaceId, isArchived: false, lastActivityAt: { gte: since } } }),
    prisma.fileAsset.aggregate({ where: { workspaceId, deletedAt: null }, _sum: { sizeBytes: true } }),
    prisma.call.aggregate({ where: { workspaceId, status: 'ENDED' }, _sum: { durationSec: true } }),
  ]);
  return {
    activeMembers,
    messagesSent,
    filesShared,
    channelsActive,
    storageBytes: Number(storageAgg._sum.sizeBytes || 0),
    totalCallMinutes: Math.round((calls._sum.durationSec || 0) / 60),
  };
}

/** Messages per day for the last N days (for a line chart). */
async function messageVolume(workspaceId, days = 30) {
  const since = dayStart(days);
  const rows = await prisma.message.groupBy({
    by: ['sentAt'],
    where: { workspaceId, sentAt: { gte: since }, isDeleted: false },
    _count: true,
  });
  // Bucket into day labels client-agnostic (aggregate by ISO date here).
  const buckets = {};
  rows.forEach((r) => {
    const key = r.sentAt.toISOString().slice(0, 10);
    buckets[key] = (buckets[key] || 0) + r._count;
  });
  return Object.entries(buckets).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

async function topContributors(workspaceId, limit = 10) {
  const since = dayStart(30);
  const grouped = await prisma.message.groupBy({
    by: ['authorId'],
    where: { workspaceId, sentAt: { gte: since }, isDeleted: false },
    _count: true,
    orderBy: { _count: { authorId: 'desc' } },
    take: limit,
  });
  const users = await prisma.user.findMany({ where: { id: { in: grouped.map((g) => g.authorId) } }, select: { id: true, displayName: true, avatarUrl: true } });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return grouped.map((g) => ({ user: byId[g.authorId], messages: g._count }));
}

/** Peak-hours histogram (0-23) from message timestamps. */
async function peakHours(workspaceId) {
  const since = dayStart(30);
  const rows = await prisma.message.findMany({ where: { workspaceId, sentAt: { gte: since } }, select: { sentAt: true } });
  const hist = new Array(24).fill(0);
  rows.forEach((r) => hist[r.sentAt.getUTCHours()] += 1);
  return hist.map((count, hour) => ({ hour, count }));
}

async function channelAnalytics(workspaceId, channelId) {
  const since = dayStart(30);
  const [volume, contributors] = await Promise.all([
    prisma.message.count({ where: { channelId, sentAt: { gte: since } } }),
    prisma.message.groupBy({ by: ['authorId'], where: { channelId, sentAt: { gte: since } }, _count: true, orderBy: { _count: { authorId: 'desc' } }, take: 5 }),
  ]);
  return { volume, topContributors: contributors.map((c) => ({ authorId: c.authorId, count: c._count })) };
}

async function memberEngagement(workspaceId) {
  const since = dayStart(30);
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } });
  return Promise.all(members.map(async (m) => ({
    user: m.user,
    messages: await prisma.message.count({ where: { authorId: m.userId, workspaceId, sentAt: { gte: since } } }),
    reactions: await prisma.reaction.count({ where: { userId: m.userId, message: { workspaceId } } }),
    files: await prisma.fileAsset.count({ where: { uploaderId: m.userId, workspaceId, createdAt: { gte: since } } }),
  })));
}

async function searchAnalytics(workspaceId) {
  const rows = await prisma.searchHistory.findMany({ where: {}, select: { query: true } });
  const counts = {};
  rows.forEach((r) => { counts[r.query] = (counts[r.query] || 0) + 1; });
  return Object.entries(counts).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 20);
}

async function fileStorageByType(workspaceId) {
  const grouped = await prisma.fileAsset.groupBy({ by: ['category'], where: { workspaceId, deletedAt: null }, _sum: { sizeBytes: true }, _count: true });
  return grouped.map((g) => ({ category: g.category, bytes: Number(g._sum.sizeBytes || 0), count: g._count }));
}

async function aiInsights(workspaceId) {
  const recent = await prisma.message.findMany({ where: { workspaceId, isDeleted: false }, orderBy: { sentAt: 'desc' }, take: 200, select: { body: true } });
  const sentiment = await aiService.sentiment(recent, { workspaceId });
  return { sampleSize: recent.length, sentiment };
}

/** Persist a daily snapshot row (used by the analytics cron job). */
async function snapshotDay(workspaceId, date = new Date()) {
  const overview = await workspaceOverview(workspaceId);
  const day = new Date(date).toISOString().slice(0, 10);
  return prisma.analyticsSnapshot.upsert({
    where: { workspaceId_date: { workspaceId, date: new Date(day) } },
    update: { ...overview, storageBytes: BigInt(overview.storageBytes) },
    create: { workspaceId, date: new Date(day), ...overview, storageBytes: BigInt(overview.storageBytes) },
  });
}

module.exports = {
  workspaceOverview,
  messageVolume,
  topContributors,
  peakHours,
  channelAnalytics,
  memberEngagement,
  searchAnalytics,
  fileStorageByType,
  aiInsights,
  snapshotDay,
};

