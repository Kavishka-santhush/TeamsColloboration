import React, { useEffect } from 'react';
import { useNavigate, useMatch } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWorkspaces } from '../../store/slices/workspaceSlice.js';
import { openModal } from '../../store/slices/uiSlice.js';
import { initials, cn } from '../../lib/utils.js';

/**
 * WorkspaceRail — the slim far-left column of workspace avatars (like Slack's
 * team switcher). Clicking a workspace navigates into it; a "+" opens create.
 */
export default function WorkspaceRail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const list = useSelector((s) => s.workspace.list);
  const match = useMatch('/w/:workspaceId/*');
  const activeId = match?.params.workspaceId;

  useEffect(() => {
    if (!list.length) dispatch(fetchWorkspaces());
  }, [dispatch, list.length]);

  return (
    <nav className="w-[68px] shrink-0 bg-[#1a1d21] text-gray-300 flex flex-col items-center py-3 gap-2">
      {list.map((w) => (
        <button
          key={w.id}
          onClick={() => navigate(`/w/${w.id}`)}
          title={w.name}
          className={cn(
            'h-10 w-10 rounded-lg grid place-items-center font-semibold text-sm transition',
            activeId === w.id ? 'bg-white/20 text-white ring-2 ring-white/40' : 'bg-white/5 hover:bg-white/10',
          )}
        >
          {initials(w.name)}
        </button>
      ))}
      <button
        onClick={() => navigate('/workspaces')}
        className="h-10 w-10 rounded-lg grid place-items-center bg-white/5 hover:bg-white/10 text-lg"
        title="All workspaces"
      >
        +
      </button>
      <div className="mt-auto flex flex-col gap-2">
        <button onClick={() => navigate('/settings')} title="Preferences" className="h-9 w-9 rounded-md grid place-items-center bg-white/5 hover:bg-white/10">
          ⚙
        </button>
        <button onClick={() => dispatch(openModal('invites'))} title="Invites" className="h-9 w-9 rounded-md grid place-items-center bg-white/5 hover:bg-white/10">
          ✉
        </button>
      </div>
    </nav>
  );
}
