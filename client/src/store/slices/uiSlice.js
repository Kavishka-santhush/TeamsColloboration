import { createSlice } from '@reduxjs/toolkit';

// Ephemeral layout/UI state: which panels are open, active theme, and modal
// visibility. Kept out of the domain slices so layout changes never touch data.
const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: storedTheme || 'system',
    sidebarCollapsed: false,
    rightPanel: null, // 'thread' | 'channel-info' | 'search' | null
    activeModal: null, // 'new-channel' | 'invites' | 'settings' | ...
    commandPaletteOpen: false,
  },
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload;
      if (typeof localStorage !== 'undefined') localStorage.setItem('theme', action.payload);
    },
    toggleSidebar(state) { state.sidebarCollapsed = !state.sidebarCollapsed; },
    openRightPanel(state, action) { state.rightPanel = action.payload; },
    closeRightPanel(state) { state.rightPanel = null; },
    openModal(state, action) { state.activeModal = action.payload; },
    closeModal(state) { state.activeModal = null; },
    toggleCommandPalette(state, action) { state.commandPaletteOpen = action.payload ?? !state.commandPaletteOpen; },
  },
});

export const { setTheme, toggleSidebar, openRightPanel, closeRightPanel, openModal, closeModal, toggleCommandPalette } = uiSlice.actions;
export default uiSlice.reducer;
