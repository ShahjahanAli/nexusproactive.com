import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  AuthUser,
  DEFAULT_PLAN_LIMITS,
  Plan,
  PlanLimits,
  TenantRole,
} from '@nexus/shared-types';
import { withClient, queryOne } from '../db';
import { signToken } from '../middleware/auth';

interface TenantRow {
  id: string;
  company_name: string;
  owner_email: string;
  plan: Plan;
  plan_limits: PlanLimits;
  stripe_customer_id: string | null;
}

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  role: TenantRole;
  password_hash: string | null;
  company_name: string;
  plan: Plan;
  plan_limits: PlanLimits;
}

export async function signup(
  companyName: string,
  email: string,
  password: string,
): Promise<{ token: string; tenantId: string; userId: string }> {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM tenant_users WHERE email = $1',
    [email.toLowerCase()],
  );
  if (existing) {
    throw Object.assign(new Error('Email already registered'), {
      status: 409,
      code: 'EMAIL_EXISTS',
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const planLimits = DEFAULT_PLAN_LIMITS.trial;

  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const tenantResult = await client.query<TenantRow>(
        `INSERT INTO tenants (company_name, owner_email, plan, plan_limits)
         VALUES ($1, $2, 'trial', $3)
         RETURNING id, company_name, owner_email, plan, plan_limits, stripe_customer_id`,
        [companyName, email.toLowerCase(), JSON.stringify(planLimits)],
      );
      const tenant = tenantResult.rows[0];

      const userResult = await client.query<{ id: string }>(
        `INSERT INTO tenant_users (tenant_id, email, role, password_hash)
         VALUES ($1, $2, 'owner', $3)
         RETURNING id`,
        [tenant.id, email.toLowerCase(), passwordHash],
      );
      const user = userResult.rows[0];

      await client.query('COMMIT');

      const token = signToken({
        userId: user.id,
        tenantId: tenant.id,
        email: email.toLowerCase(),
        role: 'owner',
      });

      return { token, tenantId: tenant.id, userId: user.id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const row = await queryOne<UserRow>(
    `SELECT tu.id, tu.tenant_id, tu.email, tu.role, tu.password_hash,
            t.company_name, t.plan, t.plan_limits
     FROM tenant_users tu
     JOIN tenants t ON t.id = tu.tenant_id
     WHERE tu.email = $1`,
    [email.toLowerCase()],
  );

  if (!row?.password_hash) {
    throw Object.assign(new Error('Invalid email or password'), {
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), {
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  const token = signToken({
    userId: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    role: row.role,
  });

  const user: AuthUser = {
    userId: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    role: row.role,
    companyName: row.company_name,
    plan: row.plan,
    planLimits: row.plan_limits ?? DEFAULT_PLAN_LIMITS[row.plan],
  };

  return { token, user };
}

export async function getAuthUser(userId: string): Promise<AuthUser | null> {
  const row = await queryOne<UserRow>(
    `SELECT tu.id, tu.tenant_id, tu.email, tu.role,
            t.company_name, t.plan, t.plan_limits
     FROM tenant_users tu
     JOIN tenants t ON t.id = tu.tenant_id
     WHERE tu.id = $1`,
    [userId],
  );

  if (!row) return null;

  return {
    userId: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    role: row.role,
    companyName: row.company_name,
    plan: row.plan,
    planLimits: row.plan_limits ?? DEFAULT_PLAN_LIMITS[row.plan],
  };
}

export function generateJwtSigningSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
