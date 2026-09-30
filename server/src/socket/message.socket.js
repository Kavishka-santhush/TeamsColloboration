const { toChannel, toUser } = require('./registry');
const messageService = require('../services/message.service');

/**
 * message.socket — channel-room membership, typing indicators and live send.
 * Typing is ephemeral (never persisted); sending over the socket reuses the
 * exact same service pipeline as the REST endpoint so behavior is identical.
 */
function registerMessageHandlers(io, socket) {
  // Join/leave the channel rooms the user is currently viewing.
  socket.on('channel:join', (channelId) => socket.join(`channel:${channelId}`));
  socket.on('channel:leave', (channelId) => socket.leave(`channel:${channelId}`));

  // DM conversations reuse the channel room convention via `dm:<id>`.
  socket.on('dm:join', (dmId) => socket.join(`channel:${dmId}`));
  socket.on('dm:leave', (dmId) => socket.leave(`channel:${dmId}`));

  // Typing indicator: relay to everyone else in the room, exclude the sender.
  socket.on('message:typing', ({ channelId, dmConversationId, typing }) => {
    const room = channelId ? `channel:${channelId}` : dmConversationId ? `channel:${dmConversationId}` : null;
    if (!room) return;
    io.to(room).emit('message:typing', { channelId, dmConversationId, userId: socket.userId, user: socket.user, typing });
  });

  // Read receipts: mark messages read and tell the author's other sessions.
  socket.on('message:read', async ({ messageIds, channelId }) => {
    try {
      if (Array.isArray(messageIds) && messageIds.length) {
        await messageService.recordRead(messageIds, socket.userId);
        if (channelId) toChannel(channelId, 'message:read', { userId: socket.userId, messageIds });
      }
    } catch (err) {
      io.to(socket.id).emit('error', { message: 'Failed to record read' });
    }
  });

  // Live send over the socket (optional path; REST remains authoritative).
  socket.on('message:send', async (payload, ack) => {
    try {
      const message = await messageService.sendMessage({ ...payload, authorId: socket.userId });
      if (typeof ack === 'function') ack({ ok: true, message });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
      else toUser(socket.userId, 'error', { message: 'Send failed' });
    }
  });
}

module.exports = registerMessageHandlers;
