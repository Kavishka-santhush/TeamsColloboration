import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { cn, initials } from '../../lib/utils.js';
import { toggleMute } from '../../store/slices/channelSlice.js';
import { openRightPanel } from '../../store/slices/uiSlice.js';
import { emit } from '../../socket/index.js';

/**
 * ConversationHeader — the sticky top bar of a channel/DM: title, purpose,
 * member count, and quick actions (info panel, mute, call). Reused by both
 * ChannelView and DmView via props so the two pages stay small.
 */
export default function ConversationHeader({ conversation, kind = 'channel', onStartCall }) {
  const dispatch = useDispatch();
  const presence = useSelector((s) => s.presence?.byUser || {});
  const name = conversation?.name || conversation?.displayName || 'Conversation';
  const purpose = conversation?.purpose || conversation?.topic;
  const memberCount = conversation?.members?.length || conversation?.participants?.length;

  return (
    <header className="h-14 shrink-0 border-b border-border flex items-center gap-3 px-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1 font-semibold truncate">
          {kind === 'channel' && <span className="text-muted-foreground">#</span>}
          {kind === 'dm' && <span className="h-6 w-6 rounded bg-primary/10 grid place-items-center text-xs">{initials(name)}</span>}
          <span className="truncate">{name}</span>
        </div>
        {purpose && <div className="text-xs text-muted-foreground truncate">{purpose}</div>}
      </div>

      <div className="ml-auto flex items-center gap-1 text-sm">
        {memberCount != null && <span className="mr-2 text-muted-foreground">{memberCount} members</span>}
        <button
          className="px-2 py-1 rounded hover:bg-accent"
          title="Start a call"
          onClick={() => {
            if (onStartCall) onStartCall();
            else emit('call:peer-joined', { callId: conversation?.id });
          }}
        >
          📞
        </button>
        {kind === 'channel' && (
          <button className="px-2 py-1 rounded hover:bg-accent" title="Toggle mute" onClick={() => dispatch(toggleMute({ channelId: conversation.id, muted: true }))}>
            🔕
          </button>
        )}
        <button className="px-2 py-1 rounded hover:bg-accent" title="Details" onClick={() => dispatch(openRightPanel('channel-info'))}>
          ⓘ
        </button>
      </div>
    </header>
  );
}
