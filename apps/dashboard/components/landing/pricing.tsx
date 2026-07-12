import Link from 'next/link';

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    description: 'Evaluate Nexus on one site.',
    features: ['1 site', '500 conversations/mo', 'Action Graph ingestion', 'Risk-tier gating'],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'For small teams getting started.',
    features: ['1 site', '2,000 conversations/mo', 'Specialist agents', 'Undo ledger'],
    cta: 'Get Starter',
    highlighted: true,
  },
  {
    name: 'Growth',
    price: '$149',
    period: '/month',
    description: 'For growing businesses.',
    features: ['5 sites', '10,000 conversations/mo', 'Product Signals', 'Priority support'],
    cta: 'Get Growth',
    highlighted: false,
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-indigo-400">
            Pricing
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl md:text-4xl">
            Simple, transparent plans
          </h2>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">
            Start free. Upgrade when you need more sites or volume.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 ${
                plan.highlighted
                  ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-slate-900/50 shadow-xl shadow-indigo-500/10'
                  : 'border-white/5 bg-slate-900/50'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-0.5 text-xs font-medium text-slate-50">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-50">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-50 sm:text-4xl">{plan.price}</span>
                <span className="text-sm text-slate-400">{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{plan.description}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition ${
                  plan.highlighted
                    ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                    : 'border border-white/10 text-slate-200 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
