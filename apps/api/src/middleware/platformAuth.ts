import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { PlatformAuthUser, PlatformRole } from '@nexus/shared-types';
import { config } from '../config';

export interface PlatformJwtPayload {
  adminId: string;
  email: string;
  role: PlatformRole;
  aud: 'platform';
}

declare global {
  namespace Express {
    interface Request {
      platformAuth?: PlatformAuthUser;
      adminId?: string;
    }
  }
}

const PLATFORM_AUTH_COOKIE = 'nexus_platform_session';

export function signPlatformToken(payload: Omit<PlatformJwtPayload, 'aud'>): string {
  return jwt.sign(
    { ...payload, aud: 'platform' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyPlatformToken(token: string): PlatformJwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as PlatformJwtPayload;
  if (decoded.aud !== 'platform') {
    throw new Error('Invalid token audience');
  }
  return decoded;
}

export function setPlatformAuthCookie(res: Response, token: string): void {
  res.cookie(PLATFORM_AUTH_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearPlatformAuthCookie(res: Response): void {
  res.clearCookie(PLATFORM_AUTH_COOKIE, { path: '/' });
}

function extractPlatformToken(req: Request): string | null {
  const cookie = req.cookies?.[PLATFORM_AUTH_COOKIE];
  if (cookie) return cookie;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export async function requirePlatformAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractPlatformToken(req);
  if (!token) {
    res.status(401).json({ error: 'Platform authentication required', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const payload = verifyPlatformToken(token);
    req.adminId = payload.adminId;
    req.platformAuth = {
      adminId: payload.adminId,
      email: payload.email,
      name: null,
      role: payload.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired platform session', code: 'UNAUTHORIZED' });
  }
}

export function requirePlatformRole(...roles: PlatformRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.platformAuth?.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'Insufficient platform privileges', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

/** Write operations — blocked for readonly. */
export function requirePlatformWrite(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const role = req.platformAuth?.role;
  if (!role || role === 'readonly') {
    res.status(403).json({ error: 'Read-only platform role cannot modify data', code: 'FORBIDDEN' });
    return;
  }
  next();
}

export { PLATFORM_AUTH_COOKIE };
