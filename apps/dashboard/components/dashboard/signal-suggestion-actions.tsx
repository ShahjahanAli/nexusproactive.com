'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';

function suggestionSummary(suggestion: Record<string, unknown> | null) {
  if (!suggestion) return null;
  const method = String(suggestion.method ?? 'get').toUpperCase();
  const path = String(suggestion.path ?? '');
  const summary = String(suggestion.summary ?? suggestion.operationId ?? '');
  return { method, path, summary };
}

const suggestionStatusLabel: Record<string, string> = {
  none: 'No API stub yet',
  ready: 'Stub ready to review',
  reviewed: 'Stub reviewed',
};

export function SignalSuggestionActions({
  signalId,
  suggestion,
  suggestionStatus,
  signalStatus,
}: {
  signalId: string;
  suggestion?: Record<string, unknown> | null;
  suggestionStatus?: string | null;
  signalStatus?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<'suggest' | 'review' | 'status' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localSuggestion, setLocalSuggestion] = useState(suggestion ?? null);
  const [status, setStatus] = useState(suggestionStatus ?? 'none');
  const [rowStatus, setRowStatus] = useState(signalStatus ?? 'new');
  const [showRaw, setShowRaw] = useState(false);

  const summary = suggestionSummary(localSuggestion);

  async function generate() {
    setLoading('suggest');
    setError(null);
    try {
      const res = await fetch(`/api/signals/${signalId}/suggest-api`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not generate suggestion');
        return;
      }
      setLocalSuggestion(data.suggestion);
      setStatus('ready');
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function markReviewed() {
    setLoading('review');
    setError(null);
    try {
      const res = await fetch(`/api/signals/${signalId}/review-suggestion`, { method: 'POST' });
      if (!res.ok) {
        setError('Could not mark suggestion reviewed');
        return;
      }
      setStatus('reviewed');
      setRowStatus('reviewed');
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function setSignalStatus(next: 'new' | 'reviewed' | 'resolved') {
    setLoading('status');
    setError(null);
    try {
      const res = await fetch(`/api/signals/${signalId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setError('Could not update signal status');
        return;
      }
      setRowStatus(next);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function copySnippet() {
    if (!localSuggestion) return;
    void navigator.clipboard.writeText(JSON.stringify(localSuggestion, null, 2));
  }

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-800/60 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={status === 'reviewed' ? 'success' : status === 'ready' ? 'info' : 'default'}
          size="sm"
        >
          {suggestionStatusLabel[status] ?? `API suggestion: ${status}`}
        </Badge>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading !== null}
          onClick={generate}
        >
          {loading === 'suggest'
            ? 'Generating…'
            : localSuggestion
              ? 'Regenerate stub'
              : 'Suggest API'}
        </Button>
        {localSuggestion && (
          <>
            <Button size="sm" variant="secondary" onClick={copySnippet}>
              Copy OpenAPI
            </Button>
            {status !== 'reviewed' && (
              <Button size="sm" disabled={loading !== null} onClick={markReviewed}>
                {loading === 'review' ? 'Saving…' : 'Mark stub reviewed'}
              </Button>
            )}
          </>
        )}
      </div>

      {summary && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-emerald-400">
              {summary.method}
            </span>
            <code className="font-mono text-xs text-zinc-200">{summary.path || '—'}</code>
          </div>
          {summary.summary && (
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{summary.summary}</p>
          )}
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="mt-2 text-[11px] font-medium text-zinc-500 hover:text-zinc-300"
          >
            {showRaw ? 'Hide raw JSON' : 'Show raw OpenAPI stub'}
          </button>
          {showRaw && (
            <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-emerald-400/90">
              {JSON.stringify(localSuggestion, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Signal status
        </span>
        {rowStatus !== 'resolved' && (
          <Button
            size="sm"
            variant="secondary"
            disabled={loading !== null}
            onClick={() => setSignalStatus('resolved')}
          >
            {loading === 'status' ? 'Updating…' : 'Mark resolved'}
          </Button>
        )}
        {rowStatus === 'resolved' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={loading !== null}
            onClick={() => setSignalStatus('new')}
          >
            Reopen
          </Button>
        )}
        {rowStatus === 'new' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={loading !== null}
            onClick={() => setSignalStatus('reviewed')}
          >
            Mark reviewed
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
