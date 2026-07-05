import { Router } from 'express';
import { z } from 'zod';
import {
  clearAuthCookie,
  requireTenantAuth,
  setAuthCookie,
} from '../middleware/auth';
import { getAuthUser, login, signup } from '../services/authService';
import { createCheckoutSession } from '../services/stripeService';

const router = Router();

const signupSchema = z.object({
  companyName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/signup', async (req, res) => {
  const body = signupSchema.parse(req.body);
  const { token, userId } = await signup(body.companyName, body.email, body.password);
  setAuthCookie(res, token);
  const user = await getAuthUser(userId);
  res.status(201).json({ ok: true, token, user });
});

router.post('/login', async (req, res) => {
  const body = loginSchema.parse(req.body);
  const { token, user } = await login(body.email, body.password);
  setAuthCookie(res, token);
  res.json({ user, token });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireTenantAuth, async (req, res) => {
  const user = await getAuthUser(req.auth!.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  res.json({ user });
});

router.post('/checkout', requireTenantAuth, async (req, res) => {
  const planSchema = z.object({
    plan: z.enum(['starter', 'growth', 'scale']),
  });
  const { plan } = planSchema.parse(req.body);
  const url = await createCheckoutSession(req.tenantId!, plan);
  res.json({ url });
});

export default router;
