import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan TEXT CHECK (plan IN ('trial','starter','growth','scale')) DEFAULT 'trial',
      plan_limits JSONB DEFAULT '{"max_sites":1,"max_conversations_month":500,"max_tokens_month":2000000}',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS tenants`);
}
