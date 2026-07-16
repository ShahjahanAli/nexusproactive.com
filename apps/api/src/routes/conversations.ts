import { Router } from 'express';
import { requireTenantAuth } from '../middleware/auth';
import { parseOptionalString, parsePageLimit } from '../lib/listQuery';
import { listTenantConversations } from '../services/conversationList';
import { query } from '../db';

const router = Router();

router.get('/', requireTenantAuth, async (req, res) => {
  const { limit, offset } = parsePageLimit(req.query);
  const q = parseOptionalString(req.query.q);
  const siteId = parseOptionalString(req.query.siteId);
  const status = parseOptionalString(req.query.status);
  const activeAgent = parseOptionalString(req.query.activeAgent);

  const result = await listTenantConversations(req.tenantId!, {
    q,
    siteId,
    status,
    activeAgent,
    limit,
    offset,
  });
  res.json({ ...result, limit, offset });
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
