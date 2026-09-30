import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

export const fetchChannels = createAsyncThunk('channels/fetchAll', (workspaceId) => api.get(`/workspaces/${workspaceId}/channels`));
export const createChannel = createAsyncThunk('channels/create', ({ workspaceId, ...body }) => api.post(`/workspaces/${workspaceId}/channels`, body));
export const archiveChannel = createAsyncThunk('channels/archive', (id) => api.post(`/channels/${id}/archive`));
export const toggleMute = createAsyncThunk('channels/toggleMute', ({ channelId, muted }) => api.patch(`/channels/${channelId}/mute`, { muted }));

const channelSlice = createSlice({
  name: 'channels',
  initialState: {
    byId: {},
    order: [],
    activeChannelId: null,
    starred: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    setActiveChannel(state, action) {
      state.activeChannelId = action.payload;
    },
    toggleStar(state, action) {
      const id = action.payload;
      state.starred = state.starred.includes(id)
        ? state.starred.filter((c) => c !== id)
        : [...state.starred, id];
    },
    upsertChannel(state, action) {
      const ch = action.payload;
      state.byId[ch.id] = ch;
      if (!state.order.includes(ch.id)) state.order.push(ch.id);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChannels.fulfilled, (s, a) => {
        s.status = 'ready';
        const items = a.payload?.data || [];
        s.byId = Object.fromEntries(items.map((c) => [c.id, c]));
        s.order = items.map((c) => c.id);
      })
      .addCase(createChannel.fulfilled, (s, a) => {
        const ch = a.payload?.data;
        if (ch) { s.byId[ch.id] = ch; s.order.push(ch.id); }
      });
  },
  selectors: {
    selectChannels: (s) => s.order.map((id) => s.byId[id]).filter(Boolean),
    selectActiveChannel: (s) => (s.activeChannelId ? s.byId[s.activeChannelId] : null),
  },
});

export const { setActiveChannel, toggleStar, upsertChannel } = channelSlice.actions;
export const { selectChannels, selectActiveChannel } = channelSlice.selectors;
export default channelSlice.reducer;
