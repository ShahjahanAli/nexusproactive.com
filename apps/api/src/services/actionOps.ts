import { query } from '../db';

export interface ActionOpsRow {
  id: string;
  site_name: string;
  operation_id: string;
  status: string;
  http_status: number | null;
  error_message: string | null;
  executed_at: string | null;
  undone_at: string | null;
  created_at: string;
}

export async function listRecentActionOps(
  tenantId: string,
  limit = 30,
): Promise<ActionOpsRow[]> {
  return query<ActionOpsRow>(
    `SELECT ae.id, s.name AS site_name, a.operation_id, ae.status,
            ae.http_status, ae.error_message, ae.executed_at, ae.undone_at, ae.created_at
     FROM action_executions ae
     JOIN conversations c ON c.id = ae.conversation_id
     JOIN sites s ON s.id = c.site_id
     JOIN actions a ON a.id = ae.action_id
     WHERE s.tenant_id = $1
       AND (
         ae.status IN ('undone', 'failed')
         OR ae.error_message IS NOT NULL
       )
     ORDER BY ae.created_at DESC
     LIMIT $2`,
    [tenantId, Math.min(limit, 100)],
  );
}
