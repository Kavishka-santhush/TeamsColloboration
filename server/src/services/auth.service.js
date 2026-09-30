const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');

/**
 * auth.service — syncs a Clerk-authenticated identity into our database and
 * exposes profile / presence mutations. Clerk owns credentials; we only store
 * the app-specific profile fields.
 */

/** Upsert a user from Clerk webhook / onboarding payload. */
async function upsertUserFromClerk(clerkUser) {
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    `${clerkUser.id}@clerk.local`;

  const base = {
    clerkUserId: clerkUser.id,
    email,
    displayName:
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username || email.split('@')[0],
    firstName: clerkUser.firstName || null,
    lastName: clerkUser.lastName || null,
    avatarUrl: clerkUser.imageUrl || null,
  };

  // Derive a unique username from email local-part if not provided.
  let username = clerkUser.username || email.split('@')[0].replace(/[^a-z0-9._-]/gi, '').toLowerCase();
  username = await ensureUniqueUsername(username);

  return prisma.user.upsert({
    where: { clerkUserId: clerkUser.id },
    update: base,
    create: { ...base, username },
  });
}

async function ensureUniqueUsername(candidate) {
  let username = candidate || 'user';
  // loop until a free username is found (append suffix on collision)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await prisma.user.findUnique({ where: { username } });
    if (!exists) return username;
    username = `${username}${Math.floor(Math.random() * 1000)}`;
  }
}

/** Get a user's profile by their DB id (safe fields only). */
async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, displayName: true, firstName: true, lastName: true,
      avatarUrl: true, title: true, phone: true, timezone: true, pronouns: true, bio: true,
      statusMessage: true, statusEmoji: true, statusExpiry: true, presence: true, language: true,
      theme: true, workingHours: true, accessibility: true, isSuperAdmin: true, platformRole: true,
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/** Partial profile update (display name, avatar, title, timezone, ...). */
async function updateProfile(userId, patch) {
  const allowed = [
    'displayName', 'firstName', 'lastName', 'avatarUrl', 'title', 'phone', 'timezone',
    'pronouns', 'bio', 'language', 'theme', 'workingHours', 'accessibility',
    'statusMessage', 'statusEmoji', 'statusExpiry',
  ];
  const data = {};
  for (const key of allowed) if (key in patch) data[key] = patch[key];
  return prisma.user.update({ where: { id: userId }, data });
}

/** Set presence + append a status-log row for audit / auto-away tracking. */
async function setPresence(userId, presence, source = 'manual') {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { presence, lastActiveAt: new Date() },
  });
  await prisma.userStatusLog.create({ data: { userId, presence, source } });
  return updated;
}

/** Resolve a user by username (used by mention autocompletion). */
async function findByUsername(workspaceId, query) {
  return prisma.user.findMany({
    where: {
      isDeactivated: false,
      OR: [{ username: { contains: query, mode: 'insensitive' } }, { displayName: { contains: query, mode: 'insensitive' } }],
    },
    take: 10,
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
}

module.exports = {
  upsertUserFromClerk,
  getProfile,
  updateProfile,
  setPresence,
  findByUsername,
  ensureUniqueUsername,
};
