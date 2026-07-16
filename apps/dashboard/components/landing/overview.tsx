const overviewCards = [
  {
    eyebrow: 'Connect',
    title: 'Bring your business APIs into chat',
    description:
      'Add your site, connect one or more OpenAPI sources, and let Nexus understand which data and actions your assistant can use.',
  },
  {
    eyebrow: 'Understand',
    title: 'Answer with live operational data',
    description:
      'The assistant looks up real products, services, events, orders, and account details instead of guessing from generic web knowledge.',
  },
  {
    eyebrow: 'Control',
    title: 'Keep actions safe and visible',
    description:
      'Approvals, risk tiers, undo support, and action review protect sensitive workflows while still keeping the experience fast.',
  },
  {
    eyebrow: 'Operate',
    title: 'Run support and growth from one dashboard',
    description:
      'Monitor deployments, review actions, track conversation signals, and hand off to human teams when AI should not act alone.',
  },
];

export function LandingOverview() {
  return (
    <section id="platform-overview" className="border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-12">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">
              Platform overview
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
              A clearer way to understand what this platform actually does.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
              Nexus is built for organizations that want an AI chat experience connected to real business systems.
              It helps visitors get answers, discover offerings, and complete supported tasks without breaking your
              operational controls.
            </p>
            <div className="mt-8 rounded-3xl border border-white/5 bg-slate-900/40 p-6">
              <p className="text-sm font-semibold text-slate-100">Best fit for teams that need:</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li>Live product, service, event, or account data inside chat</li>
                <li>Safer execution of backend actions with approvals</li>
                <li>Human escalation when a request needs manual help</li>
                <li>Operational insight into what customers are asking for</li>
              </ul>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {overviewCards.map((card) => (
              <div
                key={card.title}
                className="rounded-3xl border border-white/5 bg-slate-900/50 p-6 shadow-sm transition hover:border-indigo-500/20 hover:bg-slate-900/70"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-400">{card.eyebrow}</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-50">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}