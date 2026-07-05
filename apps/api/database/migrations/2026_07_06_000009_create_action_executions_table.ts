import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE action_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      action_id UUID REFERENCES actions(id),
      request_payload JSONB,
      response_payload JSONB,
      status TEXT CHECK (status IN ('pending_approval','executed','undone','failed')),
      approval_token_hash TEXT,
      undo_deadline TIMESTAMPTZ,
      executed_at TIMESTAMPTZ,
      undone_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await client.query(
    `CREATE INDEX idx_action_executions_conversation ON action_executions(conversation_id)`,
  );
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS action_executions`);
}
