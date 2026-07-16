import { query, queryOne } from '../db';
import { completeChat } from './llmClient';
import { config } from '../config';
import type { ActionRow } from './actionExecutor';

export interface MissionStep {
  operationId: string;
  label: string;
  argsDraft?: Record<string, unknown>;
  requiresApproval?: boolean;
  status?: 'pending' | 'active' | 'done' | 'failed' | 'skipped';
}

export interface MissionPlan {
  id: string;
  conversation_id: string;
  site_id: string;
  visitor_id: string;
  status: string;
  steps: MissionStep[];
  current_step: number;
  title: string | null;
}

function looksLikeMultiStep(message: string): boolean {
  if (/\b(and then|then|also|after that|cancel.+(rebook|book|find)|book.+and|undo.+and)\b/i.test(message)) {
    return true;
  }
  // Avoid treating "email … and order number …" as a multi-step mission
  if (/\b(email|order\s*number|registration)\b/i.test(message)) {
    return false;
  }
  return message.includes(' and ') && message.split(/\s+/).length > 8;
}

export async function maybeCreateMissionPlan(input: {
  conversationId: string;
  siteId: string;
  visitorId: string;
  message: string;
  actions: ActionRow[];
  trackTokens?: (n: number) => void;
}): Promise<MissionPlan | null> {
  if (!looksLikeMultiStep(input.message) || input.actions.length === 0) {
    return null;
  }

  const catalog = input.actions
    .slice(0, 40)
    .map((a) => `- ${a.operation_id} (${a.method} ${a.path}) risk=${a.risk_tier}`)
    .join('\n');

  const { text, tokens_used } = await completeChat({
    model: config.llm.fallbackModel,
    messages: [
      {
        role: 'system',
        content: `You plan multi-step API workflows. Reply JSON only:
{"title":"...","steps":[{"operationId":"...","label":"...","requiresApproval":false}]}
Use only operationIds from the catalog. Max 5 steps. If a single tool is enough, return {"title":null,"steps":[]}.`,
      },
      {
        role: 'user',
        content: `Visitor request:\n${input.message}\n\nCatalog:\n${catalog}`,
      },
    ],
  });
  input.trackTokens?.(tokens_used);

  let parsed: { title?: string | null; steps?: MissionStep[] };
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned) as { title?: string | null; steps?: MissionStep[] };
  } catch {
    return null;
  }

  const validIds = new Set(input.actions.map((a) => a.operation_id));
  const steps: MissionStep[] = (parsed.steps ?? [])
    .filter((s) => s.operationId && validIds.has(s.operationId))
    .slice(0, 5)
    .map((s) => {
      const action = input.actions.find((a) => a.operation_id === s.operationId)!;
      return {
        operationId: s.operationId,
        label: s.label || action.operation_id,
        argsDraft: s.argsDraft ?? {},
        requiresApproval:
          s.requiresApproval === true ||
          action.risk_tier === 'irreversible_write' ||
          action.risk_tier === 'financial',
        status: 'pending' as const,
      };
    });

  if (steps.length < 2) return null;

  steps[0] = { ...steps[0], status: 'active' };

  const row = await queryOne<MissionPlan>(
    `INSERT INTO mission_plans (conversation_id, site_id, visitor_id, status, steps, current_step, title)
     VALUES ($1, $2, $3, 'active', $4, 0, $5)
     RETURNING *`,
    [
      input.conversationId,
      input.siteId,
      input.visitorId,
      JSON.stringify(steps),
      parsed.title ?? 'Multi-step plan',
    ],
  );
  if (!row) return null;

  return {
    ...row,
    steps: typeof row.steps === 'string' ? JSON.parse(row.steps as unknown as string) : row.steps,
  };
}

export async function getActiveMission(
  conversationId: string,
): Promise<MissionPlan | null> {
  const row = await queryOne<MissionPlan>(
    `SELECT * FROM mission_plans
     WHERE conversation_id = $1 AND status IN ('active', 'paused')
     ORDER BY created_at DESC
     LIMIT 1`,
    [conversationId],
  );
  if (!row) return null;
  return {
    ...row,
    steps: typeof row.steps === 'string' ? JSON.parse(row.steps as unknown as string) : row.steps,
  };
}

export async function advanceMissionStep(
  missionId: string,
  stepIndex: number,
  status: MissionStep['status'],
): Promise<void> {
  const mission = await queryOne<{ steps: MissionStep[]; current_step: number }>(
    'SELECT steps, current_step FROM mission_plans WHERE id = $1',
    [missionId],
  );
  if (!mission) return;
  const steps = (
    typeof mission.steps === 'string'
      ? JSON.parse(mission.steps as unknown as string)
      : mission.steps
  ) as MissionStep[];
  if (!steps[stepIndex]) return;
  steps[stepIndex].status = status;
  let current = mission.current_step;
  let planStatus = 'active';
  if (status === 'done' && stepIndex === current) {
    current = stepIndex + 1;
    if (current < steps.length) {
      steps[current].status = 'active';
    } else {
      planStatus = 'completed';
    }
  }
  if (status === 'failed') planStatus = 'failed';

  await queryOne(
    `UPDATE mission_plans
     SET steps = $1, current_step = $2, status = $3, updated_at = now()
     WHERE id = $4`,
    [JSON.stringify(steps), current, planStatus, missionId],
  );
}

export async function cancelMission(missionId: string): Promise<void> {
  await queryOne(
    `UPDATE mission_plans SET status = 'cancelled', updated_at = now() WHERE id = $1`,
    [missionId],
  );
}

export async function listMissionsForSite(siteId: string, limit = 20) {
  return query(
    `SELECT id, conversation_id, status, title, current_step, steps, created_at, updated_at
     FROM mission_plans WHERE site_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [siteId, limit],
  );
}
