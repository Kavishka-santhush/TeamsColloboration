const asyncHandler = require('../utils/asyncHandler.util');
const { success, ApiError } = require('../utils/response.util');
const { verifyToken } = require('@clerk/clerk-sdk-node');
const authService = require('../services/auth.service');

/**
 * Sync the signed-in Clerk user into our DB and return the local profile.
 * This CANNOT use requireAuth (the row may not exist yet), so we verify the
 * bearer token directly and upsert based on the session subject.
 */
const sync = asyncHandler(async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Missing bearer token');
  let session;
  try {
    session = await verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid token');
  }
  // Merge client-supplied profile hints (from useUser()) with session claims.
  const clerkUser = {
    id: session.sub,
    emailAddresses: [{ emailAddress: req.body?.clientState?.primaryEmailAddress?.emailAddress }].filter((e) => e.emailAddress),
    firstName: req.body?.clientState?.firstName,
    lastName: req.body?.clientState?.lastName,
    imageUrl: req.body?.clientState?.imageUrl,
    username: req.body?.clientState?.username,
  };
  const profile = await authService.upsertUserFromClerk(clerkUser);
  return success(res, profile, 'Profile synced');
});

/** Thin HTTP adapters: extract inputs, call the service, format the response. */

const getProfile = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user.id);
  return success(res, profile);
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await authService.updateProfile(req.user.id, req.body);
  return success(res, profile, 'Profile updated');
});

const setPresence = asyncHandler(async (req, res) => {
  const result = await authService.setPresence(req.user.id, req.body.presence, req.body.source || 'manual');
  return success(res, result, 'Presence updated');
});

const setStatus = asyncHandler(async (req, res) => {
  const result = await authService.updateProfile(req.user.id, {
    statusMessage: req.body.statusMessage ?? null,
    statusEmoji: req.body.statusEmoji ?? null,
    statusExpiry: req.body.statusExpiry ?? null,
  });
  return success(res, result, 'Status updated');
});

const findByUsername = asyncHandler(async (req, res) => {
  // signature: findByUsername(workspaceId, query)
  const users = await authService.findByUsername(req.workspaceId || req.query.workspaceId, req.query.username);
  return success(res, users);
});

module.exports = { sync, getProfile, updateProfile, setPresence, setStatus, findByUsername };
