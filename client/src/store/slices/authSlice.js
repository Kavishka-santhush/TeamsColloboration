import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

// authSlice mirrors the *backend* view of the user (profile synced from Clerk).
// Clerk owns the login UI/token; we sync the profile into our DB and store the
// returned profile here.
export const syncClerkUser = createAsyncThunk('auth/syncClerkUser', async (_, { getState }) => {
  return api.post('/auth/sync', { clientState: getState().auth.clerkUser || {} });
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (patch) => {
  return api.patch('/auth/profile', patch);
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    clerkUser: null, // raw object from useUser()
    profile: null,   // our DB user record
    status: 'idle',
    error: null,
  },
  reducers: {
    setClerkUser(state, action) {
      state.clerkUser = action.payload;
    },
    setProfile(state, action) {
      state.profile = action.payload;
    },
    logout(state) {
      state.clerkUser = null;
      state.profile = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncClerkUser.pending, (s) => { s.status = 'loading'; })
      .addCase(syncClerkUser.fulfilled, (s, a) => { s.status = 'ready'; s.profile = a.payload?.data; })
      .addCase(syncClerkUser.rejected, (s, a) => { s.status = 'error'; s.error = a.error.message; })
      .addCase(updateProfile.fulfilled, (s, a) => { s.profile = a.payload?.data; });
  },
});

export const { setClerkUser, setProfile, logout } = authSlice.actions;
export default authSlice.reducer;
