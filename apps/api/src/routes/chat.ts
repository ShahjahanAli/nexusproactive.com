import { Router } from 'express';
import { z } from 'zod';
import { runOrchestrator, approveExecution, undoExecution } from '../services/orchestrator';
import { getWidgetConversationHistory } from '../services/visitors';
import { requestEscalation } from '../services/escalations';
import { updateVisitorContext, evaluateProactiveTriggers } from '../services/proactive';
import { mergeVisitorIdentity } from '../services/visitorMemory';
import { dispatchWebhook } from '../services/webhooks';
import { getSiteTenantId } from '../services/conversationService';
import { getSiteById } from '../services/actionExecutor';

const router = Router();

function corsPublic(res: import('express').Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
}

const chatSchema = z.object({
  siteId: z.string().uuid(),
  visitorId: z.string().min(1),
  message: z.string().min(1),
  conversationId: z.string().uuid().optional(),
});

router.get('/history', async (req, res) => {
  corsPublic(res);
  const schema = z.object({
    siteId: z.string().uuid(),
    visitorId: z.string().min(1),
    conversationId: z.string().uuid(),
  });
  const query = schema.parse(req.query);

  const history = await getWidgetConversationHistory(
    query.siteId,
    query.visitorId,
    query.conversationId,
  );

  if (!history) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  res.json(history);
});

router.post('/escalate', async (req, res) => {
  corsPublic(res);
  const schema = z.object({
    siteId: z.string().uuid(),
    visitorId: z.string().min(1),
    conversationId: z.string().uuid(),
    reason: z.string().optional(),
  });
  const body = schema.parse(req.body);
  const result = await requestEscalation(
    body.siteId,
    body.visitorId,
    body.conversationId,
    body.reason,
  );
  if (!result.ok) {
    res.status(404).json({ error: result.message });
    return;
  }
  res.json(result);
});

router.post('/context', async (req, res) => {
  corsPublic(res);
  const schema = z.object({
    siteId: z.string().uuid(),
    visitorId: z.string().min(1),
    pageUrl: z.string().optional(),
    pageTitle: z.string().optional(),
    idleSeconds: z.number().int().optional(),
    event: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  });
  const body = schema.parse(req.body);

  const site = await getSiteById(body.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }

  await updateVisitorContext(body);

  const proactive = await evaluateProactiveTriggers(body);
  if (proactive) {
    const tenantId = await getSiteTenantId(body.siteId);
    if (tenantId) {
      void dispatchWebhook(tenantId, 'proactive.triggered', {
        siteId: body.siteId,
        visitorId: body.visitorId,
        triggerId: proactive.triggerId,
        message: proactive.message,
      });
    }
    res.json({ proactiveMessage: proactive.message, triggerId: proactive.triggerId });
    return;
  }

  res.json({ proactiveMessage: null });
});

router.post('/merge-visitor', async (req, res) => {
  corsPublic(res);
  const schema = z.object({
    siteId: z.string().uuid(),
    fromVisitorId: z.string().min(1),
    toVisitorId: z.string().min(1),
  });
  const body = schema.parse(req.body);

  const site = await getSiteById(body.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found', merged: false });
    return;
  }

  const result = await mergeVisitorIdentity(
    body.siteId,
    body.fromVisitorId,
    body.toVisitorId,
  );
  res.json(result);
});

router.post('/', async (req, res) => {
  const body = chatSchema.parse(req.body);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Prevent intermediary idle timeouts during long tool + LLM turns (often 30–90s).
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Hard ceiling for one chat turn (tools + compose). Do NOT abort on res/req "close":
  // browser fetch streaming and Express often emit close while the client is still
  // reading, which previously cancelled the LLM and showed "Sorry — I could not finish…".
  const turnDeadlineMs = Math.max(
    60_000,
    parseInt(process.env.CHAT_TURN_TIMEOUT_MS ?? '180000', 10) || 180_000,
  );
  const turnAbort = new AbortController();
  const turnTimer = setTimeout(() => turnAbort.abort(), turnDeadlineMs);

  // Real SSE *data* heartbeats (not comments). Some browsers/proxies ignore
  // `: comment` lines and still drop "idle" streams during long LLM waits.
  let beat = 0;
  const heartbeat = setInterval(() => {
    if (res.writableEnded) return;
    beat += 1;
    try {
      const payload = JSON.stringify({
        type: 'status',
        phase: 'heartbeat',
        label: beat % 2 === 0 ? 'Still working on that…' : 'Fetching the latest details…',
      });
      res.write(`data: ${payload}\n\n`);
      const resWithFlush = res as typeof res & { flush?: () => void };
      resWithFlush.flush?.();
    } catch {
      // socket already gone
    }
  }, 4_000);

  try {
    for await (const chunk of runOrchestrator({
      siteId: body.siteId,
      visitorId: body.visitorId,
      message: body.message,
      conversationId: body.conversationId,
      signal: turnAbort.signal,
    })) {
      if (res.writableEnded) continue;
      try {
        res.write(chunk);
        const resWithFlush = res as typeof res & { flush?: () => void };
        resWithFlush.flush?.();
      } catch {
        // Client socket gone — keep draining so the reply is still persisted.
      }
    }
  } finally {
    clearTimeout(turnTimer);
    clearInterval(heartbeat);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

router.post('/approve', async (req, res) => {
  const schema = z.object({ token: z.string() });
  const { token } = schema.parse(req.body);
  const result = await approveExecution(token);
  res.json(result);
});

router.post('/undo/:executionId', async (req, res) => {
  const result = await undoExecution(req.params.executionId);
  res.json(result);
});

export default router;
