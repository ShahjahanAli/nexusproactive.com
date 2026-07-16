'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { TenantRole, TenantUser } from '@nexus/shared-types';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { Button, Input } from '@/components/dashboard/ui/button';
import { formatDateTime } from '@/lib/datetime';

const ROLE_OPTIONS: { value: TenantRole; label: string }[] = [
  { value: 'agent', label: 'Agent' },
  { value: 'admin', label: 'Admin' },
  { value: 'viewer', label: 'Viewer' },
];

export function TeamManager({
  currentRole,
}: {
  currentRole: TenantRole;
}) {
  const canManage = currentRole === 'owner' || currentRole === 'admin';
  const [members, setMembers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<TenantRole>('agent');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/team', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as {
      members?: TenantUser[];
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Failed to load team');
      return;
    }
    setMembers(data.members ?? []);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createMember(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName: displayName || undefined, role }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not create agent');
      return;
    }
    setEmail('');
    setPassword('');
    setDisplayName('');
    setRole('agent');
    await load();
  }

  async function setActive(userId: string, isActive: boolean) {
    const res = await fetch(`/api/team/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Update failed');
      return;
    }
    await load();
  }

  async function changeRole(userId: string, nextRole: TenantRole) {
    const res = await fetch(`/api/team/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Update failed');
      return;
    }
    await load();
  }

  async function removeMember(userId: string) {
    if (!confirm('Deactivate this team member? They will no longer be able to sign in.')) return;
    const res = await fetch(`/api/team/${userId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Remove failed');
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {canManage && (
        <Panel>
          <PanelHeader
            title="Invite human agent"
            subtitle="Agents can join any live customer thread from the right-side chat panel."
          />
          <PanelBody>
            <form onSubmit={(e) => void createMember(e)} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">Display name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Sara Support"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as TenantRole)}
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                >
                  {ROLE_OPTIONS.filter(
                    (r) => r.value !== 'admin' || currentRole === 'owner',
                  ).map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">Email</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@company.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">Temporary password</label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating…' : 'Create agent'}
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Team members"
          subtitle={
            canManage
              ? 'Owners and admins manage who can answer live chats.'
              : 'Your account team roster.'
          }
        />
        <PanelBody className="p-0">
          {loading ? (
            <p className="px-5 py-8 text-sm text-zinc-500">Loading…</p>
          ) : members.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-500">No team members yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/60">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-100">
                        {m.display_name || m.email.split('@')[0]}
                      </p>
                      <Badge
                        size="sm"
                        variant={
                          m.role === 'owner'
                            ? 'success'
                            : m.role === 'agent'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {m.role}
                      </Badge>
                      {m.is_active === false && (
                        <Badge size="sm" variant="danger">
                          inactive
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {m.email}
                      {m.created_at ? ` · joined ${formatDateTime(m.created_at)}` : ''}
                    </p>
                  </div>
                  {canManage && m.role !== 'owner' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) => void changeRole(m.id, e.target.value as TenantRole)}
                        className="h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
                      >
                        {ROLE_OPTIONS.filter(
                          (r) => r.value !== 'admin' || currentRole === 'owner',
                        ).map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      {m.is_active !== false ? (
                        <Button size="sm" variant="secondary" onClick={() => void setActive(m.id, false)}>
                          Deactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => void setActive(m.id, true)}>
                          Reactivate
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => void removeMember(m.id)}>
                        Remove
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
