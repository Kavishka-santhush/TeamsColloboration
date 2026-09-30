import axios from 'axios';

// Single axios instance for all REST calls. The Clerk session token is attached
// per-request via the auth interceptor registered from the auth slice, keeping
// this module free of Clerk imports.
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  headers: { 'Content-Type': 'application/json' },
});

let tokenProvider = async () => null;

/** Called once from the app bootstrap to wire Clerk token retrieval. */
export function setAuthTokenProvider(fn) {
  tokenProvider = fn;
}

// The backend resolves the caller's workspace membership from an `x-workspace-id`
// header. We inject the active workspace id (persisted when the user opens a
// workspace) on every request so any endpoint can authorize against it.
let workspaceIdProvider = () => null;
export function setWorkspaceIdProvider(fn) {
  workspaceIdProvider = fn;
}

api.interceptors.request.use(async (config) => {
  const token = await tokenProvider();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const workspaceId = workspaceIdProvider();
  if (workspaceId) config.headers['x-workspace-id'] = workspaceId;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const payload = err.response?.data || { success: false, message: err.message };
    return Promise.reject(payload);
  },
);

export default api;
