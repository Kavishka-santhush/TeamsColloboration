import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client.js';

export const fetchNotifications = createAsyncThunk('notifications/fetchAll', () => api.get('/notifications'));
export const markRead = createAsyncThunk('notifications/markRead', (id) => api.post(`/notifications/${id}/read`));
export const markAllRead = createAsyncThunk('notifications/markAllRead', (workspaceId) => api.post('/notifications/read-all', { workspaceId }));

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
    status: 'idle',
  },
  reducers: {
    // Pushed from the socket when a new notification is created server-side.
    onNotification(state, action) {
      state.items.unshift(action.payload);
      if (!action.payload.isRead) state.unreadCount += 1;
    },
    clearNotifications(state) { state.items = []; state.unreadCount = 0; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (s, a) => {
        s.status = 'ready';
        s.items = a.payload?.data || [];
        s.unreadCount = s.items.filter((n) => !n.isRead).length;
      })
      .addCase(markRead.fulfilled, (s, a) => {
        const n = s.items.find((x) => x.id === a.meta.arg);
        if (n && !n.isRead) { n.isRead = true; s.unreadCount -= 1; }
      })
      .addCase(markAllRead.fulfilled, (s) => {
        s.items.forEach((n) => { n.isRead = true; });
        s.unreadCount = 0;
      });
  },
});

export const { onNotification, clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
