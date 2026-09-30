const prisma = require('../config/prisma');
const { toWorkspace } = require('./registry');
const authService = require('../services/auth.service');

/**
 * presence.socket — tracks online/away/dnd and broadcasts changes so member
 * lists and avatars update live. On connect the user is marked ONLINE; the
 * client can also push explicit status changes.
 */
function registerPresenceHandlers(io, socket) {
  const broadcast = async (presence) => {
    const memberships = await prisma.workspaceMember.findMany({ where: { userId: socket.userId }, select: { workspaceId: true } });
    memberships.forEach((m) => toWorkspace(m.workspaceId, 'presence:update', { userId: socket.userId, presence }));
  };

  socket.on('presence:set', async (presence) => {
    if (!['ONLINE', 'AWAY', 'DND', 'OFFLINE'].includes(presence)) return;
    await authService.setPresence(socket.userId, presence, 'socket');
    await broadcast(presence);
  });

  // Lightweight heartbeat the client pings to stay ONLINE / flip to AWAY.
  socket.on('presence:heartbeat', () => broadcast('ONLINE'));
}

module.exports = registerPresenceHandlers;
