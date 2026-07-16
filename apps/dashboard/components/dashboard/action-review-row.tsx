'use client';

import { useRouter } from 'next/navigation';
import { Badge, riskTierBadge } from '@/components/dashboard/ui/badge';
import { Button } from '@/components/dashboard/ui/button';
import type { Action } from '@nexus/shared-types';

export function ActionApproveButton({ action }: { action: Action }) {
  const router = useRouter();

  async function approve() {
    await fetch(`/api/sites/actions/${action.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: true, isActive: true }),
    });
    router.refresh();
  }

  if (!action.is_active) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning" size="sm">
          Inactive
        </Badge>
        <Button size="sm" onClick={approve}>
          Approve & enable
        </Button>
      </div>
    );
  }

  if (!action.reviewed_by_human) {
    return (
      <Button size="sm" onClick={approve}>
        Approve
      </Button>
    );
  }

  return (
    <Badge variant="success" size="sm">
      Active
    </Badge>
  );
}

export function ActionReviewRow({ action }: { action: Action }) {
  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
      <td className="px-5 py-3">
        <span className="rounded border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
          {action.method}
        </span>
      </td>
      <td className="max-w-md truncate px-5 py-3 font-mono text-xs text-zinc-400">{action.path}</td>
      <td className="px-5 py-3">
        {action.source_type ? (
          <Badge variant="default" size="sm">
            {action.source_type}
          </Badge>
        ) : (
          <span className="font-mono text-[10px] text-zinc-600">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        <Badge variant={riskTierBadge(action.risk_tier)} size="sm">
          {action.risk_tier.replace(/_/g, ' ')}
        </Badge>
      </td>
      <td className="px-5 py-3">
        <ActionApproveButton action={action} />
      </td>
      <td className="px-5 py-3 font-mono text-xs tabular-nums text-zinc-600">
        v{action.spec_version}
      </td>
    </tr>
  );
}
