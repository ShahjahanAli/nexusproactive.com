'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';

export function SignalSuggestionActions({
  signalId,
  suggestion,
  suggestionStatus,
}: {
  signalId: string;
  suggestion?: Record<string, unknown> | null;
  suggestionStatus?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [localSuggestion, setLocalSuggestion] = useState(suggestion ?? null);
  const [status, setStatus] = useState(suggestionStatus ?? 'none');

  async function generate() {
    setLoading(true);
    const res = await fetch(`/api/signals/${signalId}/suggest-api`, { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setLocalSuggestion(data.suggestion);
      setStatus('ready');
      router.refresh();
    }
  }

  async function markReviewed() {
    setLoading(true);
    await fetch(`/api/signals/${signalId}/review-suggestion`, { method: 'POST' });
    setLoading(false);
    setStatus('reviewed');
    router.refresh();
  }

  function copySnippet() {
    if (!localSuggestion) return;
    const snippet = JSON.stringify(localSuggestion, null, 2);
    void navigator.clipboard.writeText(snippet);
  }

  return (
    <div className="mt-3 space-y-2 border-t border-zinc-800/60 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" size="sm">
          API suggestion: {status}
        </Badge>
        <Button size="sm" variant="secondary" disabled={loading} onClick={generate}>
          {loading ? 'Generating…' : localSuggestion ? 'Regenerate API stub' : 'Suggest API'}
        </Button>
        {localSuggestion && (
          <>
            <Button size="sm" variant="secondary" onClick={copySnippet}>
              Copy OpenAPI stub
            </Button>
            {status !== 'reviewed' && (
              <Button size="sm" disabled={loading} onClick={markReviewed}>
                Mark reviewed
              </Button>
            )}
          </>
        )}
      </div>
      {localSuggestion && (
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-emerald-400/90">
          {JSON.stringify(localSuggestion, null, 2)}
        </pre>
      )}
    </div>
  );
}
