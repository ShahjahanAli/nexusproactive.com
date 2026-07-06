import { Suspense } from 'react';
import OnboardingContent from './onboarding-content';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
      <OnboardingContent />
    </Suspense>
  );
}
