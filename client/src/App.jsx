import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import AppShell from './components/layout/AppShell.jsx';

// Code-split pages: only the workspace app is auth-gated; public routes render
// the auth screens directly.
const WorkspacePicker = lazy(() => import('./pages/WorkspacePicker.jsx'));
const ChannelView = lazy(() => import('./pages/ChannelView.jsx'));
const DmView = lazy(() => import('./pages/DmView.jsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const SignIn = lazy(() => import('./pages/SignIn.jsx'));

function Loader() {
  return (
    <div className="h-screen w-screen grid place-items-center text-muted-foreground">
      Loading…
    </div>
  );
}

export default function App() {
  const { isSignedIn, loading } = useAuth();

  if (loading) return <Loader />;

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={isSignedIn ? <AppShell /> : <Navigate to="/sign-in" replace />}>
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          <Route path="/workspaces" element={<WorkspacePicker />} />
          <Route path="/w/:workspaceId" element={<ChannelView />} />
          <Route path="/w/:workspaceId/channel/:channelId" element={<ChannelView />} />
          <Route path="/w/:workspaceId/dm/:dmId" element={<DmView />} />
          <Route path="/w/:workspaceId/search" element={<SearchPage />} />
          <Route path="/w/:workspaceId/analytics" element={<AnalyticsPage />} />
          <Route path="/w/:workspaceId/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        {/* Public route: signed-out users land here (no redirect loop). */}
        <Route path="/sign-in" element={isSignedIn ? <Navigate to="/workspaces" replace /> : <SignIn />} />
        <Route path="*" element={<Navigate to={isSignedIn ? '/workspaces' : '/sign-in'} replace />} />
      </Routes>
    </Suspense>
  );
}
