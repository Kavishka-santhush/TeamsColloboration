import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

export const fetchWorkspaces = createAsyncThunk('workspace/fetchAll', () => api.get('/workspaces'));
export const createWorkspace = createAsyncThunk('workspace/create', (payload) => api.post('/workspaces', payload));
export const fetchWorkspace = createAsyncThunk('workspace/fetchOne', (id) => api.get(`/workspaces/${id}`));
export const inviteMember = createAsyncThunk('workspace/invite', ({ id, ...body }) => api.post(`/workspaces/${id}/members`, body));

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: {
    list: [],
    current: null,
    members: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    setCurrentWorkspace(state, action) {
      state.current = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkspaces.fulfilled, (s, a) => { s.list = a.payload?.data || []; })
      .addCase(createWorkspace.fulfilled, (s, a) => { if (a.payload?.data) s.list.push(a.payload.data); })
      .addCase(fetchWorkspace.fulfilled, (s, a) => {
        s.current = a.payload?.data;
        s.members = a.payload?.data?.members || [];
      });
  },
});

export const { setCurrentWorkspace } = workspaceSlice.actions;
export default workspaceSlice.reducer;
