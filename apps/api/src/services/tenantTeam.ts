import bcrypt from 'bcryptjs';
import { TenantRole, TenantUser } from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { AppError } from '../middleware/errorHandler';

const MANAGE_ROLES: TenantRole[] = ['owner', 'admin'];
const ASSIGNABLE_ROLES: TenantRole[] = ['admin', 'agent', 'viewer'];

export function canManageTeam(role: TenantRole): boolean {
  return MANAGE_ROLES.includes(role);
}

export function canUseLiveInbox(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'agent';
}

export async function listTenantTeam(tenantId: string): Promise<TenantUser[]> {
  return query<TenantUser>(
    `SELECT id, tenant_id, email, role, display_name, is_active, created_at
     FROM tenant_users
     WHERE tenant_id = $1
     ORDER BY
       CASE role
         WHEN 'owner' THEN 0
         WHEN 'admin' THEN 1
         WHEN 'agent' THEN 2
         ELSE 3
       END,
       created_at ASC`,
    [tenantId],
  );
}

export async function createTenantAgent(input: {
  tenantId: string;
  actorRole: TenantRole;
  email: string;
  password: string;
  role?: TenantRole;
  displayName?: string;
}): Promise<TenantUser> {
  if (!canManageTeam(input.actorRole)) {
    throw new AppError('Only owners and admins can manage team members', 403);
  }

  const role = input.role ?? 'agent';
  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw new AppError('Invalid role', 400);
  }
  if (role === 'admin' && input.actorRole !== 'owner') {
    throw new AppError('Only the owner can create admins', 403);
  }

  const email = input.email.trim().toLowerCase();
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM tenant_users WHERE email = $1',
    [email],
  );
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  if (input.password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const row = await queryOne<TenantUser>(
    `INSERT INTO tenant_users (tenant_id, email, role, password_hash, display_name, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, tenant_id, email, role, display_name, is_active, created_at`,
    [input.tenantId, email, role, passwordHash, input.displayName?.trim() || null],
  );
  if (!row) throw new AppError('Failed to create team member', 500);
  return row;
}

export async function updateTenantAgent(input: {
  tenantId: string;
  actorUserId: string;
  actorRole: TenantRole;
  userId: string;
  role?: TenantRole;
  displayName?: string | null;
  isActive?: boolean;
  password?: string;
}): Promise<TenantUser> {
  if (!canManageTeam(input.actorRole)) {
    throw new AppError('Only owners and admins can manage team members', 403);
  }

  const target = await queryOne<TenantUser & { role: TenantRole }>(
    `SELECT id, tenant_id, email, role, display_name, is_active, created_at
     FROM tenant_users WHERE id = $1 AND tenant_id = $2`,
    [input.userId, input.tenantId],
  );
  if (!target) throw new AppError('Team member not found', 404);
  if (target.role === 'owner') {
    throw new AppError('Cannot modify the account owner', 403);
  }
  if (target.role === 'admin' && input.actorRole !== 'owner') {
    throw new AppError('Only the owner can modify admins', 403);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (input.role !== undefined) {
    if (!ASSIGNABLE_ROLES.includes(input.role)) {
      throw new AppError('Invalid role', 400);
    }
    if (input.role === 'admin' && input.actorRole !== 'owner') {
      throw new AppError('Only the owner can promote to admin', 403);
    }
    sets.push(`role = $${i++}`);
    params.push(input.role);
  }
  if (input.displayName !== undefined) {
    sets.push(`display_name = $${i++}`);
    params.push(input.displayName?.trim() || null);
  }
  if (input.isActive !== undefined) {
    sets.push(`is_active = $${i++}`);
    params.push(input.isActive);
  }
  if (input.password) {
    if (input.password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    sets.push(`password_hash = $${i++}`);
    params.push(await bcrypt.hash(input.password, 12));
  }

  if (sets.length === 0) {
    throw new AppError('No updates provided', 400);
  }

  params.push(input.userId, input.tenantId);
  const row = await queryOne<TenantUser>(
    `UPDATE tenant_users SET ${sets.join(', ')}
     WHERE id = $${i++} AND tenant_id = $${i}
     RETURNING id, tenant_id, email, role, display_name, is_active, created_at`,
    params,
  );
  if (!row) throw new AppError('Update failed', 500);
  return row;
}

export async function removeTenantAgent(input: {
  tenantId: string;
  actorRole: TenantRole;
  userId: string;
}): Promise<void> {
  if (!canManageTeam(input.actorRole)) {
    throw new AppError('Only owners and admins can manage team members', 403);
  }
  const target = await queryOne<{ role: TenantRole }>(
    'SELECT role FROM tenant_users WHERE id = $1 AND tenant_id = $2',
    [input.userId, input.tenantId],
  );
  if (!target) throw new AppError('Team member not found', 404);
  if (target.role === 'owner') {
    throw new AppError('Cannot remove the account owner', 403);
  }
  if (target.role === 'admin' && input.actorRole !== 'owner') {
    throw new AppError('Only the owner can remove admins', 403);
  }

  // Soft-deactivate so chat history attribution remains
  await queryOne(
    `UPDATE tenant_users SET is_active = false WHERE id = $1 AND tenant_id = $2`,
    [input.userId, input.tenantId],
  );
}
