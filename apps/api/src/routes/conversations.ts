import { Router } from 'express';
import { requireTenantAuth } from '../middleware/auth';
import { query } from '../db';

const router = Router();

router.get('/', requireTenantAuth, async (req, res) => {
  const rows = await query(
    `SELECT c.id, c.site_id, c.visitor_id, c.status, c.active_agent, c.created_at,
            c.tokens_used,
            s.name AS site_name,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE s.tenant_id = $1
     ORDER BY c.created_at DESC
     LIMIT 100`,
    [req.tenantId],
  );
  res.json({ conversations: rows });
});

router.get('/:id/messages', requireTenantAuth, async (req, res) => {
  const messages = await query(
    `SELECT m.* FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     JOIN sites s ON s.id = c.site_id
     WHERE m.conversation_id = $1 AND s.tenant_id = $2
     ORDER BY m.created_at ASC`,
    [req.params.id, req.tenantId],
  );
  res.json({ messages });
});

export default router;
