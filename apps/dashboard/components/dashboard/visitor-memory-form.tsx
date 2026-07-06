'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/dashboard/ui/button';

export function VisitorMemoryForm({
  visitorId,
  siteId,
}: {
  visitorId: string;
  siteId: string;
}) {
  const router = useRouter();
  const [fact, setFact] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fact.trim()) return;
    setLoading(true);
    await fetch(`/api/visitors/${encodeURIComponent(visitorId)}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, fact }),
    });
    setFact('');
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={fact}
        onChange={(e) => setFact(e.target.value)}
        placeholder="e.g. Prefers email support, VIP customer, last issue was billing…"
        className="flex-1"
      />
      <Button type="submit" disabled={loading}>
        Add memory
      </Button>
    </form>
  );
}
