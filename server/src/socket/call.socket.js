const { toUser, getIo } = require('./registry');

/**
 * call.socket — WebRTC signalling relay. Media itself is peer-to-peer (via
 * simple-peer on the client); the server only forwards SDP offers/answers and
 * ICE candidates between the two peers, plus ring/accept/decline/end control.
 */
function registerCallHandlers(io, socket) {
  // Ring: caller asks a specific user to join a call.
  socket.on('call:ring', ({ calleeId, callId, type }) => {
    toUser(calleeId, 'call:incoming', { callId, type, callerId: socket.userId, caller: socket.user });
  });

  socket.on('call:accept', ({ calleeId, callId }) => {
    toUser(calleeId, 'call:accepted', { callId, callee: socket.user, calleeId: socket.userId });
    socket.join(`call:${callId}`);
  });

  socket.on('call:decline', ({ calleeId, callId }) => {
    toUser(calleeId, 'call:declined', { callId, by: socket.user });
  });

  socket.on('call:cancel', ({ calleeId, callId }) => {
    toUser(calleeId, 'call:cancelled', { callId });
  });

  // WebRTC signalling: forward offer/answer/ICE to the target peer.
  socket.on('webrtc:signal', ({ to, callId, signal }) => {
    toUser(to, 'webrtc:signal', { from: socket.userId, callId, signal });
  });

  // A peer joined a group room; announce presence to existing members.
  socket.on('call:peer-joined', ({ callId }) => {
    socket.join(`call:${callId}`);
    socket.to(`call:${callId}`).emit('call:peer-joined', { userId: socket.userId, user: socket.user, callId });
  });

  socket.on('call:end', ({ callId, withUserIds }) => {
    socket.leave(`call:${callId}`);
    (withUserIds || []).forEach((uid) => toUser(uid, 'call:ended', { callId }));
    io.to(`call:${callId}`).emit('call:ended', { callId });
  });

  // Cleanup dangling listeners on disconnect.
  socket.on('disconnect', () => {
    const srv = getIo();
    if (!srv) return;
    socket.rooms.forEach((room) => {
      if (room.startsWith('call:')) socket.to(room).emit('call:peer-left', { userId: socket.userId });
    });
  });
}

module.exports = registerCallHandlers;
