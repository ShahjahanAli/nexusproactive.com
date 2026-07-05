import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const widgetChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.nodeEnv === 'production' ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const body = req.body as { visitorId?: string; siteId?: string };
    return `${body.siteId ?? 'unknown'}:${body.visitorId ?? req.ip}`;
  },
  message: { error: 'Rate limit exceeded', code: 'RATE_LIMIT' },
});

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (config.nodeEnv !== 'test') {
      console.log(
        JSON.stringify({
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms,
        }),
      );
    }
  });
  next();
}
