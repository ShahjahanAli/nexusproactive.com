import { Router } from 'express';
import { requireTenantAuth } from '../middleware/auth';
import { query } from '../db';

const router = Router();

router.get('/', requireTenantAuth, async (req, res) => {
  const signals = await query(
    `SELECT ps.*, s.name AS site_name FROM product_signals ps
     JOIN sites s ON s.id = ps.site_id
     WHERE s.tenant_id = $1
     ORDER BY ps.occurrence_count DESC, ps.last_seen DESC
     LIMIT 50`,
    [req.tenantId],
  );
  res.json({ signals });
});

export default router;
