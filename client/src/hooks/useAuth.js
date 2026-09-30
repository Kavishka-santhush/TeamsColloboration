import { useEffect } from 'react';
import { useUser, useAuth as useClerkAuth, getToken } from '@clerk/clerk-react';
import { useDispatch, useSelector } from 'react-redux';
import { setClerkUser, syncClerkUser } from '../store/slices/authSlice.js';
import { setAuthTokenProvider, setWorkspaceIdProvider } from '../api/client.js';
import { connectSocket, disconnectSocket } from '../socket/index.js';

// Bridges Clerk -> our app: keeps the Redux profile in sync with the Clerk
// user, wires the axios token provider, and manages the socket connection
// lifecycle on sign-in / sign-out.
export function useAuth() {
  const dispatch = useDispatch();
  const { isLoaded, isSignedIn, user } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const profile = useSelector((s) => s.auth.profile);

  // Attach Clerk token getter to the axios client once.
  useEffect(() => {
    setAuthTokenProvider(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    // The active workspace is persisted on navigation; inject it as a header so
    // the backend can resolve membership/role for every request.
    setWorkspaceIdProvider(() => localStorage.getItem('activeWorkspaceId'));
  }, []);

  useEffect(() => {
    if (isSignedIn && clerkUser) {
      dispatch(setClerkUser(clerkUser));
      dispatch(syncClerkUser());
    }
  }, [isSignedIn, clerkUser, dispatch]);

  // Open / close the realtime socket with the session.
  useEffect(() => {
    let cancelled = false;
    if (isSignedIn) {
      getToken().then((token) => {
        if (!cancelled) connectSocket(token);
      });
    } else {
      disconnectSocket();
    }
    return () => { cancelled = true; };
  }, [isSignedIn]);

  return { isSignedIn, loading: !isLoaded, user, profile };
}
