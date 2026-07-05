import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface ScopedJwtPayload {
  site_id: string;
  visitor_id: string;
  allowed_operation_ids: string[];
}

export function mintScopedJwt(
  payload: ScopedJwtPayload,
  signingSecret: string,
  expiresInMinutes = 15,
): string {
  return jwt.sign(payload, signingSecret, {
    expiresIn: `${expiresInMinutes}m`,
    issuer: 'nexus-widget',
  });
}

export function verifyScopedJwt(
  token: string,
  signingSecret: string,
): ScopedJwtPayload {
  const decoded = jwt.verify(token, signingSecret, {
    issuer: 'nexus-widget',
  }) as ScopedJwtPayload;
  return decoded;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function mintApprovalToken(
  executionId: string,
  secret: string,
  expiresInMinutes = 5,
): string {
  return jwt.sign({ executionId, purpose: 'approval' }, secret, {
    expiresIn: `${expiresInMinutes}m`,
  });
}

export function verifyApprovalToken(
  token: string,
  secret: string,
): { executionId: string } {
  const decoded = jwt.verify(token, secret) as {
    executionId: string;
    purpose: string;
  };
  if (decoded.purpose !== 'approval') {
    throw new Error('Invalid approval token');
  }
  return { executionId: decoded.executionId };
}
