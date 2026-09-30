import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { selectChannels, setActiveChannel } from '../store/slices/channelSlice.js';
import { fetchMessages } from '../store/slices/messageSlice.js';
import { emit } from '../socket/index.js';
import ConversationHeader from '../components/message/ConversationHeader.jsx';
import MessageList from '../components/message/MessageList.jsx';
import MessageComposer from '../components/message/MessageComposer.jsx';

/**
 * ChannelView — /w/:workspaceId and /w/:workspaceId/channel/:channelId.
 * Without a channelId (or with a stale one like "general") we bounce to the
 * first channel so the workspace rail never needs channel knowledge.
 */
export default function ChannelView() {
  const { workspaceId, channelId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const channels = useSelector(selectChannels);
  const channelsStatus = useSelector((s) => s.channels.status);
  const loading = useSelector((s) => channelId ? !!s.messages.loadingById[channelId] : false);

  const channel = useMemo(() => channels.find((c) => c.id === channelId), [channels, channelId]);

  // Resolve implicit channel: prefer #general by name, else first channel.
  useEffect(() => {
    if (channelId && (channel || channelsStatus !== 'ready')) return;
    const fallback = channels.find((c) => c.name === 'general') || channels[0];
    if (fallback) navigate(`/w/${workspaceId}/channel/${fallback.id}`, { replace: true });
  }, [channelId, channel, channels, channelsStatus, workspaceId, navigate]);

  // Load history + join the realtime room for this channel only.
  useEffect(() => {
    if (!channelId) return;
    dispatch(fetchMessages({ conversationId: channelId }));
    dispatch(setActiveChannel(channelId));
    emit('channel:join', channelId);
    emit('message:read', { channelId, messageIds: [] });
    return () => emit('channel:leave', channelId);
  }, [channelId, dispatch]);

  if (!channelId || !channel) {
    return (
      <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
        {channelsStatus === 'idle' || loading ? 'Loading channel…' : 'No channels yet — create one from the sidebar.'}
      </div>
    );
  }

  return (
    <>
      <ConversationHeader conversation={channel} kind="channel" />
      <MessageList conversationId={channel.id} onOpenThread={(m) => navigate(`/w/${workspaceId}/channel/${channel.id}?thread=${m.id}`)} />
      <MessageComposer workspaceId={workspaceId} channelId={channel.id} />
    </>
  );
}
