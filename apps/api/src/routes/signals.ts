import { Router } from 'express';
import { requireTenantAuth } from '../middleware/auth';
import { parseOptionalString, parsePageLimit } from '../lib/listQuery';
import {
  generateSignalApiSuggestion,
  listProductSignals,
  markSignalSuggestionReviewed,
} from '../services/productSignals';

const router = Router();

router.get('/', requireTenantAuth, async (req, res) => {
  const { limit, offset } = parsePageLimit(req.query);
  const q = parseOptionalString(req.query.q);
  const siteId = parseOptionalString(req.query.siteId);
  const status = parseOptionalString(req.query.status);
  const minOccurrences = parseInt(String(req.query.minOccurrences ?? ''), 10);

  const result = await listProductSignals(req.tenantId!, {
    q,
    siteId,
    status,
    minOccurrences: Number.isFinite(minOccurrences) && minOccurrences > 0 ? minOccurrences : undefined,
    limit,
    offset,
  });
  res.json({ ...result, limit, offset });
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
