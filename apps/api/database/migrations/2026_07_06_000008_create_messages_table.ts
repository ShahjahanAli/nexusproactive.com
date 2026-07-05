import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT CHECK (role IN ('user','assistant','system','tool')),
      content TEXT,
      agent_name TEXT,
      tool_calls JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await client.query(
    `CREATE INDEX idx_messages_conversation_id ON messages(conversation_id)`,
  );
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS messages`);
}
