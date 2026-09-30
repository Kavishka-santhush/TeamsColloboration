import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { cn, initials, formatTime } from '../../lib/utils.js';
import { toggleReaction, deleteMessage, editMessage } from '../../store/slices/messageSlice.js';
import { emit } from '../../socket/index.js';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🙏'];

/**
 * MessageItem — a single message row. Consecutive messages from the same author
 * collapse the avatar header (grouping) via the `grouped` prop. Handles inline
 * edit, delete, reactions, and opening the thread for a message.
 */
export default function MessageItem({ message, grouped, onOpenThread }) {
  const dispatch = useDispatch();
  const currentUserId = useSelector((s) => s.auth.profile?.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const isMine = message.author?.id === currentUserId;

  const saveEdit = async () => {
    if (draft.trim() && draft !== message.body) await dispatch(editMessage({ id: message.id, body: draft }));
    setEditing(false);
  };

  return (
    <div className={cn('group flex gap-3 px-4 hover:bg-accent/40', grouped ? 'py-0.5' : 'py-1.5 mt-2')}>
      <div className="w-9 shrink-0">
        {!grouped && (
          <div className="h-9 w-9 rounded bg-primary/10 grid place-items-center text-sm font-semibold">
            {initials(message.author?.displayName || '?')}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm">{message.author?.displayName || 'Unknown'}</span>
            <span className="text-[11px] text-muted-foreground">{formatTime(message.sentAt || message.createdAt)}</span>
          </div>
        )}

        {message.isDeleted ? (
          <div className="text-sm italic text-muted-foreground">Message deleted</div>
        ) : editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditing(false); }}
              className="w-full text-sm border rounded p-2 bg-background"
              rows={2}
            />
            <div className="text-[11px] text-muted-foreground mt-1">Enter to save · Esc to cancel</div>
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">
            {renderBody(message.body)}
            {message.isEdited && <span className="text-[11px] text-muted-foreground ml-1">(edited)</span>}
          </div>
        )}

        {/* Attachments */}
        {message.attachments?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <a key={a.id} href={a.path} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border border-border hover:bg-accent truncate max-w-[240px]">
                📎 {a.originalName}
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => dispatch(toggleReaction({ messageId: message.id, emoji: r.emoji }))}
                className={cn('text-xs px-2 py-0.5 rounded-full border', r.users?.includes(currentUserId) ? 'bg-primary/10 border-primary' : 'border-border hover:bg-accent')}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        {/* Thread indicator */}
        {message.threadReplyCount > 0 && (
          <button onClick={() => onOpenThread?.(message)} className="mt-1 text-xs text-blue-500 hover:underline">
            💬 {message.threadReplyCount} replies
          </button>
        )}
      </div>

      {/* Hover toolbar */}
      {!editing && (
        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 self-start rounded border border-border bg-background shadow-sm">
          {QUICK_EMOJIS.map((e) => (
            <button key={e} className="px-1.5 py-1 text-sm hover:bg-accent" onClick={() => dispatch(toggleReaction({ messageId: message.id, emoji: e }))}>
              {e}
            </button>
          ))}
          <button className="px-1.5 py-1 text-sm hover:bg-accent" title="Reply in thread" onClick={() => onOpenThread?.(message)}>↩</button>
          {isMine && (
            <>
              <button className="px-1.5 py-1 text-sm hover:bg-accent" title="Edit" onClick={() => { setDraft(message.body); setEditing(true); }}>✎</button>
              <button className="px-1.5 py-1 text-sm hover:bg-accent" title="Delete" onClick={() => dispatch(deleteMessage(message.id))}>🗑</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Lightweight inline rendering: links + @mentions + #channels get highlighted. */
function renderBody(body = '') {
  const parts = body.split(/(\s+)/);
  return parts.map((tok, i) => {
    if (/^@[\w.-]+$/.test(tok)) return <span key={i} className="text-blue-600 font-medium">{tok}</span>;
    if (/^#[\w-]+$/.test(tok)) return <span key={i} className="text-purple-600 font-medium">{tok}</span>;
    if (/^https?:\/\//.test(tok)) return <a key={i} href={tok} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{tok}</a>;
    return <React.Fragment key={i}>{tok}</React.Fragment>;
  });
}
