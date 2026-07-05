import type { AgentConfig, SpecialistAgent } from '../types';

export const specialistAgents: Record<SpecialistAgent, AgentConfig> = {
  billing: {
    name: 'billing',
    displayName: 'Billing',
    systemPrompt: `You are the Billing specialist for this business. Help with payments, invoices, refunds, subscriptions, and charges.
Use available tools to look up or modify billing data when appropriate. Be concise and professional.`,
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
    systemPrompt: `You are the Sales & Presales specialist. Help prospects and customers understand features, pricing, and upgrades.
Be helpful and consultative. Use tools to fetch product/plan info when available.`,
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

export function mergeActionsForAgent<
  T extends { path: string; description: string | null; operation_id: string; risk_tier: string },
>(actions: T[], agent: SpecialistAgent): T[] {
  const filtered = filterActionsForAgent(actions, agent);
  const readOnly = actions.filter((a) => a.risk_tier === 'read_only');
  const merged = new Map<string, T>();
  for (const a of [...filtered, ...readOnly]) {
    merged.set(a.operation_id, a);
  }
  return [...merged.values()];
}
