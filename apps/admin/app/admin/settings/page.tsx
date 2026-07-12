import type { PlatformSetting } from '@nexus/shared-types';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/admin/ui/page-header';
import { SettingEditor } from '@/components/admin/setting-editor';

export default async function SettingsPage() {
  const { settings } = await apiFetch<{ settings: PlatformSetting[] }>(
    '/platform/settings',
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="global_config"
        title="Global settings"
        description="Platform-wide switches: signups, maintenance mode, defaults, and support contacts."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {settings.map((setting) => (
          <SettingEditor key={setting.key} setting={setting} />
        ))}
      </div>
    </div>
  );
}
