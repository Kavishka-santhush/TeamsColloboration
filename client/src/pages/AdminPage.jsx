import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/client.js';
import { cn, formatTime } from '../lib/utils.js';

const TABS = ['audit', 'holds', 'billing'];

/**
 * AdminPage — workspace administration (admin role enforced server-side via
 * requireAdmin; a 403 here simply renders an access notice). Kept local-state
 * only: admin data is sensitive, paginated, and never needed elsewhere.
 */
export default function AdminPage() {
  const { workspaceId } = useParams();
  const [tab, setTab] = useState('audit');
  const [denied, setDenied] = useState(false);
  const [logs, setLogs] = useState([]);
  const [holds, setHolds] = useState([]);
  const [sub, setSub] = useState(null);
  const [holdForm, setHoldForm] = useState({ reason: '', scope: 'WORKSPACE' });

  const guard = useCallback((e) => {
    if (e?.response?.status === 403) { setDenied(true); return true; }
    toast.error(e?.response?.data?.message || e.message);
    return false;
  }, []);

  useEffect(() => {
    if (tab === 'audit') api.get('/admin/audit-logs').then((r) => setLogs(r.data?.data || [])).catch(guard);
    if (tab === 'holds') api.get('/admin/legal-holds').then((r) => setHolds(r.data?.data || [])).catch(guard);
    if (tab === 'billing') api.get('/admin/subscription').then((r) => setSub(r.data?.data)).catch(guard);
  }, [tab, workspaceId, guard]);

  const createHold = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/legal-holds', holdForm);
      setHolds((p) => [res.data?.data, ...p].filter(Boolean));
      setHoldForm({ reason: '', scope: 'WORKSPACE' });
      toast.success('Legal hold placed — retention will skip covered data');
    } catch (e2) { guard(e2); }
  };

  const releaseHold = async (id) => {
    try {
      await api.delete(`/admin/legal-holds/${id}`);
      setHolds((p) => p.filter((h) => h.id !== id));
      toast.success('Legal hold released');
    } catch (e2) { guard(e2); }
  };

  const changePlan = async (tier) => {
    try {
      const res = await api.post('/admin/subscription/plan', { tier });
      setSub(res.data?.data);
      toast.success(`Plan changed to ${tier}`);
    } catch (e2) { guard(e2); }
  };

  const runRetention = async () => {
    try {
      const res = await api.post('/admin/retention/run');
      toast.success(`Retention enforced: ${res.data?.data?.deletedMessages ?? 0} messages, ${res.data?.data?.deletedFiles ?? 0} files`);
    } catch (e2) { guard(e2); }
  };

  const exportWorkspace = async () => {
    try {
      const res = await api.get('/admin/export/workspace');
      const blob = new Blob([JSON.stringify(res.data?.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `workspace-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e2) { guard(e2); }
  };

  if (denied) {
    return <div className="flex-1 grid place-items-center text-muted-foreground">You need the Admin or Owner role for this workspace.</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-14 border-b border-border flex items-center gap-4 px-4">
        <h1 className="font-semibold">Workspace admin</h1>
        <nav className="flex gap-1 ml-4">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('px-3 py-1.5 rounded text-sm capitalize', tab === t ? 'bg-accent font-semibold' : 'text-muted-foreground hover:bg-accent/50')}>
              {t === 'holds' ? 'Legal holds' : t === 'audit' ? 'Audit log' : 'Billing'}
            </button>
          ))}
        </nav>
      </header>

      <div className="p-4 max-w-4xl space-y-3">
        {tab === 'audit' && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-2">When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="py-2 text-muted-foreground whitespace-nowrap">{formatTime(l.createdAt)}</td>
                  <td>{l.actor?.displayName || l.actorId || 'system'}</td>
                  <td><code className="text-xs bg-accent px-1 rounded">{l.action}</code></td>
                  <td className="text-muted-foreground truncate max-w-[220px]">{l.entityType} {l.entityId || ''}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No audit entries yet.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'holds' && (
          <>
            <form onSubmit={createHold} className="flex gap-2 items-center p-3 rounded-lg border border-border">
              <select value={holdForm.scope} onChange={(e) => setHoldForm({ ...holdForm, scope: e.target.value })} className="rounded border border-border bg-background px-2 py-1.5 text-sm">
                <option value="WORKSPACE">Whole workspace</option>
                <option value="CHANNEL">Channel</option>
                <option value="USER">Member</option>
              </select>
              <input value={holdForm.reason} onChange={(e) => setHoldForm({ ...holdForm, reason: e.target.value })} placeholder="Reason (shown in audit log)" required className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm" />
              <button className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm">Place hold</button>
            </form>
            {holds.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border border-border text-sm">
                <span className="font-medium">{h.scope}</span>
                <span className="text-muted-foreground flex-1">{h.reason}</span>
                <span className="text-xs text-muted-foreground">{h.isActive === false ? 'released' : 'active'}</span>
                <button onClick={() => releaseHold(h.id)} className="text-destructive text-xs hover:underline">Release</button>
              </div>
            ))}
            <button onClick={runRetention} className="text-sm px-3 py-1.5 rounded border border-border hover:bg-accent">Run retention job now</button>
          </>
        )}

        {tab === 'billing' && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border">
              <div className="text-sm text-muted-foreground">Current plan</div>
              <div className="text-xl font-bold capitalize">{sub?.plan?.tier || sub?.tier || 'free'}</div>
              {sub?.currentPeriodEnd && <div className="text-xs text-muted-foreground mt-1">Renews {new Date(sub.currentPeriodEnd).toDateString()}</div>}
            </div>
            <div className="flex gap-2">
              {['free', 'business', 'enterprise'].map((tier) => (
                <button key={tier} onClick={() => changePlan(tier)} className="px-3 py-1.5 rounded border border-border text-sm capitalize hover:bg-accent">
                  Switch to {tier}
                </button>
              ))}
            </div>
            <button onClick={exportWorkspace} className="text-sm text-primary hover:underline">Export all workspace data (GDPR)</button>
          </div>
        )}
      </div>
    </div>
  );
}
