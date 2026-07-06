'use client';

import { Button } from '@/components/dashboard/ui/button';

export function BillingActions() {
  async function openPortal() {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  return (
    <Button variant="secondary" size="sm" onClick={openPortal}>
      Stripe portal
    </Button>
  );
}
