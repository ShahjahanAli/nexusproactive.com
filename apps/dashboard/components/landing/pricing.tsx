import Link from 'next/link';

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    features: ['1 site', '500 conversations / mo', 'OpenAPI import', 'Action dashboard'],
    cta: 'Start free',
    recommended: false,
  },
  {
    name: 'Starter',
    price: '$49',
    period: 'per month',
    features: ['1 site', '2,000 conversations / mo', 'Specialist routing', 'Approvals + undo'],
    cta: 'Choose Starter',
    recommended: true,
  },
  {
    name: 'Growth',
    price: '$149',
    period: 'per month',
    features: ['5 sites', '10,000 conversations / mo', 'Product signals', 'Priority support'],
    cta: 'Choose Growth',
    recommended: false,
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="border-b border-zinc-800/60 bg-zinc-950 px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-lg">
          <p className="font-mono text-xs text-emerald-400">pricing</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Try it free. Pay when it earns its keep.
          </h2>
        </div>

        <div className="mt-12 grid overflow-hidden rounded-xl border border-zinc-800 md:grid-cols-3">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`flex flex-col p-7 ${
                i > 0 ? 'border-t border-zinc-800 md:border-l md:border-t-0' : ''
              } ${plan.recommended ? 'bg-zinc-900/60' : 'bg-transparent'}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-medium text-zinc-100">{plan.name}</h3>
                {plan.recommended && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                    most picked
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-zinc-50">
                  {plan.price}
                </span>
                <span className="font-mono text-xs text-zinc-500">{plan.period}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-baseline gap-2.5 text-sm text-zinc-400">
                    <span className="font-mono text-xs text-emerald-500/70">+</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-8 block rounded-md py-2.5 text-center text-sm font-medium transition ${
                  plan.recommended
                    ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                    : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-4 font-mono text-xs text-zinc-600">
          No card for the trial. Cancel anytime — your data exports with you.
        </p>
      </div>
    </section>
  );
}
