import { queryOne } from '../db';

export interface WidgetTheme {
  primaryColor?: string;
  primaryColorDark?: string;
  position?: 'bottom-right' | 'bottom-left';
  title?: string;
  subtitle?: string;
  launcherLabel?: string;
  escalationEnabled?: boolean;
  proactiveEnabled?: boolean;
}

const DEFAULT_THEME: WidgetTheme = {
  primaryColor: '#059669',
  primaryColorDark: '#047857',
  position: 'bottom-right',
  title: 'Chat',
  subtitle: 'Online',
  launcherLabel: 'Chat',
  escalationEnabled: true,
  proactiveEnabled: true,
};

export async function getWidgetConfig(siteId: string): Promise<{
  siteId: string;
  siteName: string;
  theme: WidgetTheme;
}> {
  const site = await queryOne<{ id: string; name: string; widget_theme: Record<string, unknown> }>(
    'SELECT id, name, widget_theme FROM sites WHERE id = $1',
    [siteId],
  );
  if (!site) throw new Error('Site not found');

  const stored = (site.widget_theme ?? {}) as WidgetTheme;
  return {
    siteId: site.id,
    siteName: site.name,
    theme: { ...DEFAULT_THEME, ...stored },
  };
}
