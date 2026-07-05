import { RiskTier } from '@nexus/shared-types';
import { config } from '../config';
import { handoffLabel, routeMessage } from '../agents/router';
import {
  getSpecialistConfig,
  mergeActionsForAgent,
} from '../agents/specialists';
import { buildOrchestratorSystemPrompt } from '../agents/systemPrompt';
import type {
  AgentName,
  OrchestratorTraceStep,
  SpecialistAgent,
  SseEvent,
} from '../agents/types';
import { queryOne } from '../db';
import {
  actionsToTools,
  ActionRow,
  executeAction,
  getActiveActions,
  getSiteById,
  SiteRow,
} from './actionExecutor';
import {
  getConversationMessages,
  getOrCreateConversation,
  getSiteTenantId,
  saveMessage,
  setActiveAgent,
} from './conversationService';
import {
  chatCompletion,
  ChatMessage,
  streamChat,
  completeChat,
} from './llmClient';
import {
  hashToken,
  mintApprovalToken,
  ScopedJwtPayload,
} from './scopedJwt';
import { checkPlanLimit, incrementUsage } from './planLimits';
import { recordProductSignal } from './productSignals';

const MAX_TOOL_ITERATIONS = 5;
const UNDO_MINUTES = 5;

function isSmallTalk(message: string): boolean {
  const t = message.trim().toLowerCase();
  return /^(hi|hello|hey|howdy|good\s+(morning|afternoon|evening)|thanks|thank you|ok|okay|bye|goodbye)[!.?\s]*$/i.test(t);
}

function statusEvent(phase: string, label?: string): string {
  return sse({ type: 'status', phase, label: label ?? phase });
}

function isSpecialist(agent: AgentName): agent is SpecialistAgent {
  return (
    agent === 'billing' ||
    agent === 'technical' ||
    agent === 'sales' ||
    agent === 'account'
  );
}

function specialistOrUnknown(agent: AgentName): SpecialistAgent | 'unknown' {
  return isSpecialist(agent) ? agent : 'unknown';
}

function sse(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function* runOrchestrator(input: {
  siteId: string;
  visitorId: string;
  message: string;
  conversationId?: string;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const trace: OrchestratorTraceStep[] = [];
  const pushTrace = (step: Omit<OrchestratorTraceStep, 'timestamp'>) => {
    trace.push({ ...step, timestamp: new Date().toISOString() });
  };

  try {
    const site = await getSiteById(input.siteId);
    if (!site) {
      yield sse({ type: 'error', message: 'Site not found' });
      return;
    }

    const tenantId = await getSiteTenantId(input.siteId);
    if (tenantId) {
      const limit = await checkPlanLimit(tenantId, 'max_conversations_month');
      if (!limit.allowed) {
        yield sse({ type: 'error', message: limit.message ?? 'Capacity reached' });
        return;
      }
    }

    const conversation = await getOrCreateConversation(
      input.siteId,
      input.visitorId,
      input.conversationId,
    );

    yield sse({
      type: 'conversation',
      conversationId: conversation.id,
    });

    await saveMessage(conversation.id, 'user', input.message);

    if (tenantId) {
      await incrementUsage(tenantId, 'conversations_count');
    }

    yield statusEvent('thinking', 'Understanding your question…');

    let sessionTokens = 0;
    const trackTokens = (n: number) => {
      if (n > 0) sessionTokens += n;
    };

    const smallTalk = isSmallTalk(input.message);
    let activeAgent: AgentName = (conversation.active_agent as AgentName) || 'router';
    if (activeAgent === 'router' || !activeAgent) {
      const route = await routeMessage(input.message, trackTokens);
      pushTrace({
        type: 'route',
        agent: route.agent,
        detail: `confidence=${route.confidence} ${route.reasoning ?? ''}`,
      });

      const target = specialistOrUnknown(route.agent);
      if (target !== 'unknown') {
        if (activeAgent === 'router') {
          yield sse({
            type: 'handoff',
            from: 'router',
            to: target,
            label: `Connecting you to ${handoffLabel(target)}…`,
          });
          pushTrace({ type: 'handoff', agent: target });
        }
        activeAgent = target;
        await setActiveAgent(conversation.id, target);
      } else {
        activeAgent = 'unknown';
        await setActiveAgent(conversation.id, 'unknown');
        if (route.confidence < 0.5) {
          await recordProductSignal(input.siteId, input.message);
        }
      }
    }

    const specialist = isSpecialist(activeAgent)
      ? getSpecialistConfig(activeAgent)
      : null;

    const allActions = await getActiveActions(input.siteId);
    const scopedActions = specialist
      ? mergeActionsForAgent(allActions, specialist.name)
      : allActions;

    const tools = actionsToTools(scopedActions);
    const actionMap = new Map(scopedActions.map((a) => [a.operation_id, a]));

    if (scopedActions.length === 0) {
      const noToolsMsg =
        `I don't have access to ${site.name}'s backend APIs yet. ` +
        'The site owner needs to connect an OpenAPI spec and activate actions in the Nexus dashboard.';
      yield sse({ type: 'token', content: noToolsMsg });
      await saveMessage(conversation.id, 'assistant', noToolsMsg);
      yield sse({ type: 'trace', steps: trace });
      yield sse({ type: 'done' });
      return;
    }

    const history = await getConversationMessages(conversation.id);
    const llmMessages: ChatMessage[] = [
      {
        role: 'system',
        content: buildOrchestratorSystemPrompt(site, specialist, scopedActions),
      },
      ...history
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as ChatMessage['role'],
          content: m.content ?? '',
        })),
    ];

    const scopedPayload: ScopedJwtPayload = {
      site_id: input.siteId,
      visitor_id: input.visitorId,
      allowed_operation_ids: scopedActions.map((a) => a.operation_id),
    };

    let iterations = 0;
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      const completion = await chatCompletion({
        messages: llmMessages,
        tools,
        toolChoice: iterations === 1 && !smallTalk ? 'required' : 'auto',
        signal: input.signal,
      });
      trackTokens(completion.tokens_used);

      if (completion.tool_calls?.length) {
        llmMessages.push({
          role: 'assistant',
          content: completion.content ?? '',
        });

        for (const toolCall of completion.tool_calls) {
          const opId = toolCall.function.name;
          yield statusEvent('fetching', `Looking up ${opId.replace(/_/g, ' ')}…`);
          const action = actionMap.get(opId);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            args = {};
          }

          pushTrace({ type: 'tool_call', agent: activeAgent, detail: opId });

          if (!action) {
            llmMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: opId,
              content: JSON.stringify({ error: 'Action not found' }),
            });
            continue;
          }

          const result = await handleToolCall({
            action,
            args,
            site,
            conversationId: conversation.id,
            scopedPayload,
            pushTrace,
            trackTokens,
          });

          if (result.approvalEvent) {
            yield sse(result.approvalEvent);
          }
          if (result.undoEvent) {
            yield sse(result.undoEvent);
          }

          llmMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: opId,
            content: JSON.stringify(result.toolResult),
          });

          pushTrace({
            type: 'tool_result',
            agent: activeAgent,
            detail: `${opId}: ${result.summary}`,
          });
        }
        continue;
      }

      // First pass skipped tools — force API lookup before answering from general knowledge
      if (iterations === 1 && tools.length > 0 && !smallTalk) {
        llmMessages.push({
          role: 'system',
          content:
            'You must call at least one backend API tool before answering. Do not use general knowledge for organization-specific questions.',
        });
        continue;
      }

      break;
    }

    yield statusEvent('writing', 'Composing answer…');

    // Stream final response token-by-token from the LLM (ChatGPT-style)
    let fullResponse = '';
    for await (const token of streamChat({
      messages: llmMessages,
      signal: input.signal,
      onUsage: (u) => trackTokens(u.total_tokens),
    })) {
      fullResponse += token;
      yield sse({ type: 'token', content: token });
    }

    if (sessionTokens > 0 && tenantId) {
      await incrementUsage(tenantId, 'tokens_used', sessionTokens);
    }
    if (sessionTokens > 0) {
      await queryOne(
        `UPDATE conversations SET tokens_used = tokens_used + $1 WHERE id = $2`,
        [sessionTokens, conversation.id],
      );
    }

    if (fullResponse) {
      await saveMessage(
        conversation.id,
        'assistant',
        fullResponse,
        activeAgent === 'unknown' ? undefined : activeAgent,
      );
    }

    yield sse({ type: 'trace', steps: trace });
    yield sse({ type: 'done' });
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Orchestrator error';
    yield sse({ type: 'error', message });
    yield sse({ type: 'done' });
  }
}

async function handleToolCall(ctx: {
  action: ActionRow;
  args: Record<string, unknown>;
  site: SiteRow;
  conversationId: string;
  scopedPayload: ScopedJwtPayload;
  pushTrace: (step: Omit<OrchestratorTraceStep, 'timestamp'>) => void;
  trackTokens: (n: number) => void;
}): Promise<{
  toolResult: unknown;
  summary: string;
  approvalEvent?: SseEvent;
  undoEvent?: SseEvent;
}> {
  const { action, args, site, conversationId, scopedPayload } = ctx;
  const tier = action.risk_tier as RiskTier;

  if (tier === 'irreversible_write' || tier === 'financial') {
    const execution = await createExecution(conversationId, action.id, args, 'pending_approval');
    const approvalToken = mintApprovalToken(execution.id, config.jwtSecret);
    await queryOne(
      'UPDATE action_executions SET approval_token_hash = $1 WHERE id = $2',
      [hashToken(approvalToken), execution.id],
    );

    const { text: summary } = await completeChat({
      model: config.llm.fallbackModel,
      messages: [
        {
          role: 'system',
          content: 'Summarize in one sentence what this API action will do for the customer.',
        },
        {
          role: 'user',
          content: `${action.method} ${action.path}\nArgs: ${JSON.stringify(args)}\nRisk: ${tier}`,
        },
      ],
      onUsage: (u) => ctx.trackTokens(u.total_tokens),
    });

    ctx.pushTrace({ type: 'approval', detail: action.operation_id });

    return {
      toolResult: { status: 'pending_approval', executionId: execution.id },
      summary: 'pending approval',
      approvalEvent: {
        type: 'approval_card',
        executionId: execution.id,
        token: approvalToken,
        summary: summary.trim(),
        operationId: action.operation_id,
        method: action.method,
        path: action.path,
        riskTier: tier,
      },
    };
  }

  const { status, body } = await executeAction(site, action, args, scopedPayload);
  const execution = await createExecution(
    conversationId,
    action.id,
    args,
    'executed',
    body,
    tier === 'reversible_write'
      ? new Date(Date.now() + UNDO_MINUTES * 60 * 1000)
      : null,
  );

  let undoEvent: SseEvent | undefined;
  if (tier === 'reversible_write') {
    undoEvent = {
      type: 'undo_available',
      executionId: execution.id,
      undoDeadline: execution.undo_deadline,
      operationId: action.operation_id,
    };
    ctx.pushTrace({ type: 'undo', detail: execution.id });
  }

  return {
    toolResult: { status, body },
    summary: `executed (${status})`,
    undoEvent,
  };
}

async function createExecution(
  conversationId: string,
  actionId: string,
  payload: Record<string, unknown>,
  status: string,
  response?: unknown,
  undoDeadline?: Date | null,
): Promise<{ id: string; undo_deadline?: string | null }> {
  const row = await queryOne<{ id: string; undo_deadline: string | null }>(
    `INSERT INTO action_executions (conversation_id, action_id, request_payload, response_payload, status, undo_deadline, executed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, undo_deadline`,
    [
      conversationId,
      actionId,
      JSON.stringify(payload),
      response ? JSON.stringify(response) : null,
      status,
      undoDeadline ?? null,
      status === 'executed' ? new Date() : null,
    ],
  );
  if (!row) throw new Error('Failed to create execution');
  return row;
}

export async function approveExecution(
  token: string,
): Promise<{ success: boolean; message: string }> {
  const { verifyApprovalToken } = await import('./scopedJwt');
  const { executionId } = verifyApprovalToken(token, config.jwtSecret);

  const execution = await queryOne<{
    id: string;
    conversation_id: string;
    action_id: string;
    request_payload: Record<string, unknown>;
    status: string;
    approval_token_hash: string | null;
  }>(
    `SELECT ae.*, ae.request_payload FROM action_executions ae WHERE ae.id = $1`,
    [executionId],
  );

  if (!execution || execution.status !== 'pending_approval') {
    return { success: false, message: 'Invalid or expired approval' };
  }

  if (execution.approval_token_hash !== hashToken(token)) {
    return { success: false, message: 'Token mismatch' };
  }

  const action = await queryOne<ActionRow>(
    `SELECT id, site_id, operation_id, method, path, description, input_schema, risk_tier, compensating_action_id
     FROM actions WHERE id = $1`,
    [execution.action_id],
  );
  if (!action) return { success: false, message: 'Action not found' };

  const conv = await queryOne<{ site_id: string; visitor_id: string }>(
    'SELECT site_id, visitor_id FROM conversations WHERE id = $1',
    [execution.conversation_id],
  );
  if (!conv) return { success: false, message: 'Conversation not found' };

  const site = await getSiteById(conv.site_id);
  if (!site) return { success: false, message: 'Site not found' };

  const scoped: ScopedJwtPayload = {
    site_id: conv.site_id,
    visitor_id: conv.visitor_id,
    allowed_operation_ids: [action.operation_id],
  };

  const { status, body } = await executeAction(
    site,
    action,
    execution.request_payload ?? {},
    scoped,
  );

  await queryOne(
    `UPDATE action_executions SET status = 'executed', response_payload = $1, executed_at = now() WHERE id = $2`,
    [JSON.stringify({ status, body }), executionId],
  );

  return { success: true, message: 'Action executed' };
}

export async function undoExecution(executionId: string): Promise<{ success: boolean; message: string }> {
  const execution = await queryOne<{
    id: string;
    action_id: string;
    conversation_id: string;
    status: string;
    undo_deadline: string | null;
  }>('SELECT * FROM action_executions WHERE id = $1', [executionId]);

  if (!execution || execution.status !== 'executed') {
    return { success: false, message: 'Execution not found or not undoable' };
  }

  if (execution.undo_deadline && new Date(execution.undo_deadline) < new Date()) {
    return { success: false, message: 'Undo window expired' };
  }

  const action = await queryOne<ActionRow>(
    `SELECT a.*, ca.operation_id AS comp_op
     FROM actions a
     LEFT JOIN actions ca ON ca.id = a.compensating_action_id
     WHERE a.id = $1`,
    [execution.action_id],
  );

  const conv = await queryOne<{ site_id: string; visitor_id: string }>(
    'SELECT site_id, visitor_id FROM conversations WHERE id = $1',
    [execution.conversation_id],
  );
  if (!conv || !action) return { success: false, message: 'Not found' };

  const site = await getSiteById(conv.site_id);
  if (!site) return { success: false, message: 'Site not found' };

  if (action.compensating_action_id) {
    const compAction = await queryOne<ActionRow>(
      'SELECT * FROM actions WHERE id = $1',
      [action.compensating_action_id],
    );
    if (compAction) {
      const scoped: ScopedJwtPayload = {
        site_id: conv.site_id,
        visitor_id: conv.visitor_id,
        allowed_operation_ids: [compAction.operation_id],
      };
      await executeAction(site, compAction, {}, scoped);
    }
  }

  await queryOne(
    `UPDATE action_executions SET status = 'undone', undone_at = now() WHERE id = $1`,
    [executionId],
  );

  return { success: true, message: 'Action undone' };
}
