import { io } from 'socket.io-client';

// Lazy singleton socket. We connect after auth so the handshake can carry the
// Clerk token; every slice subscribes through these helper methods.
let socket = null;

export function connectSocket(token) {
  if (socket) return socket;
  const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
  socket = io(url, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Convenience emit/on wrappers ------------------------------------------------
export const emit = (event, payload, cb) => socket?.emit(event, payload, cb);
export const on = (event, handler) => {
  socket?.on(event, handler);
  return () => socket?.off(event, handler);
};
