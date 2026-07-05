import { Router } from 'express';
import { z } from 'zod';
import { getWidgetConfig } from '../services/widgetConfig';

const router = Router();

router.get('/config', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const schema = z.object({ siteId: z.string().uuid() });
  const { siteId } = schema.parse(req.query);

  try {
    const config = await getWidgetConfig(siteId);
    res.json(config);
  } catch {
    res.status(404).json({ error: 'Site not found' });
  }
});

export default router;
