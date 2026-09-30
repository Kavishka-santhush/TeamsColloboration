const { Server } = require('socket.io');
const { verifyToken } = require('@clerk/clerk-sdk-node');
const prisma = require('../config/prisma');
const env = require('../config/env');
const logger = require('../utils/logger.util');
const { setIo, toUser, toWorkspace } = require('./registry');
const registerMessageHandlers = require('./message.socket');
const registerPresenceHandlers = require('./presence.socket');
const registerCallHandlers = require('./call.socket');

/**
 * Realtime layer. One Socket.io server shares the HTTP server with Express.
 * Authentication happens in the handshake: the client passes its Clerk JWT in
 * `auth.token`; we verify it and resolve the local User, then attach identity
 * data onto the socket for the domain handlers to use.
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    transports: ['websocket', 'polling'],
  });

  // Handshake auth middleware.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const session = await verifyToken(token);
      const user = await prisma.user.findUnique({ where: { clerkUserId: session.sub } });
      if (!user || user.isDeactivated) return next(new Error('Account not available'));
      socket.userId = user.id;
      socket.user = { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl };
      return next();
    } catch (err) {
      logger.warn(`socket auth failed: ${err.message}`);
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    // Everyone joins their personal room so services can DM-push to them.
    socket.join(`user:${socket.userId}`);
    logger.info(`socket connected: ${socket.user.displayName} (${socket.id})`);

    // Join a workspace room (broadcast target for member/channel lists etc.).
    socket.on('workspace:join', (workspaceId) => {
      socket.rooms.forEach((r) => { if (r.startsWith('workspace:')) socket.leave(r); });
      socket.join(`workspace:${workspaceId}`);
      toWorkspace(workspaceId, 'presence:update', { userId: socket.userId, presence: 'ONLINE' });
    });
    socket.on('workspace:leave', (workspaceId) => socket.leave(`workspace:${workspaceId}`));

    // Wire the domain-specific handlers.
    registerMessageHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerCallHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info(`socket disconnected: ${socket.userId}`);
      // Notify the user's workspaces they went offline (other sockets remain).
      toUser(socket.userId, 'presence:update', { userId: socket.userId, presence: 'OFFLINE' });
    });
  });

  setIo(io);
  logger.info('Socket.io initialised');
  return io;
}

module.exports = { initSocket };
