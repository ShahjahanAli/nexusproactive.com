import { Router } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../services/stripeService';

const router = Router();

router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }

    try {
      await handleStripeWebhook(req.body as Buffer, signature);
      res.json({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook error';
      res.status(400).json({ error: message });
    }
  },
);

export default router;
