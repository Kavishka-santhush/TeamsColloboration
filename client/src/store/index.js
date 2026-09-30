import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import workspaceReducer from './slices/workspaceSlice.js';
import channelReducer from './slices/channelSlice.js';
import messageReducer from './slices/messageSlice.js';
import threadReducer from './slices/threadSlice.js';
import dmReducer from './slices/dmSlice.js';
import notificationReducer from './slices/notificationSlice.js';
import presenceReducer from './slices/presenceSlice.js';
import callReducer from './slices/callSlice.js';
import searchReducer from './slices/searchSlice.js';
import aiReducer from './slices/aiSlice.js';
import uiReducer from './slices/uiSlice.js';

// Central Redux Toolkit store. One slice per domain keeps state localised and
// makes it obvious where each piece of UI data lives.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    workspace: workspaceReducer,
    channels: channelReducer,
    messages: messageReducer,
    threads: threadReducer,
    dms: dmReducer,
    notifications: notificationReducer,
    presence: presenceReducer,
    calls: callReducer,
    search: searchReducer,
    ai: aiReducer,
    ui: uiReducer,
  },
  middleware: (getDefault) => getDefault({ serializableCheck: false }),
});
