import Link from 'next/link';

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    description: 'A clean evaluation path for teams validating fit and early workflow design.',
    features: ['1 site', '500 conversations/mo', 'OpenAPI ingestion', 'Action review dashboard'],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'For smaller teams launching AI support on a live production site.',
    features: ['1 site', '2,000 conversations/mo', 'Specialist behaviors', 'Safety gating + undo support'],
    cta: 'Choose Starter',
    highlighted: true,
  },
  {
    name: 'Growth',
    price: '$149',
    period: '/month',
    description: 'For businesses scaling across multiple deployments and more customer volume.',
    features: ['5 sites', '10,000 conversations/mo', 'Signals + analytics', 'Priority operational support'],
    cta: 'Choose Growth',
    highlighted: false,
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="border-t border-white/5 bg-slate-900/20 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-12">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">Pricing</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
              Straightforward pricing for evaluation and growth.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-400 sm:text-lg">
              Start with a free trial, validate how the platform fits your business workflows, then expand when you need
              more sites, more volume, and deeper operational usage.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-[28px] border p-6 sm:p-8 ${
                  plan.highlighted
                    ? 'border-indigo-500/40 bg-gradient-to-b from-indigo-500/12 to-slate-900/60 shadow-xl shadow-indigo-500/10'
                    : 'border-white/5 bg-slate-900/50'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">
                    Recommended
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-50">{plan.name}</h3>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-50">{plan.price}</span>
                  <span className="pb-1 text-sm text-slate-400">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-400">{plan.description}</p>

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
                  className={`mt-8 block rounded-2xl py-3 text-center text-sm font-semibold transition ${
                    plan.highlighted
                      ? 'bg-white text-slate-950 hover:bg-slate-100'
                      : 'border border-white/10 text-slate-200 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}