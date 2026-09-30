const { ApiError } = require('../utils/response.util');

/**
 * Role & permission middleware built on top of the Platform + Workspace role
 * hierarchy. Runs after requireAuth.
 *
 * Workspace role precedence (highest -> lowest):
 *   OWNER > ADMIN > CHANNEL_MANAGER > MEMBER > GUEST / BOT
 */
const ROLE_RANK = {
  OWNER: 5,
  ADMIN: 4,
  CHANNEL_MANAGER: 3,
  MEMBER: 2,
  GUEST: 1,
  BOT: 1,
};

function rankOf(role) {
  return ROLE_RANK[role] ?? 0;
}

/** Require the caller to be the platform super admin. */
function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) return next(ApiError.forbidden('Super admin access required'));
  return next();
}

/** Require membership in the target workspace (populated by auth middleware). */
function requireWorkspaceMember(req, res, next) {
  if (!req.membership) return next(ApiError.forbidden('You are not a member of this workspace'));
  if (req.membership.isDeactivated) return next(ApiError.forbidden('Your membership is deactivated'));
  return next();
}

/** Require a minimum workspace role. */
function requireWorkspaceRole(minRole) {
  return (req, res, next) => {
    if (!req.membership) return next(ApiError.forbidden('Workspace membership required'));
    if (rankOf(req.membership.role) < rankOf(minRole)) {
      return next(ApiError.forbidden(`Requires ${minRole} role or higher`));
    }
    return next();
  };
}

/** Convenience: ADMIN or above (manage channels, members, integrations). */
const requireAdmin = requireWorkspaceRole('ADMIN');
/** Convenience: CHANNEL_MANAGER or above. */
const requireChannelManager = requireWorkspaceRole('CHANNEL_MANAGER');

/**
 * Fine-grained permission check. Maps an action to the minimum role needed.
 * `permissions` example: { 'channel.delete': 'ADMIN', 'message.pin': 'MEMBER' }
 */
function requirePermission(action, permissions = {}) {
  return (req, res, next) => {
    const minRole = permissions[action] || 'MEMBER';
    return requireWorkspaceRole(minRole)(req, res, next);
  };
}

module.exports = {
  requireSuperAdmin,
  requireWorkspaceMember,
  requireWorkspaceRole,
  requireAdmin,
  requireChannelManager,
  requirePermission,
  ROLE_RANK,
};
