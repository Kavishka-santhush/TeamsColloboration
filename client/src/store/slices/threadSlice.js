import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

export const fetchThread = createAsyncThunk('threads/fetch', (rootMessageId) => api.get(`/threads/${rootMessageId}`));
export const replyInThread = createAsyncThunk('threads/reply', (payload) => api.post(`/threads/${payload.rootMessageId}/replies`, payload));
export const followThread = createAsyncThunk('threads/follow', (threadId) => api.post(`/threads/${threadId}/follow`));
export const summarizeThread = createAsyncThunk('threads/summarize', (threadId) => api.post(`/threads/${threadId}/summarize`));

const threadSlice = createSlice({
  name: 'threads',
  initialState: {
    activeThread: null,
    byId: {},
    summary: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    openThread(state, action) { state.activeThread = action.payload; },
    closeThread(state) { state.activeThread = null; state.summary = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchThread.fulfilled, (s, a) => {
        const t = a.payload?.data;
        if (t) { s.byId[t.id] = t; s.activeThread = t; }
      })
      .addCase(replyInThread.fulfilled, (s, a) => {
        const t = s.activeThread;
        if (t && a.payload?.data) t.replies.push(a.payload.data);
      })
      .addCase(summarizeThread.fulfilled, (s, a) => { s.summary = a.payload?.data; });
  },
});

export const { openThread, closeThread } = threadSlice.actions;
export default threadSlice.reducer;
