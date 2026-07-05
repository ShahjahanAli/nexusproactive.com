import { Router, raw } from 'express';
import { handleStripeWebhook } from '../services/stripeService';

const router = Router();

router.post(
  '/stripe',
  raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    await handleStripeWebhook(req.body as Buffer, signature);
    res.json({ received: true });
  },
);

export default router;
