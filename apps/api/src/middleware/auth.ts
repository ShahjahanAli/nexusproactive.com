import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthUser, TenantRole } from '@nexus/shared-types';
import { config } from '../config';
import { queryOne } from '../db';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: TenantRole;
}

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      auth?: AuthUser;
      userId?: string;
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

const AUTH_COOKIE = 'nexus_session';

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
}

function extractToken(req: Request): string | null {
  const cookie = req.cookies?.[AUTH_COOKIE];
  if (cookie) return cookie;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export async function requireTenantAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const payload = verifyToken(token);

    const tenant = await queryOne<{ status: string }>(
      `SELECT status FROM tenants WHERE id = $1`,
      [payload.tenantId],
    );
    if (!tenant || tenant.status !== 'active') {
      res.status(403).json({
        error: 'This account is not active',
        code: 'TENANT_INACTIVE',
      });
      return;
    }

    req.tenantId = payload.tenantId;
    req.userId = payload.userId;
    req.auth = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
      companyName: '',
      plan: 'trial',
      planLimits: { max_sites: 1, max_conversations_month: 500, max_tokens_month: 2_000_000 },
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session', code: 'UNAUTHORIZED' });
  }
}

export { AUTH_COOKIE };
