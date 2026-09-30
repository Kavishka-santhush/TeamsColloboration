import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

// Messages are cached per conversation (channel id or dm id). This keeps
// switching between channels instant while a fresh page loads in the background.
export const fetchMessages = createAsyncThunk('messages/fetch', ({ conversationId, before }) =>
  api.get(`/conversations/${conversationId}/messages`, { params: { before, limit: 50 } }));

export const sendMessage = createAsyncThunk('messages/send', (payload) => api.post('/messages', payload));
export const editMessage = createAsyncThunk('messages/edit', ({ id, ...body }) => api.patch(`/messages/${id}`, body));
export const deleteMessage = createAsyncThunk('messages/delete', (id) => api.delete(`/messages/${id}`));
export const toggleReaction = createAsyncThunk('messages/reaction', ({ messageId, emoji }) => api.post(`/messages/${messageId}/reactions`, { emoji }));

const messageSlice = createSlice({
  name: 'messages',
  initialState: {
    byConversation: {}, // conversationId -> [messages]
    loadingById: {},
    typing: {}, // conversationId -> { userId: name }
    error: null,
  },
  reducers: {
    // Called from the socket layer when a new message arrives in realtime.
    onNewMessage(state, action) {
      const m = action.payload;
      const key = m.channelId || m.dmConversationId;
      if (!key) return;
      const list = state.byConversation[key] || [];
      if (!list.some((x) => x.id === m.id)) list.push(m);
      state.byConversation[key] = list;
    },
    onTyping(state, action) {
      const { conversationId, userId, name, isTyping } = action.payload;
      state.typing[conversationId] = state.typing[conversationId] || {};
      if (isTyping) state.typing[conversationId][userId] = name;
      else delete state.typing[conversationId][userId];
    },
    clearConversation(state, action) {
      delete state.byConversation[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (s, a) => { s.loadingById[a.meta.arg.conversationId] = true; })
      .addCase(fetchMessages.fulfilled, (s, a) => {
        const { conversationId, before } = a.meta.arg;
        const items = a.payload?.data || [];
        s.loadingById[conversationId] = false;
        const existing = s.byConversation[conversationId] || [];
        s.byConversation[conversationId] = before ? [...items, ...existing] : items;
      })
      .addCase(sendMessage.fulfilled, (s, a) => {
        const m = a.payload?.data;
        if (!m) return;
        const key = m.channelId || m.dmConversationId;
        const list = s.byConversation[key] || [];
        if (!list.some((x) => x.id === m.id)) list.push(m);
        s.byConversation[key] = list;
      })
      .addCase(editMessage.fulfilled, (s, a) => {
        const m = a.payload?.data;
        const key = m?.channelId || m?.dmConversationId;
        const list = s.byConversation[key] || [];
        const idx = list.findIndex((x) => x.id === m.id);
        if (idx >= 0) list[idx] = m;
      })
      .addCase(deleteMessage.fulfilled, (s, a) => {
        Object.values(s.byConversation).forEach((list) => {
          const idx = list.findIndex((x) => x.id === a.meta.arg);
          if (idx >= 0) list[idx] = { ...list[idx], isDeleted: true, body: 'Message deleted' };
        });
      });
  },
  selectors: {
    selectMessagesFor: (s, conversationId) => s.byConversation[conversationId] || [],
    selectTypingFor: (s, conversationId) => Object.values(s.typing[conversationId] || {}),
  },
});

export const { onNewMessage, onTyping, clearConversation } = messageSlice.actions;
export const { selectMessagesFor, selectTypingFor } = messageSlice.selectors;
export default messageSlice.reducer;

