import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectMessagesFor, selectTypingFor } from '../../store/slices/messageSlice.js';
import { formatDayLabel } from '../../lib/utils.js';
import MessageItem from './MessageItem.jsx';

/**
 * MessageList — renders cached messages for a conversation, inserting a day
 * divider when the date changes and grouping consecutive same-author messages.
 * Auto-scrolls to the bottom on new messages unless the user scrolled up.
 */
export default function MessageList({ conversationId, onOpenThread }) {
  const messages = useSelector((s) => selectMessagesFor(s, conversationId));
  const typing = useSelector((s) => (conversationId ? selectTypingFor(s, conversationId) : []));
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  let lastDay = null;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto py-2">
      {messages.length === 0 && (
        <div className="h-full grid place-items-center text-muted-foreground text-sm">No messages yet. Say hello 👋</div>
      )}
      {messages.map((m, i) => {
        const day = formatDayLabel(m.sentAt || m.createdAt);
        const showDivider = day !== lastDay;
        lastDay = day;
        const prev = messages[i - 1];
        const grouped = prev && prev.author?.id === m.author?.id && !showDivider && (new Date(m.sentAt) - new Date(prev.sentAt)) < 5 * 60 * 1000;
        return (
          <React.Fragment key={m.id}>
            {showDivider && (
              <div className="relative py-2 px-4">
                <div className="border-t border-border" />
                <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-background text-[11px] text-muted-foreground px-2 rounded-full border border-border">{day}</span>
              </div>
            )}
            <MessageItem message={m} grouped={grouped} onOpenThread={onOpenThread} />
          </React.Fragment>
        );
      })}
      {typing.length > 0 && (
        <div className="px-4 py-1 text-xs text-muted-foreground italic">
          {typing.slice(0, 3).map((t) => t.name || t).join(', ')} {typing.length === 1 ? 'is' : 'are'} typing…
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
