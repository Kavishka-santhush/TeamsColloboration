import React from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectChannels, setActiveChannel, createChannel } from '../../store/slices/channelSlice.js';
import { startDm } from '../../store/slices/dmSlice.js';
import { fetchWorkspace } from '../../store/slices/workspaceSlice.js';
import { openModal } from '../../store/slices/uiSlice.js';
import { cn, initials } from '../../lib/utils.js';

function Section({ title, action, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-3 py-1 text-xs font-semibold uppercase text-gray-400">
        <span>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Sidebar({ workspaceId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const channels = useSelector(selectChannels);
  const dms = useSelector((s) => s.dms.conversations);
  const workspace = useSelector((s) => s.workspace.current);
  const chMatch = useMatch('/w/:workspaceId/channel/:channelId');
  const activeChannelId = chMatch?.params.channelId;

  React.useEffect(() => {
    dispatch(fetchWorkspace(workspaceId));
  }, [dispatch, workspaceId]);

  const publicChannels = channels.filter((c) => c.type !== 'PRIVATE');
  const privateChannels = channels.filter((c) => c.type === 'PRIVATE');

  const onNewChannel = async () => {
    const name = window.prompt('New channel name');
    if (name) await dispatch(createChannel({ workspaceId, name }));
  };

  const linkClass = (isActive) =>
    cn('flex items-center gap-2 px-3 py-1.5 rounded-md mx-2 text-sm hover:bg-white/10', isActive ? 'bg-white/15 text-white font-medium' : 'text-gray-300');

  return (
    <aside className="w-60 shrink-0 bg-[#2c2f33] text-gray-200 flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-white/10">
        <div className="font-bold truncate">{workspace?.name || 'Workspace'}</div>
      </header>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2 mb-3">
          <NavLink to={`/w/${workspaceId}/search`} className={({ isActive }) => linkClass(isActive)}>
            <span>🔍</span> Search
          </NavLink>
          <NavLink to={`/w/${workspaceId}/analytics`} className={({ isActive }) => linkClass(isActive)}>
            <span>📊</span> Analytics
          </NavLink>
          <NavLink to={`/w/${workspaceId}/admin`} className={({ isActive }) => linkClass(isActive)}>
            <span>🛡</span> Admin
          </NavLink>
        </div>

        <Section
          title="Channels"
          action={<button onClick={onNewChannel} className="text-gray-400 hover:text-white">＋</button>}
        >
          {publicChannels.map((c) => (
            <NavLink key={c.id} to={`/w/${workspaceId}/channel/${c.id}`} className={() => linkClass(activeChannelId === c.id)}>
              <span className="opacity-60">#</span> {c.name}
            </NavLink>
          ))}
        </Section>

        <Section title="Private">
          {privateChannels.map((c) => (
            <NavLink key={c.id} to={`/w/${workspaceId}/channel/${c.id}`} className={() => linkClass(activeChannelId === c.id)}>
              <span className="opacity-60">🔒</span> {c.name}
            </NavLink>
          ))}
        </Section>

        <Section
          title="Direct messages"
          action={<button onClick={() => dispatch(openModal('new-dm'))} className="text-gray-400 hover:text-white">＋</button>}
        >
          {dms.map((dm) => {
            const other = dm.participants?.find((p) => p.user.id !== (dm.lastMessage?.author?.id)) || dm.participants?.[0];
            return (
              <NavLink key={dm.id} to={`/w/${workspaceId}/dm/${dm.id}`} className={({ isActive }) => linkClass(isActive)}>
                <span className="h-4 w-4 rounded bg-white/10 grid place-items-center text-[10px]">{initials(other?.user?.displayName || '?')}</span>
                <span className="truncate">{other?.user?.displayName || 'Direct message'}</span>
              </NavLink>
            );
          })}
        </Section>
      </div>
    </aside>
  );
}
