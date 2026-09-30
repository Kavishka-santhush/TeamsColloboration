import React, { useEffect } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useSocket } from '../../hooks/useSocket.js';
import { fetchChannels } from '../../store/slices/channelSlice.js';
import { fetchDms } from '../../store/slices/dmSlice.js';
import WorkspaceRail from './WorkspaceRail.jsx';
import Sidebar from './Sidebar.jsx';

/**
 * AppShell is the persistent frame for the signed-in app: a workspace rail on
 * the far left, a channel/DM sidebar next to it, and the routed content in the
 * main column. It also owns the socket connection and loads the workspace data
 * whenever the active workspace changes.
 */
export default function AppShell() {
  const dispatch = useDispatch();
  const location = useLocation();
  // The active workspace id is the `:workspaceId` segment of any /w/:id route.
  const match = useMatch('/w/:workspaceId/*');
  const workspaceId = match?.params.workspaceId || null;

  // Persist the active workspace so the axios interceptor can attach it.
  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem('activeWorkspaceId', workspaceId);
      dispatch(fetchChannels(workspaceId));
      dispatch(fetchDms(workspaceId));
    } else if (location.pathname.startsWith('/workspaces')) {
      localStorage.removeItem('activeWorkspaceId');
    }
  }, [workspaceId, dispatch, location.pathname]);

  // Wire realtime events into Redux for the lifetime of the shell.
  useSocket(workspaceId);

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      <WorkspaceRail />
      {workspaceId && <Sidebar workspaceId={workspaceId} />}
      <main className="flex-1 flex flex-col min-w-0 border-l border-border">
        <Outlet />
      </main>
    </div>
  );
}
