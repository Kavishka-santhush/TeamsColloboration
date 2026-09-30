import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

// Global search across messages/files/channels/members, with an optional
// AI semantic mode.
export const runSearch = createAsyncThunk('search/run', ({ query, filters, semantic }) =>
  api.post('/search', { query, filters, semantic }));
export const fetchSearchHistory = createAsyncThunk('search/history', () => api.get('/search/history'));
export const saveSearch = createAsyncThunk('search/save', (payload) => api.post('/search/saved', payload));

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    query: '',
    results: { messages: [], files: [], channels: [], members: [] },
    history: [],
    saved: [],
    open: false,
    status: 'idle',
  },
  reducers: {
    setQuery(state, action) { state.query = action.payload; },
    setSearchOpen(state, action) { state.open = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(runSearch.pending, (s) => { s.status = 'loading'; })
      .addCase(runSearch.fulfilled, (s, a) => { s.status = 'ready'; s.results = a.payload?.data || s.results; })
      .addCase(fetchSearchHistory.fulfilled, (s, a) => { s.history = a.payload?.data || []; });
  },
});

export const { setQuery, setSearchOpen } = searchSlice.actions;
export default searchSlice.reducer;
