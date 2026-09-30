import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { runSearch, fetchSearchHistory, setQuery } from '../store/slices/searchSlice.js';
import { cn, formatTime } from '../lib/utils.js';

const TABS = ['messages', 'files', 'channels', 'members'];

/**
 * SearchPage — global workspace search (pg_trgm + tsvector on the server).
 * A "semantic" toggle asks the AI service to embed/expand the query instead
 * of relying on keyword matching alone.
 */
export default function SearchPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { query, results, status } = useSelector((s) => s.search);
  const [tab, setTab] = useState('messages');
  const [semantic, setSemantic] = useState(false);

  useEffect(() => {
    dispatch(fetchSearchHistory());
  }, [dispatch]);

  const submit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    dispatch(runSearch({ query: query.trim(), filters: { workspaceId }, semantic }));
  };

  const openResult = (r) => {
    const conversation = r.channelId || r.dmConversationId;
    if (r.channel?.id) navigate(`/w/${workspaceId}/channel/${r.channel.id}`);
    else if (conversation) navigate(`/w/${workspaceId}/channel/${conversation}`);
  };

  const items = results?.[tab] || [];

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-14 shrink-0 border-b border-border flex items-center gap-3 px-4">
        <h1 className="font-semibold">Search</h1>
        <form onSubmit={submit} className="flex-1 max-w-xl flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => dispatch(setQuery(e.target.value))}
            placeholder="Search messages, files, people…"
            className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <label className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
            <input type="checkbox" checked={semantic} onChange={(e) => setSemantic(e.target.checked)} />
            AI semantic
          </label>
          <button className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm">{status === 'loading' ? '…' : 'Search'}</button>
        </form>
      </header>

      <div className="px-4 pt-3 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-2 text-sm border-b-2 -mb-px capitalize',
              tab === t ? 'border-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t} ({results?.[t]?.length ?? 0})
          </button>
        ))}
      </div>

      <div className="p-4 space-y-2 max-w-3xl">
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground">{query ? 'No results yet — run a search above.' : 'Type a query to search this workspace.'}</div>
        )}
        {tab === 'messages' && items.map((m) => (
          <button key={m.id} onClick={() => openResult(m)} className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/40">
            <div className="text-sm flex items-center gap-2">
              <span className="font-semibold">{m.author?.displayName || m.author?.username || 'Unknown'}</span>
              <span className="text-xs text-muted-foreground">{m.channel?.name ? `#${m.channel.name}` : ''} · {formatTime(m.sentAt)}</span>
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2">{m.body}</div>
          </button>
        ))}
        {tab === 'files' && items.map((f) => (
          <div key={f.id} className="p-3 rounded-lg border border-border flex items-center gap-2 text-sm">
            📄 <span className="font-medium">{f.originalName || f.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{f.uploader?.displayName || ''}</span>
          </div>
        ))}
        {tab === 'channels' && items.map((c) => (
          <button key={c.id} onClick={() => navigate(`/w/${workspaceId}/channel/${c.id}`)} className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/40 text-sm">
            # {c.name} <span className="text-muted-foreground">· {c.isPrivate ? 'private' : 'public'}</span>
          </button>
        ))}
        {tab === 'members' && items.map((u) => (
          <div key={u.id} className="p-3 rounded-lg border border-border text-sm flex items-center gap-2">
            <span className="h-7 w-7 rounded bg-primary/10 grid place-items-center text-xs">{(u.displayName || u.username || '?')[0]}</span>
            {u.displayName || u.username} <span className="text-muted-foreground text-xs">{u.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
