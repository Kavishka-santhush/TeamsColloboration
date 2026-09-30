import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { setActiveDm } from '../store/slices/dmSlice.js';
import { fetchMessages } from '../store/slices/messageSlice.js';
import { emit } from '../socket/index.js';
import ConversationHeader from '../components/message/ConversationHeader.jsx';
import MessageList from '../components/message/MessageList.jsx';
import MessageComposer from '../components/message/MessageComposer.jsx';

/**
 * DmView — /w/:workspaceId/dm/:dmId. Structurally a ChannelView for a DM
 * conversation: same message pipeline, only the room event (dm:join) and the
 * header shape (participant name instead of #channel) differ.
 */
export default function DmView() {
  const { workspaceId, dmId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const dm = useSelector((s) => s.dms.conversations.find((d) => d.id === dmId));
  const loading = useSelector((s) => dmId ? !!s.messages.loadingById[dmId] : false);

  useEffect(() => {
    if (!dmId) return;
    dispatch(fetchMessages({ conversationId: dmId }));
    dispatch(setActiveDm(dmId));
    emit('dm:join', dmId);
    emit('message:read', { channelId: dmId, messageIds: [] });
    return () => emit('dm:leave', dmId);
  }, [dmId, dispatch]);

  if (!dm) {
    return (
      <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
        {loading || !dm ? 'Loading conversation…' : 'Conversation not found.'}
      </div>
    );
  }

  return (
    <>
      <ConversationHeader conversation={dm} kind="dm" />
      <MessageList conversationId={dm.id} onOpenThread={(m) => navigate(`?thread=${m.id}`)} />
      <MessageComposer workspaceId={workspaceId} dmConversationId={dm.id} />
    </>
  );
}
