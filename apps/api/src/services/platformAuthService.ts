import bcrypt from 'bcryptjs';
import {
  PlatformAdmin,
  PlatformAuthUser,
  PlatformRole,
} from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { signPlatformToken } from '../middleware/platformAuth';
import { AppError } from '../middleware/errorHandler';

interface AdminRow {
  id: string;
  email: string;
  name: string | null;
  role: PlatformRole;
  is_active: boolean;
  password_hash: string;
  last_login_at: string | null;
  created_at: string;
}

function toAuthUser(row: Pick<AdminRow, 'id' | 'email' | 'name' | 'role'>): PlatformAuthUser {
  return {
    adminId: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

function toAdmin(row: AdminRow): PlatformAdmin {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    is_active: row.is_active,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
  };
}

export async function platformLogin(
  email: string,
  password: string,
): Promise<{ token: string; user: PlatformAuthUser }> {
  const row = await queryOne<AdminRow>(
    `SELECT id, email, name, role, is_active, password_hash, last_login_at, created_at
     FROM platform_admins WHERE email = $1`,
    [email.toLowerCase()],
  );

  if (!row || !row.is_active) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  await query(
    `UPDATE platform_admins SET last_login_at = now() WHERE id = $1`,
    [row.id],
  );

  const token = signPlatformToken({
    adminId: row.id,
    email: row.email,
    role: row.role,
  });

  return { token, user: toAuthUser(row) };
}

export async function getPlatformAdmin(adminId: string): Promise<PlatformAuthUser | null> {
  const row = await queryOne<AdminRow>(
    `SELECT id, email, name, role, is_active, password_hash, last_login_at, created_at
     FROM platform_admins WHERE id = $1 AND is_active = true`,
    [adminId],
  );
  if (!row) return null;
  return toAuthUser(row);
}

export async function createPlatformAdmin(input: {
  email: string;
  password: string;
  name?: string;
  role?: PlatformRole;
}): Promise<PlatformAdmin> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM platform_admins WHERE email = $1`,
    [input.email.toLowerCase()],
  );
  if (existing) {
    throw new AppError('Admin email already exists', 409, 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const row = await queryOne<AdminRow>(
    `INSERT INTO platform_admins (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, is_active, password_hash, last_login_at, created_at`,
    [
      input.email.toLowerCase(),
      passwordHash,
      input.name ?? null,
      input.role ?? 'super_admin',
    ],
  );
  if (!row) throw new AppError('Failed to create admin', 500);
  return toAdmin(row);
}

export async function listPlatformAdmins(): Promise<PlatformAdmin[]> {
  const rows = await query<AdminRow>(
    `SELECT id, email, name, role, is_active, password_hash, last_login_at, created_at
     FROM platform_admins
     ORDER BY created_at ASC`,
  );
  return rows.map(toAdmin);
}

export async function ensureSeedPlatformAdmin(): Promise<void> {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM platform_admins WHERE email = $1`,
    [email.toLowerCase()],
  );
  if (existing) return;

  await createPlatformAdmin({
    email,
    password,
    name: process.env.PLATFORM_ADMIN_NAME ?? 'Super Admin',
    role: 'super_admin',
  });
  console.log(`[platform] Seeded platform admin: ${email}`);
}
