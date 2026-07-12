import { LandingHeader } from '@/components/landing/header';
import { LandingHero } from '@/components/landing/hero';
import { LandingFeatures } from '@/components/landing/features';
import { LandingHowItWorks } from '@/components/landing/how-it-works';
import { LandingPricing } from '@/components/landing/pricing';
import { LandingCta } from '@/components/landing/cta';
import { LandingFooter } from '@/components/landing/footer';

export default function HomePage() {
  return (
    <div className="min-h-full bg-background font-sans text-foreground transition-colors">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingPricing />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
