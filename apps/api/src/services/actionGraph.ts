import { RiskTier } from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { config } from '../config';
import { completeChat } from './llmClient';
import {
  createSiteOpenApiSource,
  getSiteOpenApiSource,
  listEnabledOpenApiSources,
  listSiteOpenApiSources,
  markSourceIngestResult,
} from './openapiSources';

interface OpenApiSpec {
  paths?: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        summary?: string;
        description?: string;
        requestBody?: {
          content?: Record<string, { schema?: Record<string, unknown> }>;
        };
        parameters?: Array<{
          name: string;
          in: string;
          description?: string;
          schema?: Record<string, unknown>;
        }>;
      }
    >
  >;
}

interface ParsedAction {
  operation_id: string;
  method: string;
  path: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
  risk_tier: RiskTier;
}

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]);

function slugifyOperationId(method: string, path: string): string {
  return `${method}_${path.replace(/[{}\/]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
}

function classifyRiskByRules(method: string, path: string, description: string): RiskTier {
  const combined = `${method} ${path} ${description}`.toLowerCase();

  if (method === 'get' || method === 'head') {
    return 'read_only';
  }

  // POST/PUT used as dual-factor lookups (common for “where is my order?” chat APIs)
  const looksLikeLookup =
    /\b(look\s*up|lookup|status|search|find|query|retrieve|fetch|read|check)\b/.test(combined) ||
    /\/(chat\/)?(orders?|customer[-_]?info|status|lookup|search)\b/.test(path.toLowerCase());
  const looksLikeMutation =
    /\b(create|add|update|patch|put|modify|change|edit|delete|remove|cancel|charge|pay|refund|subscribe)\b/.test(
      combined,
    );
  if (looksLikeLookup && !looksLikeMutation) {
    return 'read_only';
  }

  if (/payment|charge|invoice|billing|refund|payout|subscription/.test(combined)) {
    return 'financial';
  }

  if (/cancel|delete|remove|destroy|refund|terminate|revoke/.test(combined)) {
    return 'irreversible_write';
  }

  if (/update|patch|put|create|add|set|modify|change|edit/.test(combined)) {
    return 'reversible_write';
  }

  return 'reversible_write';
}

async function classifyRiskWithLlm(
  method: string,
  path: string,
  description: string,
  ruleTier: RiskTier,
): Promise<RiskTier> {
  if (ruleTier === 'read_only' || ruleTier === 'financial') {
    return ruleTier;
  }

  try {
    const { text: response } = await completeChat({
      model: config.llm.fallbackModel,
      messages: [
        {
          role: 'system',
          content:
            'Classify API operation risk. Reply with exactly one of: read_only, reversible_write, irreversible_write, financial.',
        },
        {
          role: 'user',
          content: `Method: ${method}\nPath: ${path}\nDescription: ${description}\nRule suggestion: ${ruleTier}`,
        },
      ],
    });

    const tier = response.trim().toLowerCase() as RiskTier;
    const valid: RiskTier[] = [
      'read_only',
      'reversible_write',
      'irreversible_write',
      'financial',
    ];
    if (valid.includes(tier)) return tier;
  } catch {
    // fall back to rule-based tier
  }

  return ruleTier;
}

function extractInputSchema(
  operation: NonNullable<OpenApiSpec['paths']>[string][string],
): Record<string, unknown> | null {
  const jsonContent = operation.requestBody?.content?.['application/json'];
  if (jsonContent?.schema) return jsonContent.schema;

  if (operation.parameters?.length) {
    return {
      type: 'object',
      properties: Object.fromEntries(
        operation.parameters.map((p) => {
          const base = { ...(p.schema ?? { type: 'string' }) } as Record<string, unknown>;
          const descParts: string[] = [];
          if (p.description) descParts.push(p.description);
          else if (typeof base.description === 'string') descParts.push(base.description);
          if (base.example !== undefined) {
            descParts.push(`Example: ${String(base.example)}`);
          }
          if (descParts.length) base.description = descParts.join(' ');
          return [p.name, base];
        }),
      ),
    };
  }

  return null;
}

export function parseOpenApiSpec(spec: OpenApiSpec): ParsedAction[] {
  const actions: ParsedAction[] = [];

  if (!spec.paths) return actions;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;

      const description =
        operation.summary ?? operation.description ?? `${method.toUpperCase()} ${path}`;
      const operationId =
        operation.operationId ?? slugifyOperationId(method, path);
      const ruleTier = classifyRiskByRules(method, path, description);

      actions.push({
        operation_id: operationId,
        method: method.toUpperCase(),
        path,
        description,
        input_schema: extractInputSchema(operation),
        risk_tier: ruleTier,
      });
    }
  }

  return actions;
}

function namespacedOperationId(typeKey: string, operationId: string): string {
  // Keep legacy "other" unprefixed so backfilled sites retain stable tool names
  if (typeKey === 'other') return operationId;
  const prefix = `${typeKey}__`;
  return operationId.startsWith(prefix) ? operationId : `${prefix}${operationId}`;
}

async function getNextSpecVersion(siteId: string, sourceId: string): Promise<number> {
  const row = await queryOne<{ max_version: number | null }>(
    `SELECT MAX(spec_version) AS max_version FROM actions
     WHERE site_id = $1 AND source_id = $2`,
    [siteId, sourceId],
  );
  return (row?.max_version ?? 0) + 1;
}

export interface IngestResult {
  siteId: string;
  sourceId?: string;
  sourceType?: string;
  specVersion: number;
  actionCount: number;
  newActions: number;
  changedActions: number;
}

export async function ingestOpenApiSource(
  sourceId: string,
  options?: { skipLlm?: boolean },
): Promise<IngestResult> {
  const source = await queryOne<{
    id: string;
    site_id: string;
    type_key: string;
    url: string;
  }>(
    `SELECT id, site_id, type_key, url FROM site_openapi_sources WHERE id = $1`,
    [sourceId],
  );
  if (!source) {
    throw new Error('OpenAPI source not found');
  }

  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
    }

    const spec = (await response.json()) as OpenApiSpec;
    const parsed = parseOpenApiSpec(spec).map((a) => ({
      ...a,
      operation_id: namespacedOperationId(source.type_key, a.operation_id),
    }));
    const specVersion = await getNextSpecVersion(source.site_id, source.id);

    const previous = await query<{
      operation_id: string;
      method: string;
      path: string;
      risk_tier: RiskTier;
    }>(
      `SELECT operation_id, method, path, risk_tier FROM actions
       WHERE site_id = $1 AND source_id = $2
         AND spec_version = (
           SELECT COALESCE(MAX(spec_version), 0) FROM actions
           WHERE site_id = $1 AND source_id = $2
         )`,
      [source.site_id, source.id],
    );

    const previousMap = new Map(previous.map((a) => [a.operation_id, a]));
    let newActions = 0;
    let changedActions = 0;

    for (const action of parsed) {
      const prev = previousMap.get(action.operation_id);
      if (!prev) {
        newActions++;
      } else if (
        prev.method !== action.method ||
        prev.path !== action.path ||
        prev.risk_tier !== action.risk_tier
      ) {
        changedActions++;
      }

      const riskTier = options?.skipLlm
        ? action.risk_tier
        : await classifyRiskWithLlm(
            action.method.toLowerCase(),
            action.path,
            action.description ?? '',
            action.risk_tier,
          );

      const isNew = !prev;
      const isChanged =
        !!prev &&
        (prev.method !== action.method ||
          prev.path !== action.path ||
          prev.risk_tier !== action.risk_tier);
      const isActive = isNew || isChanged ? riskTier === 'read_only' : true;

      await queryOne(
        `INSERT INTO actions (
           site_id, source_id, source_type, operation_id, method, path, description,
           input_schema, risk_tier, spec_version, is_active, reviewed_by_human
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (site_id, source_id, operation_id, spec_version)
           WHERE source_id IS NOT NULL
         DO UPDATE SET
           method = EXCLUDED.method,
           path = EXCLUDED.path,
           description = EXCLUDED.description,
           input_schema = EXCLUDED.input_schema,
           risk_tier = EXCLUDED.risk_tier,
           is_active = EXCLUDED.is_active,
           source_type = EXCLUDED.source_type`,
        [
          source.site_id,
          source.id,
          source.type_key,
          action.operation_id,
          action.method,
          action.path,
          action.description,
          action.input_schema ? JSON.stringify(action.input_schema) : null,
          riskTier,
          specVersion,
          isActive,
          riskTier === 'read_only',
        ],
      );
    }

    await markSourceIngestResult(source.id, { ok: true });
    await queryOne('UPDATE sites SET openapi_spec_url = $1 WHERE id = $2', [
      source.url,
      source.site_id,
    ]);

    return {
      siteId: source.site_id,
      sourceId: source.id,
      sourceType: source.type_key,
      specVersion,
      actionCount: parsed.length,
      newActions,
      changedActions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markSourceIngestResult(source.id, { ok: false, error: message });
    throw err;
  }
}

/**
 * Legacy entry: ingest by site + URL. Creates/updates an "other" source when needed.
 */
export async function ingestOpenApiSpec(
  siteId: string,
  specUrl: string,
  options?: { skipLlm?: boolean; typeKey?: string },
): Promise<IngestResult> {
  const typeKey = options?.typeKey ?? 'other';
  const existing = await listSiteOpenApiSources(siteId);
  let source = existing.find((s) => s.url === specUrl && s.type_key === typeKey) ?? null;

  if (!source) {
    const sameType = existing.find((s) => s.type_key === typeKey);
    if (sameType) {
      await query(
        `UPDATE site_openapi_sources
         SET url = $1, updated_at = now(), is_enabled = true
         WHERE id = $2`,
        [specUrl, sameType.id],
      );
      source = await getSiteOpenApiSource(siteId, sameType.id);
    } else {
      source = await createSiteOpenApiSource({
        siteId,
        typeKey,
        url: specUrl,
        label: typeKey === 'other' ? 'Primary OpenAPI' : null,
      });
    }
  }

  if (!source) {
    throw new Error('Failed to resolve OpenAPI source');
  }

  return ingestOpenApiSource(source.id, options);
}

export async function reingestAllSites(): Promise<void> {
  const sources = await listEnabledOpenApiSources();

  for (const source of sources) {
    try {
      const result = await ingestOpenApiSource(source.id, { skipLlm: true });
      console.log(
        `[action-graph] Re-ingested source ${source.id} (site ${source.site_id}, ${source.type_key}): v${result.specVersion}, ${result.actionCount} actions, ${result.newActions} new`,
      );
    } catch (err) {
      console.error(
        `[action-graph] Failed to re-ingest source ${source.id} (site ${source.site_id}):`,
        err,
      );
    }
  }
}
