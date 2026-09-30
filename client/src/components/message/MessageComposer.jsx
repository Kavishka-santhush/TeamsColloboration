import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { sendMessage } from '../../store/slices/messageSlice.js';
import { emit } from '../../socket/index.js';
import api from '../../api/client.js';

/**
 * MessageComposer — the input at the bottom of a conversation. Enter sends,
 * Shift+Enter is a newline; a debounce emits typing state over the socket.
 * File attach uploads via /files then references the returned attachment ids.
 */
export default function MessageComposer({ workspaceId, channelId, dmConversationId, threadRootId }) {
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.auth.profile);
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const typingTimer = useRef(null);
  const fileRef = useRef(null);

  const conversationKey = channelId || dmConversationId;

  const onType = (e) => {
    setValue(e.target.value);
    emit('message:typing', { channelId, dmConversationId, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emit('message:typing', { channelId, dmConversationId, typing: false }), 1500);
  };

  const pickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      const res = await api.post('/files', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const created = res?.data || [];
      setAttachments((prev) => [...prev, ...created.map((c) => ({ id: c.id, name: c.originalName }))]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    const body = value.trim();
    if (!body && !attachments.length) return;
    emit('message:typing', { channelId, dmConversationId, typing: false });
    await dispatch(sendMessage({
      workspaceId,
      channelId,
      dmConversationId,
      threadRootId,
      body: body || '',
      attachments: attachments.map((a) => a.id),
    }));
    setValue('');
    setAttachments([]);
  };

  return (
    <div className="border-t border-border p-3">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span key={a.id} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-accent">
              📎 {a.name}
              <button onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} className="ml-1 text-muted-foreground">✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
        <button className="text-lg text-muted-foreground hover:text-foreground" title="Attach file" onClick={() => fileRef.current?.click()}>＋</button>
        <input ref={fileRef} type="file" multiple hidden onChange={pickFiles} />
        <textarea
          value={value}
          onChange={onType}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={1}
          placeholder={uploading ? 'Uploading…' : `Message ${channelId ? '#' : ''}`}
          className="flex-1 resize-none bg-transparent text-sm outline-none max-h-40 py-1"
        />
        <button className="text-lg text-muted-foreground hover:text-foreground" title="Emoji">😊</button>
        <button
          onClick={submit}
          disabled={(!value.trim() && !attachments.length) || uploading}
          className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
