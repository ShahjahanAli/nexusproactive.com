'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlatformSetting } from '@nexus/shared-types';
import { Button, Input } from '@/components/admin/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';

function serializeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseValue(raw: string, original: unknown): unknown {
  if (typeof original === 'boolean') {
    return raw === 'true' || raw === '1';
  }
  if (typeof original === 'number') {
    return Number(raw);
  }
  if (typeof original === 'string') {
    // settings stored as JSON strings may come already unquoted from pg
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : raw;
    } catch {
      return raw;
    }
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function SettingEditor({ setting }: { setting: PlatformSetting }) {
  const router = useRouter();
  const [value, setValue] = useState(serializeValue(setting.value));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    const parsed = parseValue(value, setting.value);
    const res = await fetch(`/api/platform/settings/${setting.key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: parsed }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Update failed');
      return;
    }
    setMessage('Setting saved');
    router.refresh();
  }

  const isBool = typeof setting.value === 'boolean';

  return (
    <Panel>
      <PanelHeader
        code={setting.key}
        title={setting.key.replace(/_/g, ' ')}
        subtitle={setting.description ?? undefined}
      />
      <PanelBody className="space-y-3">
        {isBool ? (
          <label className="flex items-center gap-2 font-mono text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => setValue(e.target.checked ? 'true' : 'false')}
            />
            Enabled
          </label>
        ) : (
          <Input
            label="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {error && <p className="font-mono text-xs text-red-400">ERR: {error}</p>}
        {message && <p className="font-mono text-xs text-emerald-400">{message}</p>}
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </PanelBody>
    </Panel>
  );
}
