import { LandingHeader } from '@/components/landing/header';
import { LandingHero } from '@/components/landing/hero';
import { LandingFeatures } from '@/components/landing/features';
import { LandingHumanHandoff } from '@/components/landing/human-handoff';
import { LandingHowItWorks } from '@/components/landing/how-it-works';
import { LandingPricing } from '@/components/landing/pricing';
import { LandingCta } from '@/components/landing/cta';
import { LandingFooter } from '@/components/landing/footer';

export default function HomePage() {
  return (
    <div className="min-h-full bg-zinc-950 font-sans text-zinc-100 antialiased">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHumanHandoff />
        <LandingHowItWorks />
        <LandingPricing />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
