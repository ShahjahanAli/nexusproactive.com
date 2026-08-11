import type { CxConsult, CxSpecialist } from '@nexus/shared-types';
import { handoffLabel } from '../agents/router';
import {
  getSourceTypesForRouting,
  getSpecialistConfig,
  mergeActionsForAgent,
} from '../agents/specialists';
import type { SpecialistAgent } from '../agents/types';
import { query, queryOne } from '../db';
import {
  SiteRow,
  actionsToTools,
  executeAction,
  getActiveActions,
} from './actionExecutor';
import { chatCompletion, ChatMessage, ToolDefinition } from './llmClient';
import type { ScopedJwtPayload } from './scopedJwt';
import { prepareToolResultForLlm } from './tokenOptimization';

export const CONSULT_SPECIALIST_TOOL = 'consult_specialist';

const MAX_CONSULT_TOOL_ITERS = 2;
const SPECIALISTS: CxSpecialist[] = ['billing', 'technical', 'sales', 'account'];

export function consultSpecialistToolDefinition(
  allowed: CxSpecialist[],
): ToolDefinition {
  const list = allowed.length ? allowed : SPECIALISTS;
  return {
    type: 'function',
    function: {
      name: CONSULT_SPECIALIST_TOOL,
      description:
        'Ask an internal platform specialist for domain help (billing, technical, sales, or account). ' +
        'Use when you lack the skill or live data expertise for the visitor question. ' +
        'You remain the visitor-facing CX Agent — never tell the visitor you are transferring to another AI. ' +
        'Use the specialist answer to reply in your own voice.',
      parameters: {
        type: 'object',
        properties: {
          specialist: {
            type: 'string',
            enum: list,
            description: 'Which specialist to consult',
          },
          question: {
            type: 'string',
            description: 'Clear question for the specialist, including any IDs or facts already known',
          },
          context: {
            type: 'string',
            description: 'Optional short context from the conversation',
          },
        },
        required: ['specialist', 'question'],
      },
    },
  };
}

export async function listCxConsults(opts: {
  tenantId: string;
  cxAgentId?: string;
  conversationId?: string;
  limit?: number;
}): Promise<CxConsult[]> {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  const clauses = ['tenant_id = $1'];
  const params: unknown[] = [opts.tenantId];
  let i = 2;
  if (opts.cxAgentId) {
    clauses.push(`from_cx_agent_id = $${i++}`);
    params.push(opts.cxAgentId);
  }
  if (opts.conversationId) {
    clauses.push(`conversation_id = $${i++}`);
    params.push(opts.conversationId);
  }
  params.push(limit);
  return query<CxConsult>(
    `SELECT * FROM cx_consults
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${i}`,
    params,
  );
}

export interface SpecialistConsultInput {
  tenantId: string;
  conversationId: string;
  fromCxAgentId: string;
  specialist: string;
  question: string;
  context?: string;
  allowedSpecialists: CxSpecialist[];
  site: SiteRow;
  visitorId: string;
  transcriptSnippet?: string;
  signal?: AbortSignal;
}

export interface SpecialistConsultResult {
  ok: boolean;
  consultId: string;
  specialist: string;
  answer: string;
  tokensUsed: number;
  latencyMs: number;
  error?: string;
}

function normalizeSpecialist(
  raw: string,
  allowed: CxSpecialist[],
): CxSpecialist | null {
  const key = raw.trim().toLowerCase() as CxSpecialist;
  if (!SPECIALISTS.includes(key)) return null;
  if (allowed.length && !allowed.includes(key)) return null;
  return key;
}

export async function runSpecialistConsult(
  input: SpecialistConsultInput,
): Promise<SpecialistConsultResult> {
  const started = Date.now();
  const specialist = normalizeSpecialist(input.specialist, input.allowedSpecialists);

  const insert = await queryOne<CxConsult>(
    `INSERT INTO cx_consults (
       tenant_id, conversation_id, from_cx_agent_id, consult_type, target_key,
       question, context_snippet, status
     ) VALUES ($1,$2,$3,'specialist',$4,$5,$6,'running')
     RETURNING *`,
    [
      input.tenantId,
      input.conversationId,
      input.fromCxAgentId,
      specialist ?? input.specialist,
      input.question.slice(0, 4000),
      (input.context ?? '').slice(0, 2000) || null,
    ],
  );
  if (!insert) {
    return {
      ok: false,
      consultId: '',
      specialist: input.specialist,
      answer: '',
      tokensUsed: 0,
      latencyMs: Date.now() - started,
      error: 'Failed to create consult record',
    };
  }

  if (!specialist) {
    await finishConsult(insert.id, {
      status: 'failed',
      answer: null,
      tokensUsed: 0,
      latencyMs: Date.now() - started,
      meta: { error: 'specialist_not_allowed' },
    });
    return {
      ok: false,
      consultId: insert.id,
      specialist: input.specialist,
      answer: '',
      tokensUsed: 0,
      latencyMs: Date.now() - started,
      error: `Specialist "${input.specialist}" is not allowed for this CX Agent`,
    };
  }

  let tokensUsed = 0;
  try {
    const config = getSpecialistConfig(specialist as SpecialistAgent);
    const allActions = await getActiveActions(input.site.id);
    const sourceTypes = await getSourceTypesForRouting();
    const scoped = mergeActionsForAgent(allActions, specialist, sourceTypes);
    const tools = actionsToTools(scoped.length ? scoped : allActions);
    const actionMap = new Map(
      (scoped.length ? scoped : allActions).map((a) => [a.operation_id, a]),
    );

    const scopedPayload: ScopedJwtPayload = {
      site_id: input.site.id,
      visitor_id: input.visitorId,
      allowed_operation_ids: [...actionMap.keys()],
    };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${config.systemPrompt}

You are answering an INTERNAL consult from a CX Agent. Reply with a concise English brief the CX Agent can use with the visitor.
Include facts from tools when you call them. Do not greet the visitor. Do not invent data.
If you cannot answer, say what is missing.`,
      },
      {
        role: 'user',
        content: [
          `Specialist: ${handoffLabel(specialist)}`,
          `Question: ${input.question}`,
          input.context ? `Context: ${input.context}` : '',
          input.transcriptSnippet
            ? `Recent transcript:\n${input.transcriptSnippet}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ];

    let answer = '';
    for (let iter = 0; iter < MAX_CONSULT_TOOL_ITERS; iter++) {
      const completion = await chatCompletion({
        messages,
        tools: tools.length && iter < MAX_CONSULT_TOOL_ITERS - 1 ? tools : undefined,
        toolChoice: tools.length && iter === 0 ? 'auto' : 'none',
        signal: input.signal,
      });
      tokensUsed += completion.tokens_used ?? 0;

      if (completion.tool_calls?.length) {
        messages.push({
          role: 'assistant',
          content: completion.content ?? '',
        });
        for (const toolCall of completion.tool_calls) {
          const action = actionMap.get(toolCall.function.name);
          let args: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(toolCall.function.arguments || '{}') as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              args = parsed as Record<string, unknown>;
            }
          } catch {
            args = {};
          }

          let toolContent: string;
          if (!action) {
            toolContent = JSON.stringify({ error: 'Action not found' });
          } else if (
            action.risk_tier === 'irreversible_write' ||
            action.risk_tier === 'financial'
          ) {
            toolContent = JSON.stringify({
              ok: false,
              error:
                'High-risk writes are not available during specialist consult. Report what approval the CX Agent should request.',
            });
          } else {
            const result = await executeAction(input.site, action, args, scopedPayload);
            toolContent = JSON.stringify(
              prepareToolResultForLlm(result.body, input.site.domain),
            );
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolContent,
          });
        }
        continue;
      }

      answer = (completion.content ?? '').trim();
      break;
    }

    if (!answer) {
      // Final no-tools pass
      const completion = await chatCompletion({
        messages: [
          ...messages,
          {
            role: 'system',
            content: 'Provide your final brief for the CX Agent now. No more tools.',
          },
        ],
        toolChoice: 'none',
        signal: input.signal,
      });
      tokensUsed += completion.tokens_used ?? 0;
      answer = (completion.content ?? '').trim() || 'No specialist answer produced.';
    }

    const latencyMs = Date.now() - started;
    await finishConsult(insert.id, {
      status: 'completed',
      answer: answer.slice(0, 8000),
      tokensUsed,
      latencyMs,
      meta: { specialist },
    });

    return {
      ok: true,
      consultId: insert.id,
      specialist,
      answer,
      tokensUsed,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message = err instanceof Error ? err.message : 'Consult failed';
    await finishConsult(insert.id, {
      status: 'failed',
      answer: null,
      tokensUsed,
      latencyMs,
      meta: { error: message },
    });
    return {
      ok: false,
      consultId: insert.id,
      specialist,
      answer: '',
      tokensUsed,
      latencyMs,
      error: message,
    };
  }
}

async function finishConsult(
  id: string,
  data: {
    status: 'completed' | 'failed' | 'timeout';
    answer: string | null;
    tokensUsed: number;
    latencyMs: number;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await queryOne(
    `UPDATE cx_consults SET
       status = $2,
       answer = $3,
       tokens_used = $4,
       latency_ms = $5,
       meta = COALESCE(meta, '{}'::jsonb) || $6::jsonb,
       completed_at = now()
     WHERE id = $1`,
    [
      id,
      data.status,
      data.answer,
      data.tokensUsed,
      data.latencyMs,
      JSON.stringify(data.meta ?? {}),
    ],
  );
}

/** Status line shown in the widget while a consult runs. */
export function consultStatusLabel(
  cxDisplayName: string,
  specialist: string,
): string {
  const label = SPECIALISTS.includes(specialist as CxSpecialist)
    ? handoffLabel(specialist as SpecialistAgent)
    : specialist;
  return `${cxDisplayName} is checking with ${label}…`;
}
