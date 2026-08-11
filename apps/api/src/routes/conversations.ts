import { Router } from 'express';
import { requireTenantAuth } from '../middleware/auth';
import { parseOptionalString, parsePageLimit } from '../lib/listQuery';
import {
  getConversationDetail,
  getTenantConversationStats,
  listTenantConversations,
} from '../services/conversationList';
import { query } from '../db';

const router = Router();

router.get('/', requireTenantAuth, async (req, res) => {
  const { limit, offset } = parsePageLimit(req.query);
  const filters = {
    q: parseOptionalString(req.query.q),
    siteId: parseOptionalString(req.query.siteId),
    status: parseOptionalString(req.query.status),
    activeAgent: parseOptionalString(req.query.activeAgent),
  };

  const [result, stats] = await Promise.all([
    listTenantConversations(req.tenantId!, { ...filters, limit, offset }),
    getTenantConversationStats(req.tenantId!, filters),
  ]);
  res.json({ ...result, stats, limit, offset });
});

router.get('/:id/messages', requireTenantAuth, async (req, res) => {
  const conversation = await getConversationDetail(req.tenantId!, req.params.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const messages = await query(
    `SELECT m.* FROM messages m
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [req.params.id],
  );

  const consults = conversation.consults
    ? await query(
        `SELECT id, from_cx_agent_id, consult_type, target_key, question, answer,
                status, latency_ms, created_at
         FROM cx_consults
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [req.params.id],
      )
    : [];

  res.json({
    conversation,
    messages,
    consults,
    // Kept for older clients that read these at the top level.
    detected_language: conversation.detected_language,
    handoff_brief: conversation.handoff_brief,
  });
});

export default router;
