import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client.js';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid,
} from 'recharts';

/**
 * AnalyticsPage — workspace activity reports built with Recharts.
 * Deliberately NOT in Redux: this data is read once by exactly one screen,
 * so component-local state is simpler than a slice nobody else queries.
 * The `days` param re-fetches everything, keeping range logic in one place.
 */
export default function AnalyticsPage() {
  const { workspaceId } = useParams();
  const [days, setDays] = useState(30);
  const [data, setData] = useState({ overview: null, volume: [], peaks: [], contributors: [], files: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = { params: { days } };
        const [overview, volume, peaks, contributors, files] = await Promise.all([
          api.get('/analytics/overview', cfg),
          api.get('/analytics/messages/volume', cfg),
          api.get('/analytics/messages/peak-hours', cfg),
          api.get('/analytics/top-contributors', cfg),
          api.get('/analytics/files/by-type', cfg),
        ]);
        if (cancelled) return;
        setData({
          overview: overview.data?.data,
          volume: volume.data?.data || [],
          peaks: peaks.data?.data || [],
          contributors: contributors.data?.data || [],
          files: files.data?.data || [],
        });
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, days]);

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-14 shrink-0 border-b border-border flex items-center gap-3 px-4">
        <h1 className="font-semibold">Analytics</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-auto rounded border border-border bg-background px-2 py-1 text-sm">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <Link to={`/w/${workspaceId}`} className="text-sm text-muted-foreground hover:text-foreground">← Back to channels</Link>
      </header>

      {error && <div className="m-4 p-3 rounded border border-destructive/40 text-destructive text-sm">{error}</div>}

      <div className="p-4 space-y-6 max-w-5xl">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Messages', data.overview?.totalMessages],
            ['Active members', data.overview?.activeMembers],
            ['Channels', data.overview?.totalChannels],
            ['Files stored', data.overview?.totalFiles],
          ].map(([label, value]) => (
            <div key={label} className="p-4 rounded-lg border border-border bg-card">
              <div className="text-2xl font-bold">{value ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Message volume over time */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Message volume</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.volume}>
              <defs>
                <linearGradient id="msgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#msgFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Peak hours */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Peak hours (UTC)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.peaks}>
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Top contributors */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Top contributors</h2>
            <ol className="space-y-2">
              {data.contributors.slice(0, 8).map((c, i) => (
                <li key={c.id || c.userId} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right text-muted-foreground">{i + 1}.</span>
                  <span className="h-6 w-6 rounded bg-primary/10 grid place-items-center text-[10px]">{(c.name || '?')[0]}</span>
                  <span className="truncate">{c.name || c.userId}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.messageCount ?? c.count} msgs</span>
                </li>
              ))}
              {data.contributors.length === 0 && <li className="text-sm text-muted-foreground">No data yet.</li>}
            </ol>
          </section>
        </div>

        {/* File storage by type */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">File storage by type</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {data.files.map((f) => (
              <span key={f.type || f.mimeType} className="px-2 py-1 rounded bg-accent">
                {f.type || f.mimeType}: {f.count} {f.totalBytes ? `(${(f.totalBytes / 1048576).toFixed(1)} MB)` : ''}
              </span>
            ))}
            {data.files.length === 0 && <span className="text-muted-foreground">No files uploaded yet.</span>}
          </div>
        </section>
      </div>
    </div>
  );
}
