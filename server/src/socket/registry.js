/**
 * Socket registry — a tiny module holding the Socket.io `io` instance so any
 * service (not just socket handlers) can broadcast events. The instance is set
 * once at boot in index.js and read everywhere else.
 */
let io = null;

function setIo(instance) {
  io = instance;
}

function getIo() {
  return io;
}

/** Emit to a room (e.g. `workspace:<id>`, `channel:<id>`, `user:<id>`). */
function toRoom(room, event, payload) {
  if (io) io.to(room).emit(event, payload);
}

function toUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

function toChannel(channelId, event, payload) {
  if (io) io.to(`channel:${channelId}`).emit(event, payload);
}

function toWorkspace(workspaceId, event, payload) {
  if (io) io.to(`workspace:${workspaceId}`).emit(event, payload);
}

module.exports = { setIo, getIo, toRoom, toUser, toChannel, toWorkspace };
