import { RiskTier } from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { config } from '../config';
import { completeChat } from './llmClient';

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
        parameters?: Array<{ name: string; in: string; schema?: Record<string, unknown> }>;
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
        operation.parameters.map((p) => [p.name, p.schema ?? { type: 'string' }]),
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

async function getNextSpecVersion(siteId: string): Promise<number> {
  const row = await queryOne<{ max_version: number | null }>(
    'SELECT MAX(spec_version) AS max_version FROM actions WHERE site_id = $1',
    [siteId],
  );
  return (row?.max_version ?? 0) + 1;
}

export interface IngestResult {
  siteId: string;
  specVersion: number;
  actionCount: number;
  newActions: number;
  changedActions: number;
}

export async function ingestOpenApiSpec(
  siteId: string,
  specUrl: string,
  options?: { skipLlm?: boolean },
): Promise<IngestResult> {
  const response = await fetch(specUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
  }

  const spec = (await response.json()) as OpenApiSpec;
  const parsed = parseOpenApiSpec(spec);
  const specVersion = await getNextSpecVersion(siteId);

  const previous = await query<{
    operation_id: string;
    method: string;
    path: string;
    risk_tier: RiskTier;
  }>(
    `SELECT operation_id, method, path, risk_tier FROM actions
     WHERE site_id = $1 AND spec_version = (SELECT COALESCE(MAX(spec_version), 0) FROM actions WHERE site_id = $1) - CASE WHEN EXISTS (SELECT 1 FROM actions WHERE site_id = $1) THEN 1 ELSE 0 END`,
    [siteId],
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
    // Auto-activate safe read endpoints; writes need dashboard approval
    const isActive = isNew || isChanged ? riskTier === 'read_only' : true;

    await queryOne(
      `INSERT INTO actions (site_id, operation_id, method, path, description, input_schema, risk_tier, spec_version, is_active, reviewed_by_human)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (site_id, operation_id, spec_version) DO UPDATE
       SET method = EXCLUDED.method, path = EXCLUDED.path, description = EXCLUDED.description,
           input_schema = EXCLUDED.input_schema, risk_tier = EXCLUDED.risk_tier,
           is_active = EXCLUDED.is_active`,
      [
        siteId,
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

  await queryOne('UPDATE sites SET openapi_spec_url = $1 WHERE id = $2', [
    specUrl,
    siteId,
  ]);

  return {
    siteId,
    specVersion,
    actionCount: parsed.length,
    newActions,
    changedActions,
  };
}

export async function reingestAllSites(): Promise<void> {
  const sites = await query<{ id: string; openapi_spec_url: string | null }>(
    'SELECT id, openapi_spec_url FROM sites WHERE openapi_spec_url IS NOT NULL',
  );

  for (const site of sites) {
    if (!site.openapi_spec_url) continue;
    try {
      const result = await ingestOpenApiSpec(site.id, site.openapi_spec_url, {
        skipLlm: true,
      });
      console.log(
        `[action-graph] Re-ingested site ${site.id}: v${result.specVersion}, ${result.actionCount} actions, ${result.newActions} new`,
      );
    } catch (err) {
      console.error(`[action-graph] Failed to re-ingest site ${site.id}:`, err);
    }
  }
}
