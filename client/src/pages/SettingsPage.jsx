import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { updateProfile } from '../store/slices/authSlice.js';
import { setTheme } from '../store/slices/uiSlice.js';
import { emit } from '../socket/index.js';
import api from '../api/client.js';
import { cn } from '../lib/utils.js';

const PRESENCE_OPTIONS = ['ONLINE', 'AWAY', 'DND'];

/**
 * SettingsPage — user-level preferences (not workspace admin). Three groups:
 * profile fields synced to our DB, theme kept in Redux+localStorage, and
 * notification/mute prefs persisted per user via /notification-preferences.
 * Presence is pushed over the socket so it broadcasts instantly.
 */
export default function SettingsPage() {
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.auth.profile);
  const theme = useSelector((s) => s.ui.theme);
  const [form, setForm] = useState({ displayName: '', title: '', pronouns: '', bio: '', statusMessage: '', timezone: '' });
  const [prefs, setPrefs] = useState({ emailDigest: 'NONE', sounds: true, threadReplies: true, mentionsOnly: false });
  const [saving, setSaving] = useState(false);

  // Hydrate the form once the synced profile arrives (and again after save).
  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.displayName || '',
      title: profile.title || '',
      pronouns: profile.pronouns || '',
      bio: profile.bio || '',
      statusMessage: profile.statusMessage || '',
      timezone: profile.timezone || '',
    });
  }, [profile]);

  useEffect(() => {
    api.get('/notification-preferences').then((r) => {
      const p = r.data?.data;
      if (p) setPrefs((prev) => ({ ...prev, ...p, emailDigest: p.emailDigest || prev.emailDigest }));
    }).catch(() => {/* prefs are optional; defaults are fine */});
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    const action = await dispatch(updateProfile(form));
    setSaving(false);
    if (updateProfile.rejected.match(action)) toast.error('Could not save profile');
    else toast.success('Profile saved');
  };

  const savePrefs = async () => {
    try {
      await api.patch('/notification-preferences', prefs);
      toast.success('Notification preferences saved');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not save preferences');
    }
  };

  const field = (key, label, placeholder = '') => (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-14 border-b border-border flex items-center px-4">
        <h1 className="font-semibold">Settings</h1>
      </header>

      <div className="max-w-2xl p-6 space-y-10">
        {/* Profile */}
        <form onSubmit={saveProfile} className="space-y-4">
          <h2 className="font-semibold text-sm">Profile</h2>
          {field('displayName', 'Display name', 'Jane Doe')}
          <div className="grid grid-cols-2 gap-4">
            {field('title', 'Title', 'Engineer')}
            {field('pronouns', 'Pronouns', 'she/her')}
          </div>
          {field('timezone', 'Timezone', 'Asia/Colombo')}
          <label className="block">
            <span className="text-xs text-muted-foreground">Bio</span>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          {field('statusMessage', 'Status message', '🌴 Out of office until Friday')}
          <button disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-40">
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        {/* Presence */}
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Presence</h2>
          <p className="text-xs text-muted-foreground">Applies instantly across every open session via the socket.</p>
          <div className="flex gap-2">
            {PRESENCE_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => { emit('presence:set', p); toast.success(`Presence set to ${p.toLowerCase()}`); }}
                className={cn('px-3 py-1.5 rounded-lg border border-border text-sm capitalize hover:bg-accent', profile?.presence === p && 'bg-accent font-semibold')}
              >
                {p === 'DND' ? 'Do not disturb' : p.toLowerCase()}
              </button>
            ))}
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Appearance</h2>
          <div className="flex gap-2">
            {['light', 'dark', 'system'].map((t) => (
              <button
                key={t}
                onClick={() => dispatch(setTheme(t))}
                className={cn('px-3 py-1.5 rounded-lg border border-border text-sm capitalize hover:bg-accent', theme === t && 'bg-accent font-semibold')}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Notifications</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-28 text-muted-foreground">Email digest</span>
            <select value={prefs.emailDigest} onChange={(e) => setPrefs({ ...prefs, emailDigest: e.target.value })} className="rounded border border-border bg-background px-2 py-1.5 text-sm">
              <option value="NONE">Never</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </label>
          {[
            ['sounds', 'Notification sounds'],
            ['threadReplies', 'Notify me about thread replies'],
            ['mentionsOnly', 'Mentions and DMs only (mute channel noise)'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!prefs[key]} onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
          <button onClick={savePrefs} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Save preferences</button>
        </section>
      </div>
    </div>
  );
}
