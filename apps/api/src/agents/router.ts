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

export async function routeMessage(
  userMessage: string,
  trackTokens?: (n: number) => void,
): Promise<RouterResult> {
  try {
    const { text: raw } = await completeChat({
      model: config.llm.fallbackModel,
      messages: [
        {
          role: 'system',
          content: `You classify customer support messages into exactly one category.
Reply with JSON only: {"agent":"billing|technical|sales|account|unknown","confidence":0.0-1.0,"reasoning":"brief"}

- billing: payments, invoices, refunds, subscriptions, charges
- technical: bugs, errors, API, integrations, how things work technically
- sales: pricing, demos, features, upgrades, pre-purchase
- account: login, profile, settings, password, email change
- unknown: unclear or off-topic`,
        },
        { role: 'user', content: userMessage },
      ],
      onUsage: (u) => trackTokens?.(u.total_tokens),
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { agent: 'unknown', confidence: 0.3, reasoning: 'Parse failed' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as RouterResult;
    const agent = VALID_AGENTS.includes(parsed.agent) ? parsed.agent : 'unknown';
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5));

    return { agent, confidence, reasoning: parsed.reasoning };
  } catch {
    return { agent: 'unknown', confidence: 0.2, reasoning: 'Router error' };
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
