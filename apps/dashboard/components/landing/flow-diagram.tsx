const flowSteps = [
  {
    id: '01',
    title: 'Visitor asks in plain language',
    body: 'A customer asks about products, services, conferences, orders, FAQs, or support needs through the website widget.',
  },
  {
    id: '02',
    title: 'AI routes the request',
    body: 'Nexus identifies intent and chooses the most relevant specialist behavior and connected API sources for that conversation.',
  },
  {
    id: '03',
    title: 'Platform reads live business data',
    body: 'The assistant calls your connected OpenAPI endpoints to fetch current business information instead of relying on static content.',
  },
  {
    id: '04',
    title: 'Safe actions are handled correctly',
    body: 'Read-only tasks can run immediately. Sensitive or irreversible actions can require review, approval, or human intervention.',
  },
  {
    id: '05',
    title: 'Team keeps visibility and control',
    body: 'Every deployment, action, handoff, and trend is visible in the dashboard so teams can refine operations over time.',
  },
];

export function LandingFlowDiagram() {
  return (
    <section id="flow-diagram" className="border-t border-white/5 bg-slate-900/30 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">Platform flow</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            How Nexus works from question to outcome.
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-400 sm:text-lg">
            This flow shows how the platform turns a customer message into a grounded response, a safe action,
            or a human handoff.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-[32px] border border-white/5 bg-slate-950/70 p-6 sm:p-8">
          <div className="grid gap-4 xl:grid-cols-5">
            {flowSteps.map((step, index) => (
              <div key={step.id} className="relative rounded-3xl border border-white/5 bg-slate-900/60 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                    {step.id}
                  </span>
                  {index < flowSteps.length - 1 && (
                    <span className="hidden text-slate-600 xl:inline-flex">?</span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-50">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-emerald-500/15 bg-emerald-500/5 p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Input layer</p>
                <p className="mt-2 text-sm text-slate-300">Website widget, visitor context, conversation history</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Decision layer</p>
                <p className="mt-2 text-sm text-slate-300">Routing, specialist behavior, approvals, escalation controls</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Business layer</p>
                <p className="mt-2 text-sm text-slate-300">OpenAPI sources, backend actions, analytics, product signals</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}