import { RiskTier } from '@nexus/shared-types';
import { config } from '../config';
import { handoffLabel, heuristicRoute, routeMessage } from '../agents/router';
import {
  getSourceTypesForRouting,
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
import { isHumanHandled, requestEscalation } from './escalations';
import { shouldTriggerGuardrail } from './chatGuardrails';
import {
  formatMemoriesForPrompt,
  getVisitorMemories,
  resolveVisitorId,
} from './visitorMemory';
import {
  finalizeLeadCapture,
  looksLikeContactSubmission,
  tryAutoSaveContactFromMessage,
} from './contactLeadHandler';
import {
  contactCollectionToolDefinition,
  formatContactForPrompt,
  getVisitorContact,
  SAVE_VISITOR_CONTACT_TOOL,
  upsertVisitorContact,
} from './visitorContacts';
import { getWidgetConfig } from './widgetConfig';
import {
  COMPACT_TOOL_CATALOG_THRESHOLD,
  trimHistory,
  prepareToolResultForLlm,
  hasUnansweredPriorUserTurn,
} from './tokenOptimization';
import { dispatchWebhook } from './webhooks';
import {
  buildCacheKey,
  getCachedToolResult,
  invalidateConversationToolCache,
  setCachedToolResult,
} from './toolResultCache';
import type { ProvenanceEntry } from '../agents/types';

const MAX_TOOL_ITERATIONS = 3;

/** Collapse near-duplicate OpenAPI ops (e.g. two conference list endpoints). */
function toolFamilyKey(operationId: string, path?: string): string {
  const hay = `${operationId} ${path ?? ''}`.toLowerCase();
  if (/conference/.test(hay)) return 'family:conferences';
  if (/\bfaq\b/.test(hay)) return 'family:faq';
  if (/order/.test(hay)) return 'family:orders';
  if (/product/.test(hay) && !/conference/.test(hay)) return 'family:products';
  return operationId;
}
const UNDO_MINUTES = 5;

function isSmallTalk(message: string): boolean {
  const t = message.trim().toLowerCase();
  return /^(hi|hello|hey|howdy|good\s+(morning|afternoon|evening)|thanks|thank you|ok|okay|bye|goodbye)[!.?\s]*$/i.test(
    t,
  );
}

/**
 * Short conversational nudges / check-ins — answer without forcing API tools.
 * Forcing tools on these (with slow reasoning models) often times out mid-turn.
 */
function shouldSkipForcedTools(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (isSmallTalk(t)) return true;
  return /^(are you (there|ok|online)\??|you there\??|still there\??|anyone there\??|what'?s going on\??|what happened\??|what is going on\??|hello\??|hi\??|help\??|please (try again|help)|try again|status\??)[!.?\s]*$/i.test(
    t,
  );
}

/** Heuristic: GLM sometimes puts chain-of-thought in `content` when extraction falls back. */
function looksLikeInternalReasoning(text: string): boolean {
  const t = text.trim();
  if (t.length < 40) return false;
  return (
    /^\s*(\d+\.\s*)?\*\*Analyze the Request\*\*/i.test(t) ||
    /^\s*1\.\s+\*\*Analyze/i.test(t) ||
    /\bchain of thought\b/i.test(t) ||
    /\bFormulate the Response\b/i.test(t)
  );
}

/** True when the model is asking the visitor for missing info (not performing a lookup). */
function looksLikeClarifyingQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!/[?？]/.test(t) && !/\b(please (provide|share|send|give)|could you|can you)\b/i.test(t)) {
    return false;
  }
  // Reject performative "looking up" messages that aren't real questions
  if (/\b(looking (it|that) up|let me (check|look|fetch)|i('ll| will) (check|look|fetch))\b/i.test(t)) {
    return false;
  }
  return true;
}

function resolveToolName(
  rawName: string,
  knownNames: Iterable<string>,
): string | null {
  const names = [...knownNames];
  if (names.includes(rawName)) return rawName;
  const stripped = rawName.replace(/__\d+(?:__\d+)*$/g, '');
  if (names.includes(stripped)) return stripped;
  const hit = names.find((n) => rawName.startsWith(n) || n.startsWith(stripped));
  return hit ?? null;
}

/**
 * Some models (e.g. GLM via OpenRouter) emit tool calls as plain text instead of
 * structured tool_calls — including broken forms like:
 *   <tool_call>orders__post_api_v1_chat_orders(null)
 *   orders__post_api_v1_chat_orders()
 * Recover those so the LLM-driven flow still executes APIs.
 */
function parseEmbeddedToolCalls(
  content: string,
  knownNames: Iterable<string>,
): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> {
  const out: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }> = [];
  const seen = new Set<string>();
  const push = (rawName: string, rawArgs: string | undefined) => {
    const resolved = resolveToolName(rawName, knownNames);
    if (!resolved || seen.has(resolved)) return;
    let argumentsJson = '{}';
    if (rawArgs && rawArgs.trim() && !/^(null|undefined)$/i.test(rawArgs.trim())) {
      try {
        JSON.parse(rawArgs);
        argumentsJson = rawArgs;
      } catch {
        argumentsJson = '{}';
      }
    }
    seen.add(resolved);
    out.push({
      id: `embedded_${Date.now()}_${out.length}`,
      type: 'function',
      function: { name: resolved, arguments: argumentsJson },
    });
  };

  // <tool_call>name({...})</tool_call>  OR  name({...})  OR  name(null)  OR  name()
  // Prefer names that look like operation ids (contain __) to avoid false positives.
  const callRe =
    /(?:<tool_call>\s*)?([a-zA-Z][a-zA-Z0-9_]*(?:__[a-zA-Z0-9_]+)+)\s*\(\s*(\{[\s\S]*?\}|null|undefined|)\s*\)?/gi;
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(content)) !== null) {
    push(match[1], match[2]);
  }

  // Incomplete truncated tags: <tool_call>orders__post_api_v1_chat_orders(null
  const incompleteRe = /<tool_call>\s*([a-zA-Z][a-zA-Z0-9_]*(?:__[a-zA-Z0-9_]+)+)\s*\(/gi;
  while ((match = incompleteRe.exec(content)) !== null) {
    push(match[1], '{}');
  }

  return out;
}

function stripEmbeddedToolCallText(content: string): string {
  return content
    .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, ' ')
    .replace(/<\/?tool_call>/gi, ' ')
    // Only strip OpenAPI-style operation ids (contain __), not normal prose.
    .replace(
      /\b[a-zA-Z][a-zA-Z0-9_]*__[a-zA-Z0-9_]+\s*\(\s*(?:\{[\s\S]*?\}|null|undefined|)?\s*\)?/gi,
      ' ',
    )
    .replace(/\bwithstand\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stillLooksLikeToolMarkup(content: string): boolean {
  return /<tool_call>|<\/tool_call>|[a-zA-Z0-9_]+__[a-zA-Z0-9_]+\s*\(/i.test(content);
}

function extractEmail(text: string): string | null {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? null;
}

function extractOrderOrRegistrationId(text: string): string | null {
  const tagged = text.match(/\b(?:ORD|REG)-[A-Z0-9-]+\b/i);
  if (tagged) return tagged[0];

  // Only accept explicitly labeled identifiers, not phrases like "order details"
  const labeled = text.match(
    /\b(?:order|registration)\s*(?:#|number|id|no\.?)\s*[:=\-]?\s*([A-Z0-9][A-Z0-9-]{4,})\b/i,
  );
  if (!labeled?.[1]) return null;
  const value = labeled[1];
  // Reject common English words accidentally captured after "order number"
  if (
    /^(details|status|lookup|information|please|number|email|address)$/i.test(value)
  ) {
    return null;
  }
  return value;
}

function hasOrderIntent(text: string): boolean {
  return /\border(s)?\b|\bpurchase\b|\bregistration\b|\binvoice\b|\breceipt\b/i.test(text);
}

function isRegistrationNumber(id: string): boolean {
  return /^REG-/i.test(id) || /^\d{4}-[A-Z]{3}-/i.test(id);
}

function buildOrderLookupArgs(
  email: string,
  orderOrRegId: string,
): Record<string, string> {
  if (isRegistrationNumber(orderOrRegId) && !/^ORD-/i.test(orderOrRegId)) {
    return { email, registrationNumber: orderOrRegId };
  }
  return { email, orderNumber: orderOrRegId };
}

/** After the LLM chooses the orders tool, fill missing dual-factor fields from chat text. */
function enrichOrderToolArgs(
  args: Record<string, unknown>,
  message: string,
  historyText: string,
): Record<string, unknown> {
  const email =
    (typeof args.email === 'string' && args.email) ||
    extractEmail(message) ||
    extractEmail(historyText);
  const existingId =
    (typeof args.orderNumber === 'string' && args.orderNumber) ||
    (typeof args.registrationNumber === 'string' && args.registrationNumber) ||
    null;
  const id =
    existingId ||
    extractOrderOrRegistrationId(message) ||
    extractOrderOrRegistrationId(historyText);
  if (!email || !id) return args;
  return { ...args, ...buildOrderLookupArgs(email, id) };
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

  let conversationIdForRecovery: string | null = null;
  let assistantReplySaved = false;

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

    const visitorId = await resolveVisitorId(input.siteId, input.visitorId);

    const conversation = await getOrCreateConversation(
      input.siteId,
      visitorId,
      input.conversationId,
    );
    conversationIdForRecovery = conversation.id;

    yield sse({
      type: 'conversation',
      conversationId: conversation.id,
    });

    const isNewConversation = !input.conversationId;
    if (tenantId && isNewConversation) {
      void dispatchWebhook(tenantId, 'conversation.started', {
        conversationId: conversation.id,
        siteId: input.siteId,
        visitorId,
      });
    }

    if (isHumanHandled(conversation.status)) {
      await saveMessage(conversation.id, 'user', input.message);

      if (tenantId) {
        void dispatchWebhook(tenantId, 'message.user', {
          conversationId: conversation.id,
          siteId: input.siteId,
          visitorId,
          message: input.message,
        });
      }

      yield sse({
        type: 'token',
        content:
          conversation.status === 'human'
            ? 'Your message was sent to our team. They will reply shortly.'
            : 'You are in the queue for a team member. Hang tight — someone will join soon.',
      });
      yield sse({ type: 'trace', steps: trace });
      yield sse({ type: 'done' });
      return;
    }

    const guardrail = await shouldTriggerGuardrail(input.siteId, conversation.id);
    if (guardrail.trigger) {
      await saveMessage(conversation.id, 'user', input.message);

      if (tenantId) {
        void dispatchWebhook(tenantId, 'message.user', {
          conversationId: conversation.id,
          siteId: input.siteId,
          visitorId,
          message: input.message,
        });
      }

      await requestEscalation(
        input.siteId,
        visitorId,
        conversation.id,
        'Automatic handoff: conversation message limit reached',
      );

      yield sse({ type: 'guardrail', ...guardrail.payload });
      yield sse({ type: 'trace', steps: trace });
      yield sse({ type: 'done' });
      return;
    }

    await saveMessage(conversation.id, 'user', input.message);

    if (tenantId) {
      void dispatchWebhook(tenantId, 'message.user', {
        conversationId: conversation.id,
        siteId: input.siteId,
        visitorId,
        message: input.message,
      });
    }

    if (tenantId) {
      await incrementUsage(tenantId, 'conversations_count');
    }

    const widgetConfig = await getWidgetConfig(input.siteId);
    const contactCollection =
      widgetConfig.theme.contactCollectionEnabled !== false;

    let contactJustSaved = false;
    if (contactCollection) {
      const priorMessages = (await getConversationMessages(conversation.id)).filter(
        (m) => m.role !== 'system',
      );
      const lastAssistant = [...priorMessages]
        .reverse()
        .find((m) => m.role === 'assistant');
      const recentAssistantText = lastAssistant?.content ?? '';

      const autoSaved = await tryAutoSaveContactFromMessage(
        input.siteId,
        visitorId,
        input.message,
        recentAssistantText,
      );
      if (autoSaved) {
        await finalizeLeadCapture({
          siteId: input.siteId,
          visitorId,
          conversationId: conversation.id,
          tenantId,
          contact: autoSaved.contact,
          created: autoSaved.created,
        });
        contactJustSaved = true;
      }
    }

    yield statusEvent('thinking', 'Understanding your question…');

    let sessionTokens = 0;
    const trackTokens = (n: number) => {
      if (n > 0) sessionTokens += n;
    };

    const smallTalk = shouldSkipForcedTools(input.message);
    let activeAgent: AgentName = (conversation.active_agent as AgentName) || 'router';

    // Re-route when starting fresh or the latest message clearly needs another specialist.
    const heuristic = heuristicRoute(input.message);
    const shouldReroute =
      activeAgent === 'router' ||
      !activeAgent ||
      (heuristic != null &&
        heuristic.confidence >= 0.7 &&
        heuristic.agent !== activeAgent &&
        heuristic.agent !== 'unknown');

    if (shouldReroute) {
      // Always use the LLM router (heuristic is fallback inside routeMessage).
      const route = await routeMessage(input.message, trackTokens);
      pushTrace({
        type: 'route',
        agent: route.agent,
        detail: `confidence=${route.confidence} ${route.reasoning ?? ''}`,
      });

      const target = specialistOrUnknown(route.agent);
      if (target !== 'unknown') {
        if (activeAgent !== target && activeAgent !== 'router') {
          yield sse({
            type: 'handoff',
            from: activeAgent,
            to: target,
            label: `Connecting you to ${handoffLabel(target)}…`,
          });
          pushTrace({ type: 'handoff', agent: target });
        } else if (activeAgent === 'router') {
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
    const sourceTypes = specialist ? await getSourceTypesForRouting() : [];
    const scopedActions = specialist
      ? mergeActionsForAgent(allActions, specialist.name, sourceTypes)
      : allActions;

    // Give the LLM every active tool so it can map intent (any language) to the right API.
    // Specialist prompt still steers preference; JWT allow-list also includes all actions.
    const toolActions = allActions.length > 0 ? allActions : scopedActions;
    const tools = actionsToTools(toolActions);
    const actionMap = new Map(toolActions.map((a) => [a.operation_id, a]));

    const contactTurn =
      contactCollection && looksLikeContactSubmission(input.message);
    const allTools = contactCollection
      ? [...tools, contactCollectionToolDefinition()]
      : tools;

    if (toolActions.length === 0) {
      const noToolsMsg =
        `I don't have access to ${site.name}'s backend APIs yet. ` +
        'The site owner needs to connect an OpenAPI spec and activate actions in the Nexus dashboard.';
      yield sse({ type: 'token', content: noToolsMsg });
      await saveMessage(conversation.id, 'assistant', noToolsMsg);
      yield sse({ type: 'trace', steps: trace });
      yield sse({ type: 'done' });
      return;
    }

    const memories = await getVisitorMemories(input.siteId, visitorId);
    const memoryContext = formatMemoriesForPrompt(memories);
    const contact = contactCollection
      ? await getVisitorContact(input.siteId, visitorId)
      : null;
    let contactContext = contactCollection
      ? formatContactForPrompt(contact)
      : undefined;
    if (contactJustSaved && contactContext) {
      contactContext +=
        '\n\n(Contact details were saved automatically this turn — confirm them to the visitor; do not call save_visitor_contact again unless they want to update.)';
    }

    // Multi-step mission plan (when intent spans multiple API actions)
    try {
      const { maybeCreateMissionPlan } = await import('./missionPlans');
      const mission = await maybeCreateMissionPlan({
        conversationId: conversation.id,
        siteId: input.siteId,
        visitorId,
        message: input.message,
        actions: scopedActions,
        trackTokens,
      });
      if (mission) {
        yield sse({
          type: 'mission_plan',
          missionId: mission.id,
          title: mission.title,
          currentStep: mission.current_step,
          steps: mission.steps,
          status: mission.status,
        });
        pushTrace({
          type: 'tool_call',
          agent: activeAgent,
          detail: `mission_plan:${mission.id}`,
        });
      }
    } catch {
      // non-fatal — continue without mission UI
    }

    const history = trimHistory(
      (await getConversationMessages(conversation.id)).filter((m) => m.role !== 'system'),
    );
    const llmMessages: ChatMessage[] = [
      {
        role: 'system',
        content: buildOrchestratorSystemPrompt(
          site,
          specialist,
          scopedActions,
          memoryContext,
          contactContext,
          {
            compactTools: scopedActions.length > COMPACT_TOOL_CATALOG_THRESHOLD,
            contactCollection,
          },
        ),
      },
      ...history.map((m) => ({
        role: m.role as ChatMessage['role'],
        content: m.content ?? '',
      })),
    ];

    if (hasUnansweredPriorUserTurn(history)) {
      llmMessages.push({
        role: 'system',
        content:
          'History may include an earlier user message that never received a reply. Answer ONLY the visitor\'s latest message. Do not combine old and new questions into one reply unless the latest message clearly continues the earlier one.',
      });
    }

    // Always let the LLM interpret intent (any language / informal phrasing).
    llmMessages.push({
      role: 'system',
      content:
        'Understand what the visitor wants even if the message is informal, incomplete, misspelled, or in another language. Infer intent from meaning, not exact English keywords. Call the right backend tool(s) when live data is needed; ask concise clarifying questions when required fields are missing. Never invent organization-specific facts.',
    });

    const scopedPayload: ScopedJwtPayload = {
      site_id: input.siteId,
      visitor_id: visitorId,
      allowed_operation_ids: (allActions.length ? allActions : scopedActions).map(
        (a) => a.operation_id,
      ),
    };

    let iterations = 0;
    const provenance: ProvenanceEntry[] = [];
    let usedCachedResult = false;
    let forceToolNext = false;
    /** Same operation successfully fetched once this turn — do not re-call. */
    const fetchedOps = new Set<string>();
    let historyText = llmMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => m.content)
      .join('\n');

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      historyText = llmMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => m.content)
        .join('\n');

      // Let the LLM decide tools. Only skip tools for pure greetings/check-ins.
      let toolChoice:
        | 'auto'
        | 'required'
        | 'none'
        | { type: 'function'; function: { name: string } } = forceToolNext
          ? 'required'
          : 'auto';
      if (iterations === 1 && (smallTalk || contactTurn) && !forceToolNext) {
        toolChoice = 'none';
      }
      // After we already have live data, stop tool looping and compose.
      if (fetchedOps.size > 0 && iterations >= 2 && !forceToolNext) {
        toolChoice = 'none';
      }
      forceToolNext = false;

      let completion;
      try {
        completion = await chatCompletion({
          messages: llmMessages,
          tools: allTools.length > 0 && toolChoice !== 'none' ? allTools : undefined,
          toolChoice: toolChoice === 'none' ? 'none' : toolChoice,
          signal: input.signal,
        });
      } catch (toolLoopErr) {
        // Client disconnect must reach the outer catch so a recovery reply is persisted.
        const aborted =
          Boolean(input.signal?.aborted) ||
          (toolLoopErr instanceof Error &&
            (toolLoopErr.name === 'AbortError' ||
              /(?:^|\b)aborted\b|AbortError/i.test(toolLoopErr.message)));
        if (aborted) throw toolLoopErr;
        console.warn('[orchestrator] tool-loop chatCompletion failed', toolLoopErr);
        break;
      }
      trackTokens(completion.tokens_used);

      const knownToolNames = [
        ...new Set([
          ...actionMap.keys(),
          ...allActions.map((a) => a.operation_id),
          ...(contactCollection ? [SAVE_VISITOR_CONTACT_TOOL] : []),
        ]),
      ];
      let toolCalls = completion.tool_calls;
      if (!toolCalls?.length && completion.content) {
        const embedded = parseEmbeddedToolCalls(completion.content, knownToolNames);
        if (embedded.length) {
          console.info(
            '[orchestrator] recovered embedded tool call(s) from model text:',
            embedded.map((t) => t.function.name).join(', '),
          );
          toolCalls = embedded;
        }
      }

      if (toolCalls?.length) {
        const cleanAssistant = stripEmbeddedToolCallText(completion.content ?? '');
        llmMessages.push({
          role: 'assistant',
          content: cleanAssistant,
        });

        for (const toolCall of toolCalls) {
          const opId = toolCall.function.name;
          if (opId === SAVE_VISITOR_CONTACT_TOOL) {
            yield statusEvent('saving', 'Saving your contact details…');
          } else {
            yield statusEvent('fetching', `Looking up ${opId.replace(/_/g, ' ')}…`);
          }
          const action =
            actionMap.get(opId) ??
            allActions.find((a) => a.operation_id === opId) ??
            undefined;
          let args: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(toolCall.function.arguments || '{}') as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              args = parsed as Record<string, unknown>;
            }
          } catch {
            args = {};
          }

          // Help the model: fill missing order identifiers from the conversation
          // after the LLM decided to call the orders tool (intent still came from LLM).
          if (/order/i.test(opId) || /\/orders\b/i.test(action?.path ?? '')) {
            args = enrichOrderToolArgs(args, input.message, historyText);
          }

          pushTrace({ type: 'tool_call', agent: activeAgent, detail: opId });

          const family = toolFamilyKey(opId, action?.path);
          if (fetchedOps.has(opId) || fetchedOps.has(family)) {
            llmMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: opId,
              content: JSON.stringify({
                ok: true,
                note: 'Already fetched earlier in this turn — reuse that result. Do not call this tool again.',
              }),
            });
            pushTrace({
              type: 'tool_result',
              agent: activeAgent,
              detail: `${opId}: skipped duplicate`,
            });
            continue;
          }

          if (opId === SAVE_VISITOR_CONTACT_TOOL) {
            let contactResult: Record<string, unknown>;
            try {
              const saved = await upsertVisitorContact(input.siteId, visitorId, {
                name: args.name as string | undefined,
                email: args.email as string | undefined,
                phone: args.phone as string | undefined,
                country: args.country as string | undefined,
                company: args.company as string | undefined,
                consent: args.consent === true,
                source: 'chat',
              });
              await finalizeLeadCapture({
                siteId: input.siteId,
                visitorId,
                conversationId: conversation.id,
                tenantId,
                contact: saved.contact,
                created: saved.created,
              });
              contactResult = { ok: true, saved: true, contactId: saved.contact.id };
            } catch (err) {
              contactResult = {
                ok: false,
                error: err instanceof Error ? err.message : 'Failed to save contact',
              };
            }
            llmMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: opId,
              content: JSON.stringify(contactResult),
            });
            pushTrace({
              type: 'tool_result',
              agent: activeAgent,
              detail: `${opId}: ${contactResult.ok ? 'saved' : 'failed'}`,
            });
            continue;
          }

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
            visitorId,
            scopedPayload,
            pushTrace,
            trackTokens,
          });

          if (result.fromCache) usedCachedResult = true;

          provenance.push({
            operationId: action.operation_id,
            method: action.method,
            path: action.path,
            sourceType: action.source_type ?? null,
            cached: Boolean(result.fromCache),
            status: result.httpStatus ?? (result.approvalEvent ? 'pending_approval' : 'ok'),
            at: new Date().toISOString(),
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
            content: JSON.stringify(prepareToolResultForLlm(result.toolResult, site.domain)),
          });

          pushTrace({
            type: 'tool_result',
            agent: activeAgent,
            detail: `${opId}: ${result.summary}`,
          });
          fetchedOps.add(opId);
          fetchedOps.add(family);
        }
        // One successful data round is enough — compose instead of letting the
        // model re-query conferences/FAQ for 60–90s (browsers drop those turns).
        if (fetchedOps.size > 0) {
          llmMessages.push({
            role: 'system',
            content:
              'You have live tool results above. Answer the visitor now using only those results. Do not call more tools.',
          });
        }
        continue;
      }

      // No tool call: clarifying question is fine; fake "I'll look it up" / leaked
      // <tool_call> markup must retry with tools.
      const assistantText = (completion.content ?? '').trim();
      const leakedToolMarkup = stillLooksLikeToolMarkup(assistantText);
      if (
        tools.length > 0 &&
        !smallTalk &&
        !contactTurn &&
        !usedCachedResult &&
        (leakedToolMarkup ||
          (iterations === 1 && !looksLikeClarifyingQuestion(assistantText)))
      ) {
        if (assistantText) {
          llmMessages.push({
            role: 'assistant',
            content: stripEmbeddedToolCallText(assistantText),
          });
        }
        llmMessages.push({
          role: 'system',
          content: leakedToolMarkup
            ? 'Your previous reply leaked a text tool call. Call the backend tool properly now using the function/tool interface (or with JSON object arguments). Do not print <tool_call> tags.'
            : 'You must either call a backend tool now to fetch live data, or ask a short clarifying question if required fields are missing. Do not claim you looked something up without calling a tool. Do not invent facts.',
        });
        forceToolNext = true;
        continue;
      }

      break;
    }

    // Safety net: visitor already gave email + order/registration id, but the model
    // only printed a text tool call and never executed. Run the orders tool once.
    const combinedForOrder = `${input.message}\n${historyText}`;
    const orderEmail = extractEmail(input.message) || extractEmail(combinedForOrder);
    const orderId =
      extractOrderOrRegistrationId(input.message) ||
      extractOrderOrRegistrationId(combinedForOrder);
    if (
      orderEmail &&
      orderId &&
      !fetchedOps.has('family:orders') &&
      (hasOrderIntent(input.message) || hasOrderIntent(combinedForOrder))
    ) {
      const ordersAction =
        allActions.find(
          (a) =>
            /order/i.test(a.operation_id) || /\/orders\b/i.test(a.path ?? ''),
        ) ??
        scopedActions.find(
          (a) =>
            /order/i.test(a.operation_id) || /\/orders\b/i.test(a.path ?? ''),
        );
      if (ordersAction) {
        yield statusEvent(
          'fetching',
          `Looking up ${ordersAction.operation_id.replace(/_/g, ' ')}…`,
        );
        const args = enrichOrderToolArgs({}, input.message, historyText);
        pushTrace({
          type: 'tool_call',
          agent: activeAgent,
          detail: ordersAction.operation_id,
        });
        const result = await handleToolCall({
          action: ordersAction,
          args,
          site,
          conversationId: conversation.id,
          visitorId,
          scopedPayload,
          pushTrace,
          trackTokens,
        });
        if (result.fromCache) usedCachedResult = true;
        provenance.push({
          operationId: ordersAction.operation_id,
          method: ordersAction.method,
          path: ordersAction.path,
          sourceType: ordersAction.source_type ?? null,
          cached: Boolean(result.fromCache),
          status: result.httpStatus ?? (result.approvalEvent ? 'pending_approval' : 'ok'),
          at: new Date().toISOString(),
        });
        if (result.approvalEvent) yield sse(result.approvalEvent);
        if (result.undoEvent) yield sse(result.undoEvent);
        llmMessages.push({
          role: 'assistant',
          content: '',
        });
        llmMessages.push({
          role: 'tool',
          tool_call_id: `forced_order_${Date.now()}`,
          name: ordersAction.operation_id,
          content: JSON.stringify(prepareToolResultForLlm(result.toolResult, site.domain)),
        });
        llmMessages.push({
          role: 'system',
          content:
            'Order lookup tool results are above. Answer the visitor with the real order status. Do not print tool call markup.',
        });
        fetchedOps.add(ordersAction.operation_id);
        fetchedOps.add('family:orders');
        pushTrace({
          type: 'tool_result',
          agent: activeAgent,
          detail: `${ordersAction.operation_id}: ${result.summary}`,
        });
      }
    }

    yield statusEvent('writing', 'Composing answer…');

    // Final visitor reply: use non-streaming completion.
    // Reasoning models (e.g. z-ai/glm-5.2) often stream only `reasoning` with empty
    // `content`, so streaming looks hung until timeout — then visitors see recovery text.
    let fullResponse = '';
    try {
      const final = await chatCompletion({
        messages: [
          ...llmMessages,
          {
            role: 'system',
            content:
              'Write the final visitor-facing reply now in markdown. Use short paragraphs and bullet lists (- ) with one field per line for order/registration/status details — never a single run-on paragraph. Do not include hidden reasoning, chain-of-thought, or tool-call markup.',
          },
        ],
        toolChoice: 'none',
        signal: input.signal,
      });
      trackTokens(final.tokens_used);
      fullResponse = stripEmbeddedToolCallText((final.content ?? '').trim());
      // Never surface model reasoning or leaked tool markup as the visitor reply
      if (fullResponse && looksLikeInternalReasoning(fullResponse)) {
        fullResponse = '';
      }
      if (fullResponse && stillLooksLikeToolMarkup(fullResponse)) {
        fullResponse = stripEmbeddedToolCallText(fullResponse);
        if (stillLooksLikeToolMarkup(fullResponse)) fullResponse = '';
      }
    } catch (finalErr) {
      console.warn('[orchestrator] final chatCompletion failed', finalErr);
    }

    if (!fullResponse) {
      try {
        for await (const token of streamChat({
          messages: llmMessages,
          signal: input.signal,
          onUsage: (u) => trackTokens(u.total_tokens),
        })) {
          fullResponse += token;
        }
        fullResponse = fullResponse.trim();
      } catch (streamErr) {
        console.warn('[orchestrator] streamChat fallback failed', streamErr);
      }
    }

    if (!fullResponse) {
      if (provenance.length) {
        fullResponse =
          'I found some details in our system, but had trouble wording the reply. Please ask me again and I will summarize what I found.';
      } else if (hasOrderIntent(input.message)) {
        fullResponse =
          "I'd be happy to check your order. Please send your **email** and **order/registration number** together in one message.";
      } else {
        fullResponse =
          'Sorry — I hit a temporary glitch while answering. Please send your question again and I will help right away.';
      }
    }

    // Persist before streaming so a dropped SSE socket cannot leave the user turn unanswered.
    await saveMessage(
      conversation.id,
      'assistant',
      fullResponse,
      activeAgent === 'unknown' ? undefined : activeAgent,
      undefined,
      provenance.length ? { provenance } : undefined,
    );
    assistantReplySaved = true;

    // Emit in small chunks so the widget still feels responsive
    const chunkSize = 48;
    for (let i = 0; i < fullResponse.length; i += chunkSize) {
      yield sse({ type: 'token', content: fullResponse.slice(i, i + chunkSize) });
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

    if (tenantId) {
      void dispatchWebhook(tenantId, 'message.assistant', {
        conversationId: conversation.id,
        siteId: input.siteId,
        visitorId,
        message: fullResponse,
      });
    }

    if (provenance.length) {
      yield sse({ type: 'provenance', sources: provenance });
    }
    yield sse({ type: 'trace', steps: trace });
    yield sse({ type: 'done' });
    return;
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Orchestrator error';
    const friendly =
      /aborted|AbortError/i.test(raw)
        ? 'Sorry — the connection dropped while I was answering. Please send your message again.'
        : raw === 'fetch failed' ||
            raw.includes('ECONNREFUSED') ||
            /timed?\s*out|timeout|unreachable|LLM API/i.test(raw)
          ? 'Sorry — I could not finish that just now. Please try again in a moment, or ask for a human agent.'
          : 'Sorry — something went wrong on my side. Please try your question again.';
    console.error('[orchestrator]', err);

    // Always persist a visitor-visible reply so the turn is never left unanswered in history.
    const needsRecoveryReply = !assistantReplySaved;
    if (needsRecoveryReply && conversationIdForRecovery) {
      try {
        await saveMessage(conversationIdForRecovery, 'assistant', friendly);
        assistantReplySaved = true;
      } catch (saveErr) {
        console.error('[orchestrator] failed to save recovery message', saveErr);
      }
    }

    if (needsRecoveryReply) {
      yield sse({ type: 'token', content: friendly });
    }
    yield sse({ type: 'done' });
  }
}

async function handleToolCall(ctx: {
  action: ActionRow;
  args: Record<string, unknown>;
  site: SiteRow;
  conversationId: string;
  visitorId: string;
  scopedPayload: ScopedJwtPayload;
  pushTrace: (step: Omit<OrchestratorTraceStep, 'timestamp'>) => void;
  trackTokens: (n: number) => void;
}): Promise<{
  toolResult: unknown;
  summary: string;
  approvalEvent?: SseEvent;
  undoEvent?: SseEvent;
  fromCache?: boolean;
  httpStatus?: number;
}> {
  const { action, args, site, conversationId, visitorId, scopedPayload } = ctx;
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

    const redactedArgs = redactPayload(args);

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
        dryRun: {
          method: action.method,
          path: action.path,
          payload: redactedArgs,
          riskTier: tier,
        },
      },
    };
  }

  // Session working memory: reuse recent read-only results
  if (tier === 'read_only') {
    const cacheKey = buildCacheKey({
      siteId: site.id,
      visitorId,
      conversationId,
      operationId: action.operation_id,
      args,
    });
    const cached = await getCachedToolResult(cacheKey);
    if (cached) {
      ctx.pushTrace({
        type: 'cache_hit',
        detail: `${action.operation_id} (cached ${cached.fetchedAt})`,
      });
      return {
        toolResult: { status: cached.status, body: cached.body, fromCache: true },
        summary: `cached (${cached.status})`,
        fromCache: true,
        httpStatus: cached.status,
      };
    }
  }

  const { status, body } = await executeAction(site, action, args, scopedPayload);
  const execution = await createExecution(
    conversationId,
    action.id,
    args,
    status >= 400 ? 'failed' : 'executed',
    body,
    tier === 'reversible_write' && status < 400
      ? new Date(Date.now() + UNDO_MINUTES * 60 * 1000)
      : null,
    status,
  );

  if (tier === 'read_only' && status < 400) {
    const cacheKey = buildCacheKey({
      siteId: site.id,
      visitorId,
      conversationId,
      operationId: action.operation_id,
      args,
    });
    await setCachedToolResult(cacheKey, {
      status,
      body,
      operationId: action.operation_id,
    });
  }

  if (tier !== 'read_only') {
    await invalidateConversationToolCache(site.id, visitorId, conversationId);
  }

  let undoEvent: SseEvent | undefined;
  if (tier === 'reversible_write' && status < 400) {
    undoEvent = {
      type: 'undo_available',
      executionId: execution.id,
      undoDeadline: execution.undo_deadline,
      operationId: action.operation_id,
      summary: `${action.method} ${action.path} can be undone`,
    };
    ctx.pushTrace({ type: 'undo', detail: execution.id });
  }

  return {
    toolResult: { status, body },
    summary: `executed (${status})`,
    undoEvent,
    httpStatus: status,
  };
}

function redactPayload(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (/password|secret|token|card|cvv|ssn/i.test(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function createExecution(
  conversationId: string,
  actionId: string,
  payload: Record<string, unknown>,
  status: string,
  response?: unknown,
  undoDeadline?: Date | null,
  httpStatus?: number | null,
): Promise<{ id: string; undo_deadline?: string | null }> {
  const row = await queryOne<{ id: string; undo_deadline: string | null }>(
    `INSERT INTO action_executions (conversation_id, action_id, request_payload, response_payload, status, undo_deadline, executed_at, http_status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, undo_deadline`,
    [
      conversationId,
      actionId,
      JSON.stringify(payload),
      response ? JSON.stringify(response) : null,
      status,
      undoDeadline ?? null,
      status === 'executed' || status === 'failed' ? new Date() : null,
      httpStatus ?? null,
      status === 'failed' ? `HTTP ${httpStatus ?? 'error'}` : null,
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
    `UPDATE action_executions SET status = 'executed', response_payload = $1, executed_at = now(), http_status = $2 WHERE id = $3`,
    [JSON.stringify({ status, body }), status, executionId],
  );

  await invalidateConversationToolCache(conv.site_id, conv.visitor_id, execution.conversation_id);

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
      try {
        const result = await executeAction(site, compAction, {}, scoped);
        if (result.status >= 400) {
          const tenantId = await getSiteTenantId(conv.site_id);
          if (tenantId) {
            void dispatchWebhook(tenantId, 'action.undo_failed', {
              executionId,
              conversationId: execution.conversation_id,
              compensatingOperationId: compAction.operation_id,
              httpStatus: result.status,
              body: result.body,
            });
          }
          return {
            success: false,
            message: `Undo compensating action failed (HTTP ${result.status})`,
          };
        }
      } catch (err) {
        const tenantId = await getSiteTenantId(conv.site_id);
        if (tenantId) {
          void dispatchWebhook(tenantId, 'action.undo_failed', {
            executionId,
            conversationId: execution.conversation_id,
            error: err instanceof Error ? err.message : 'undo failed',
          });
        }
        return { success: false, message: 'Undo compensating action failed' };
      }
    }
  }

  await queryOne(
    `UPDATE action_executions SET status = 'undone', undone_at = now() WHERE id = $1`,
    [executionId],
  );

  await invalidateConversationToolCache(conv.site_id, conv.visitor_id, execution.conversation_id);

  return { success: true, message: 'Action undone' };
}
