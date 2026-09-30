import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

// WebRTC signalling + call lifecycle. Peers are negotiated over the socket;
// this slice tracks the active call UI state.
export const startCall = createAsyncThunk('calls/start', (payload) => api.post('/calls', payload));
export const endCall = createAsyncThunk('calls/end', (callId) => api.post(`/calls/${callId}/end`));
export const fetchCallHistory = createAsyncThunk('calls/history', (workspaceId) => api.get(`/workspaces/${workspaceId}/calls`));

const callSlice = createSlice({
  name: 'calls',
  initialState: {
    active: null, // { id, type, participants, isMuted, isSharing, ... }
    history: [],
    status: 'idle',
  },
  reducers: {
    setMuted(state, action) { if (state.active) state.active.isMuted = action.payload; },
    setSharing(state, action) { if (state.active) state.active.isSharing = action.payload; },
    addParticipant(state, action) { if (state.active) state.active.participants.push(action.payload); },
    removeParticipant(state, action) {
      if (state.active) state.active.participants = state.active.participants.filter((p) => p.userId !== action.payload);
    },
    setPeerStates(state, action) { if (state.active) state.active.peers = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startCall.fulfilled, (s, a) => { if (a.payload?.data) s.active = { ...a.payload.data, isMuted: false, isSharing: false, peers: {} }; })
      .addCase(endCall.fulfilled, (s) => { s.active = null; })
      .addCase(fetchCallHistory.fulfilled, (s, a) => { s.history = a.payload?.data || []; });
  },
});

export const { setMuted, setSharing, addParticipant, removeParticipant, setPeerStates } = callSlice.actions;
export default callSlice.reducer;
