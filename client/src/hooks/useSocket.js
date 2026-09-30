import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { getSocket, on } from '../socket/index.js';
import { onNewMessage, onTyping } from '../store/slices/messageSlice.js';
import { onNotification } from '../store/slices/notificationSlice.js';
import { onPresenceUpdate } from '../store/slices/presenceSlice.js';
import { addParticipant, removeParticipant } from '../store/slices/callSlice.js';

// Single hook that subscribes the socket stream to Redux. Mounted once inside
// AppShell so every realtime event updates the correct slice.
export function useSocket(workspaceId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!getSocket()) return undefined;
    const unsubs = [
      on('message:new', (m) => dispatch(onNewMessage(m))),
      on('message:typing', (p) => dispatch(onTyping(p))),
      on('notification:new', (n) => dispatch(onNotification(n))),
      on('presence:update', (p) => dispatch(onPresenceUpdate(p))),
      on('call:join', (p) => dispatch(addParticipant(p))),
      on('call:leave', (p) => dispatch(removeParticipant(p.userId))),
    ];
    if (workspaceId) getSocket().emit('workspace:join', workspaceId);
    return () => unsubs.forEach((u) => u && u());
  }, [dispatch, workspaceId]);
}
