import { Router } from 'express';

/** Dev-only mock backend for Phase 4 testing */
const router = Router();

const store = new Map<string, Record<string, unknown>>();

router.get('/orders/:id', (req, res) => {
  const order = store.get(`order:${req.params.id}`) ?? {
    id: req.params.id,
    status: 'active',
    total: 129.0,
  };
  res.json(order);
});

router.patch('/users/:id/email', (req, res) => {
  store.set(`user:${req.params.id}`, { email: req.body.email });
  res.json({ ok: true, email: req.body.email });
});

router.post('/orders/:id/cancel', (req, res) => {
  store.set(`order:${req.params.id}`, { id: req.params.id, status: 'cancelled' });
  res.json({ ok: true, cancelled: true });
});

export default router;
