import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';
import { getSocket } from '../../socket/index.js';

export const setPresence = createAsyncThunk('presence/setOwn', async (status) => {
  const res = await api.post('/presence/status', { status });
  getSocket()?.emit('presence:update', { status });
  return res?.data;
});

const presenceSlice = createSlice({
  name: 'presence',
  initialState: {
    byUserId: {}, // userId -> { presence, lastActiveAt, statusMessage, statusEmoji }
    own: 'OFFLINE',
  },
  reducers: {
    // socket 'presence:update' pushes these transitions in realtime.
    onPresenceUpdate(state, action) {
      const { userId, ...rest } = action.payload;
      state.byUserId[userId] = { ...(state.byUserId[userId] || {}), ...rest };
    },
    setPresenceList(state, action) {
      action.payload.forEach((p) => { state.byUserId[p.userId] = p; });
    },
  },
  extraReducers: (builder) => {
    builder.addCase(setPresence.fulfilled, (s, a) => { s.own = a.payload?.status || s.own; });
  },
});

export const { onPresenceUpdate, setPresenceList } = presenceSlice.actions;
export default presenceSlice.reducer;
