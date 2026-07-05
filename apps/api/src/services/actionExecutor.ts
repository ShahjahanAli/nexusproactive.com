import { RiskTier } from '@nexus/shared-types';
import { queryOne } from '../db';
import { mintScopedJwt, ScopedJwtPayload } from './scopedJwt';

export interface ActionRow {
  id: string;
  site_id: string;
  operation_id: string;
  method: string;
  path: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
  risk_tier: RiskTier;
  compensating_action_id: string | null;
}

export interface SiteRow {
  id: string;
  name: string;
  domain: string;
  backend_base_url: string;
  jwt_signing_secret: string;
  tenant_id: string;
}

function buildUrl(baseUrl: string, path: string, args: Record<string, unknown>): string {
  let url = path;
  const usedKeys = new Set<string>();
  for (const [key, value] of Object.entries(args)) {
    const placeholder = `{${key}}`;
    if (url.includes(placeholder)) {
      url = url.replace(placeholder, encodeURIComponent(String(value)));
      usedKeys.add(key);
    }
  }
  const base = `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (!usedKeys.has(key) && value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function executeAction(
  site: SiteRow,
  action: ActionRow,
  payload: Record<string, unknown>,
  scoped: ScopedJwtPayload,
): Promise<{ status: number; body: unknown }> {
  const token = mintScopedJwt(
    {
      ...scoped,
      allowed_operation_ids: [action.operation_id],
    },
    site.jwt_signing_secret,
  );

  const url = buildUrl(site.backend_base_url, action.path, payload);
  const method = action.method.toUpperCase();

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Nexus-Operation-Id': action.operation_id,
    },
  };

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchOptions.body = JSON.stringify(payload);
  }

  const response = await fetch(url, fetchOptions);
  let body: unknown;
  const text = await response.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

export async function getActionByOperationId(
  siteId: string,
  operationId: string,
): Promise<ActionRow | null> {
  return queryOne<ActionRow>(
    `SELECT id, site_id, operation_id, method, path, description, input_schema,
            risk_tier, compensating_action_id
     FROM actions
     WHERE site_id = $1 AND operation_id = $2 AND is_active = true
     ORDER BY spec_version DESC LIMIT 1`,
    [siteId, operationId],
  );
}

export async function getSiteById(siteId: string): Promise<SiteRow | null> {
  return queryOne<SiteRow>(
    `SELECT id, name, domain, backend_base_url, jwt_signing_secret, tenant_id FROM sites WHERE id = $1`,
    [siteId],
  );
}

export async function getActiveActions(siteId: string): Promise<ActionRow[]> {
  const { query } = await import('../db');
  return query<ActionRow>(
    `SELECT DISTINCT ON (operation_id)
            id, site_id, operation_id, method, path, description, input_schema,
            risk_tier, compensating_action_id
     FROM actions
     WHERE site_id = $1 AND is_active = true
     ORDER BY operation_id, spec_version DESC`,
    [siteId],
  );
}

export function actionsToTools(actions: ActionRow[]) {
  return actions.map((a) => ({
    type: 'function' as const,
    function: {
      name: a.operation_id,
      description: a.description ?? `${a.method} ${a.path}`,
      parameters: a.input_schema ?? { type: 'object', properties: {} },
    },
  }));
}
