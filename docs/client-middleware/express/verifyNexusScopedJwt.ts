/**
 * Nexus Widget — scoped JWT verification middleware for Express.
 *
 * Usage:
 *   app.use('/api', verifyNexusScopedJwt(process.env.NEXUS_JWT_SIGNING_SECRET));
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface NexusPayload {
  site_id: string;
  visitor_id: string;
  allowed_operation_ids: string[];
  iss?: string;
}

declare global {
  namespace Express {
    interface Request {
      nexus?: { siteId: string; visitorId: string };
    }
  }
}

export function verifyNexusScopedJwt(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = auth.slice(7);
    const operationId = req.headers['x-nexus-operation-id'] as string | undefined;

    try {
      const payload = jwt.verify(token, secret, {
        issuer: 'nexus-widget',
      }) as NexusPayload;

      if (!operationId || !payload.allowed_operation_ids?.includes(operationId)) {
        res.status(403).json({ error: 'Operation not permitted' });
        return;
      }

      req.nexus = {
        siteId: payload.site_id,
        visitorId: payload.visitor_id,
      };
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
