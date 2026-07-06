'use client';

import { useRouter } from 'next/navigation';
import { Badge, riskTierBadge } from '@/components/dashboard/ui/badge';
import { Button } from '@/components/dashboard/ui/button';
import type { Action } from '@nexus/shared-types';

export function ActionReviewRow({ action }: { action: Action }) {
  const router = useRouter();

  async function approve() {
    await fetch(`/api/sites/actions/${action.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: true, isActive: true }),
    });
    router.refresh();
  }

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
      <td className="px-5 py-3">
        <span className="rounded border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
          {action.method}
        </span>
      </td>
      <td className="max-w-md truncate px-5 py-3 font-mono text-xs text-zinc-400">{action.path}</td>
      <td className="px-5 py-3">
        <Badge variant={riskTierBadge(action.risk_tier)} size="sm">
          {action.risk_tier.replace(/_/g, ' ')}
        </Badge>
      </td>
      <td className="px-5 py-3">
        {!action.reviewed_by_human ? (
          <Button size="sm" onClick={approve}>
            Approve
          </Button>
        ) : (
          <Badge variant="success" size="sm">
            Approved
          </Badge>
        )}
      </td>
      <td className="px-5 py-3 font-mono text-xs tabular-nums text-zinc-600">
        v{action.spec_version}
      </td>
    </tr>
  );
}
