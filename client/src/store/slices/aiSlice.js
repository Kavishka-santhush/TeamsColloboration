import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

// Central place for every OpenRouter-powered action so AI features share one
// loading/error surface in the UI.
export const smartReplies = createAsyncThunk('ai/smartReplies', (payload) => api.post('/ai/smart-replies', payload));
export const summarizeChannel = createAsyncThunk('ai/summarizeChannel', (payload) => api.post('/ai/summarize/channel', payload));
export const translateMessage = createAsyncThunk('ai/translate', ({ messageId, language }) => api.post(`/ai/translate/${messageId}`, { language }));
export const askChatbot = createAsyncThunk('ai/chatbot', (payload) => api.post('/ai/chatbot', payload));
export const improveDraft = createAsyncThunk('ai/improve', (payload) => api.post('/ai/writing-assistant', payload));
export const sentimentReport = createAsyncThunk('ai/sentiment', (workspaceId) => api.get(`/ai/sentiment/${workspaceId}`));

const aiSlice = createSlice({
  name: 'ai',
  initialState: {
    suggestions: [],
    summary: null,
    translation: {}, // messageId -> text
    chatbotMessages: [],
    sentiment: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearSuggestions(state) { state.suggestions = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(smartReplies.fulfilled, (s, a) => { s.suggestions = a.payload?.data || []; })
      .addCase(summarizeChannel.fulfilled, (s, a) => { s.summary = a.payload?.data; })
      .addCase(translateMessage.fulfilled, (s, a) => { s.translation[a.meta.arg.messageId] = a.payload?.data; })
      .addCase(askChatbot.fulfilled, (s, a) => { s.chatbotMessages.push(a.payload?.data); })
      .addCase(sentimentReport.fulfilled, (s, a) => { s.sentiment = a.payload?.data; });
  },
});

export const { clearSuggestions } = aiSlice.actions;
export default aiSlice.reducer;
