const { verifyToken } = require('@clerk/clerk-sdk-node');
const prisma = require('../config/prisma');
const { ApiError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

/**
 * Authentication middleware. Clerk validates the JWT from the Authorization
 * header; we then load (and cache) the matching local User row and attach it to
 * req.user so controllers/services never touch Clerk directly.
 *
 * Also reads an optional `x-workspace-id` header and resolves the caller's
 * WorkspaceMember row (used by the role middleware).
 */
async function authenticate(req, res, next, options = {}) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Missing bearer token');

    const session = await verifyToken(token);
    if (!session) throw ApiError.unauthorized('Invalid or expired token');

    const user = await prisma.user.findUnique({ where: { clerkUserId: session.sub } });
    if (!user) {
      // Clerk knows this user but we have not synced them yet.
      throw ApiError.forbidden('User profile not found. Please complete onboarding.');
    }
    if (user.isDeactivated) throw ApiError.forbidden('Your account has been deactivated.');

    req.user = user;
    req.clerkSession = session;

    const workspaceId = req.headers['x-workspace-id'] || req.params.workspaceId;
    if (workspaceId) {
      const membership = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId } },
      });
      req.workspaceId = workspaceId;
      req.membership = membership; // may be null -> role middleware decides
    }

    return next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    logger.error(`auth.middleware: ${err.message}`);
    return next(ApiError.unauthorized('Authentication failed'));
  }
}

/** Require authentication, otherwise 401. */
const requireAuth = (req, res, next) => authenticate(req, res, next);

/** Allow anonymous access but still resolve the user if a token is present. */
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return next();
  return authenticate(req, res, next);
};

module.exports = { requireAuth, optionalAuth, authenticate };
