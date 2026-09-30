import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchWorkspaces, createWorkspace } from '../store/slices/workspaceSlice.js';
import { initials } from '../lib/utils.js';

/**
 * WorkspacePicker — landing screen after auth. Lists memberships, allows
 * creating a workspace, and hands off to /w/:id (ChannelView resolves which
 * channel to open, so this page never needs to know about channels itself).
 */
export default function WorkspacePicker() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const list = useSelector((s) => s.workspace.list);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    dispatch(fetchWorkspaces());
  }, [dispatch]);

  const onCreate = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    const action = await dispatch(createWorkspace({ name: trimmed }));
    setCreating(false);
    if (createWorkspace.rejected.match(action)) {
      toast.error(action.error?.message || 'Could not create workspace');
      return;
    }
    const created = action.payload?.data;
    toast.success(`Welcome to ${created.name}`);
    navigate(`/w/${created.id}`);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-center">Choose a workspace</h1>
        <p className="text-center text-sm text-muted-foreground mt-1 mb-6">
          Workspaces keep channels, members, and billing fully separate.
        </p>

        <div className="space-y-2">
          {list.length === 0 && (
            <div className="text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6">
              You're not in any workspace yet — create one below or ask for an invite.
            </div>
          )}
          {list.map((w) => (
            <button
              key={w.id}
              onClick={() => navigate(`/w/${w.id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-sm text-left transition"
            >
              <span className="h-10 w-10 shrink-0 rounded-lg bg-primary text-primary-foreground grid place-items-center font-semibold">
                {initials(w.name)}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold truncate">{w.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {w._count?.members != null ? `${w._count.members} members · ` : ''}
                  {w.plan || 'free'}
                </span>
              </span>
              <span className="ml-auto text-muted-foreground">→</span>
            </button>
          ))}
        </div>

        <form onSubmit={onCreate} className="mt-6 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New workspace name (e.g. Acme Inc)"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-40"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
}
