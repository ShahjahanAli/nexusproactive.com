import type { OpenApiSourceType, OpenApiSourceTypeRouting } from '@nexus/shared-types';
import type { AgentConfig, SpecialistAgent } from '../types';
import { listOpenApiSourceTypes } from '../../services/openapiSources';

export const specialistAgents: Record<SpecialistAgent, AgentConfig> = {
  billing: {
    name: 'billing',
    displayName: 'Billing',
    systemPrompt: `You are the Billing specialist for this business. Help with payments, invoices, refunds, subscriptions, charges, and order status.
Use available tools to look up or modify billing data when appropriate. Be concise and professional.
When sharing order/registration/payment details, format as a scannable markdown bullet list — one field per line (Order Number, Registration Number, Status, Payment, Conference link, Dates, Item, Total). Never pack all fields into one paragraph.`,
    actionKeywords:
      /payment|invoice|charge|refund|billing|subscription|order|purchase|cart|checkout/i,
  },
  technical: {
    name: 'technical',
    displayName: 'Technical',
    systemPrompt: `You are the Technical support specialist. Help with API issues, integrations, errors, and how the product works technically.
Use read-only tools to investigate before suggesting fixes.`,
    actionKeywords:
      /api|debug|error|health|status|webhook|integration|config|log|diagnostic/i,
  },
  sales: {
    name: 'sales',
    displayName: 'Sales',
    systemPrompt: `You are the Sales & Presales specialist. Help prospects and customers understand features, pricing, upgrades, conferences, and events.
Be helpful and consultative. Use tools to fetch product/plan/conference info when available.
Answer the visitor's latest question clearly — do not combine unrelated older questions into one reply.
When listing products, services, plans, conferences, or events:
- Sort / present soonest-first for "next" or "upcoming".
- Every title MUST be a clickable markdown link: [Conference Title](https://example.com/conference/slug)
- Prefer publicUrl, then url (not localhost), else path/slug on the site domain.
Never list a conference name as plain bold text when a URL/path/slug exists.`,
    actionKeywords:
      /product|plan|pricing|feature|demo|trial|quote|catalog|offer|package|conference|event|schedule|listing|session|speaker/i,
  },
  account: {
    name: 'account',
    displayName: 'Account',
    systemPrompt: `You are the Account management specialist. Help with profile, login, email, password, and account settings.
Confirm identity-sensitive changes carefully. Use tools for account updates when available.`,
    actionKeywords:
      /user|account|profile|email|password|login|auth|member|setting|preference/i,
  },
};

export function getSpecialistConfig(agent: SpecialistAgent): AgentConfig {
  return specialistAgents[agent];
}

export function filterActionsForAgent<
  T extends { path: string; description: string | null; operation_id: string },
>(actions: T[], agent: SpecialistAgent): T[] {
  const keywords = specialistAgents[agent].actionKeywords;
  const filtered = actions.filter((a) =>
    keywords.test(`${a.path} ${a.description ?? ''} ${a.operation_id}`),
  );
  return filtered.length > 0 ? filtered : actions;
}

function typeMatchesSpecialist(
  routing: OpenApiSourceTypeRouting | undefined,
  agent: SpecialistAgent,
): boolean {
  if (!routing) return false;
  if (routing.alwaysInclude) return true;
  const specialists = routing.specialists ?? [];
  return specialists.includes(agent);
}

/**
 * Prefer actions whose OpenAPI source type maps to this specialist (from Super Admin routing).
 * Always include alwaysInclude types (e.g. FAQ). Fall back to keyword filter + read_only.
 */
export function mergeActionsForAgent<
  T extends {
    path: string;
    description: string | null;
    operation_id: string;
    risk_tier: string;
    source_type?: string | null;
  },
>(
  actions: T[],
  agent: SpecialistAgent,
  sourceTypes?: OpenApiSourceType[],
): T[] {
  const typeMap = new Map(
    (sourceTypes ?? []).map((t) => [t.key, t.routing as OpenApiSourceTypeRouting]),
  );

  const typed = actions.filter((a) => {
    if (!a.source_type) return false;
    return typeMatchesSpecialist(typeMap.get(a.source_type), agent);
  });

  const keywordFiltered = filterActionsForAgent(actions, agent);
  const readOnly = actions.filter((a) => a.risk_tier === 'read_only');
  const alwaysInclude = actions.filter((a) => {
    if (!a.source_type) return false;
    return typeMap.get(a.source_type)?.alwaysInclude === true;
  });

  const primary = typed.length > 0 ? typed : keywordFiltered;
  const merged = new Map<string, T>();
  for (const a of [...primary, ...alwaysInclude, ...readOnly]) {
    merged.set(a.operation_id, a);
  }
  return [...merged.values()];
}

/** Cached load of platform source types for orchestrator filtering */
let cachedSourceTypes: { at: number; types: OpenApiSourceType[] } | null = null;

export async function getSourceTypesForRouting(): Promise<OpenApiSourceType[]> {
  const now = Date.now();
  if (cachedSourceTypes && now - cachedSourceTypes.at < 60_000) {
    return cachedSourceTypes.types;
  }
  try {
    const types = await listOpenApiSourceTypes();
    cachedSourceTypes = { at: now, types };
    return types;
  } catch {
    return cachedSourceTypes?.types ?? [];
  }
}
