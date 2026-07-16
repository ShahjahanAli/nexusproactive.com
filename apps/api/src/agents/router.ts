import { completeChat } from '../services/llmClient';
import { config } from '../config';
import type { AgentName, RouterResult } from './types';

const VALID_AGENTS: AgentName[] = [
  'billing',
  'technical',
  'sales',
  'account',
  'unknown',
];

/** Fast keyword route so order/payment questions still work if the LLM router fails. */
export function heuristicRoute(userMessage: string): RouterResult | null {
  const m = userMessage.toLowerCase();
  if (
    /\b(order|orders|purchase|payment|invoice|refund|receipt|registration\s*number|ord-)\b/.test(
      m,
    )
  ) {
    return { agent: 'billing', confidence: 0.75, reasoning: 'Keyword: order/billing' };
  }
  if (
    /\b(conference|event|ticket|agenda|speaker|session|pricing|plan|product|catalog)\b/.test(m)
  ) {
    return { agent: 'sales', confidence: 0.7, reasoning: 'Keyword: sales/catalog' };
  }
  if (/\b(login|password|account|profile|email\s*change|sign[\s-]?in)\b/.test(m)) {
    return { agent: 'account', confidence: 0.7, reasoning: 'Keyword: account' };
  }
  if (/\b(error|bug|api|integration|webhook|not\s+working|failed|crash)\b/.test(m)) {
    return { agent: 'technical', confidence: 0.65, reasoning: 'Keyword: technical' };
  }
  return null;
}

export async function routeMessage(
  userMessage: string,
  trackTokens?: (n: number) => void,
): Promise<RouterResult> {
  // Prefer the LLM so informal / multilingual messages are understood.
  // Keyword heuristic is only a fallback if the LLM router fails.
  const heuristic = heuristicRoute(userMessage);

  try {
    const { text: raw } = await completeChat({
      model: config.llm.fallbackModel,
      messages: [
        {
          role: 'system',
          content: `You classify customer support messages into exactly one category.
The message may be informal, misspelled, or in any language — classify by meaning.
Reply with JSON only: {"agent":"billing|technical|sales|account|unknown","confidence":0.0-1.0,"reasoning":"brief"}

- billing: payments, invoices, refunds, subscriptions, charges, order status, purchases, registration payment
- technical: bugs, errors, API, integrations, how things work technically
- sales: pricing, demos, features, upgrades, pre-purchase, conferences, products, events
- account: login, profile, settings, password, email change, customer info
- unknown: greeting, unclear, or off-topic`,
        },
        { role: 'user', content: userMessage },
      ],
      onUsage: (u) => trackTokens?.(u.total_tokens),
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return heuristic ?? { agent: 'unknown', confidence: 0.3, reasoning: 'Parse failed' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as RouterResult;
    const agent = VALID_AGENTS.includes(parsed.agent) ? parsed.agent : 'unknown';
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5));

    if (agent === 'unknown' && heuristic) return heuristic;
    return { agent, confidence, reasoning: parsed.reasoning };
  } catch {
    return heuristic ?? { agent: 'unknown', confidence: 0.2, reasoning: 'Router error' };
  }
}

export function handoffLabel(agent: AgentName): string {
  const labels: Record<string, string> = {
    billing: 'Billing specialist',
    technical: 'Technical specialist',
    sales: 'Sales specialist',
    account: 'Account specialist',
    unknown: 'General assistant',
    router: 'Router',
  };
  return labels[agent] ?? 'Specialist';
}
