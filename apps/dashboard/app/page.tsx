import { LandingHeader } from '@/components/landing/header';
import { LandingHero } from '@/components/landing/hero';
import { LandingOverview } from '@/components/landing/overview';
import { LandingFeatures } from '@/components/landing/features';
import { LandingHowItWorks } from '@/components/landing/how-it-works';
import { LandingFlowDiagram } from '@/components/landing/flow-diagram';
import { LandingUseCases } from '@/components/landing/use-cases';
import { LandingPricing } from '@/components/landing/pricing';
import { LandingCta } from '@/components/landing/cta';
import { LandingFooter } from '@/components/landing/footer';

export default function HomePage() {
  return (
    <div className="min-h-full bg-background font-sans text-foreground transition-colors">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingOverview />
        <LandingFeatures />
        <LandingFlowDiagram />
        <LandingHowItWorks />
        <LandingUseCases />
        <LandingPricing />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
