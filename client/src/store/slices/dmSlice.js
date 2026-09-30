import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

export const fetchDms = createAsyncThunk('dms/fetchAll', (workspaceId) => api.get(`/workspaces/${workspaceId}/dms`));
export const startDm = createAsyncThunk('dms/start', ({ workspaceId, userIds }) => api.post('/dms', { workspaceId, userIds }));
export const convertDmToChannel = createAsyncThunk('dms/convert', ({ dmId, workspaceId }) => api.post(`/dms/${dmId}/convert`, { workspaceId }));
export const blockUser = createAsyncThunk('dms/block', (userId) => api.post(`/dms/block/${userId}`));

const dmSlice = createSlice({
  name: 'dms',
  initialState: {
    conversations: [],
    activeDmId: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    setActiveDm(state, action) { state.activeDmId = action.payload; },
    upsertDm(state, action) {
      const dm = action.payload;
      const idx = state.conversations.findIndex((d) => d.id === dm.id);
      if (idx >= 0) state.conversations[idx] = dm;
      else state.conversations.unshift(dm);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDms.fulfilled, (s, a) => { s.status = 'ready'; s.conversations = a.payload?.data || []; })
      .addCase(startDm.fulfilled, (s, a) => { if (a.payload?.data) s.conversations.unshift(a.payload.data); });
  },
});

export const { setActiveDm, upsertDm } = dmSlice.actions;
export default dmSlice.reducer;
