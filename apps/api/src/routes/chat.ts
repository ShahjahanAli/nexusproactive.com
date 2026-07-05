import { Router } from 'express';
import { z } from 'zod';
import { runOrchestrator, approveExecution, undoExecution } from '../services/orchestrator';
import { getWidgetConversationHistory } from '../services/visitors';

const router = Router();

const chatSchema = z.object({
  siteId: z.string().uuid(),
  visitorId: z.string().min(1),
  message: z.string().min(1),
  conversationId: z.string().uuid().optional(),
});

router.get('/history', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

router.post('/', async (req, res) => {
  const body = chatSchema.parse(req.body);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  for await (const chunk of runOrchestrator({
    siteId: body.siteId,
    visitorId: body.visitorId,
    message: body.message,
    conversationId: body.conversationId,
    signal: abortController.signal,
  })) {
    res.write(chunk);
    const resWithFlush = res as typeof res & { flush?: () => void };
    resWithFlush.flush?.();
  }

  res.end();
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
