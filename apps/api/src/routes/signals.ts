import { Router } from 'express';
import { z } from 'zod';
import { requireTenantAuth } from '../middleware/auth';
import { parseOptionalString, parsePageLimit } from '../lib/listQuery';
import {
  generateSignalApiSuggestion,
  getProductSignalStats,
  listProductSignals,
  markSignalSuggestionReviewed,
  updateProductSignalStatus,
} from '../services/productSignals';

const router = Router();

const statusSchema = z.object({
  status: z.enum(['new', 'reviewed', 'resolved']),
});

router.get('/', requireTenantAuth, async (req, res) => {
  const { limit, offset } = parsePageLimit(req.query);
  const filters = {
    q: parseOptionalString(req.query.q),
    siteId: parseOptionalString(req.query.siteId),
    status: parseOptionalString(req.query.status),
    minOccurrences: (() => {
      const n = parseInt(String(req.query.minOccurrences ?? ''), 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
  };

  const [result, stats] = await Promise.all([
    listProductSignals(req.tenantId!, { ...filters, limit, offset }),
    getProductSignalStats(req.tenantId!, filters),
  ]);
  res.json({ ...result, stats, limit, offset });
});

router.patch('/:id/status', requireTenantAuth, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status', details: parsed.error.flatten() });
    return;
  }
  const ok = await updateProductSignalStatus(req.tenantId!, req.params.id, parsed.data.status);
  if (!ok) {
    res.status(404).json({ error: 'Signal not found' });
    return;
  }
  res.json({ ok: true, status: parsed.data.status });
});

router.post('/:id/suggest-api', requireTenantAuth, async (req, res) => {
  const result = await generateSignalApiSuggestion(req.tenantId!, req.params.id);
  if (!result) {
    res.status(404).json({ error: 'Signal not found' });
    return;
  }
  res.json(result);
});

router.post('/:id/review-suggestion', requireTenantAuth, async (req, res) => {
  const ok = await markSignalSuggestionReviewed(req.tenantId!, req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Signal not found' });
    return;
  }
  res.json({ ok: true });
});

export default router;
