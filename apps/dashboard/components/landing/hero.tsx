import Link from 'next/link';

const operatingPoints = [
  'Connect your existing backend through OpenAPI',
  'Answer with live business data instead of static FAQ text',
  'Approve sensitive actions before they run',
  'Escalate to human teams without losing context',
];

const trustItems = [
  { label: 'API-connected', value: 'Live data' },
  { label: 'Action safety', value: 'Risk-aware approvals' },
  { label: 'Human support', value: 'Queue and handoff' },
  { label: 'Operational insight', value: 'Analytics + signals' },
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8 lg:pb-32 lg:pt-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_55%)]" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-[90px]" />
        <div className="absolute left-0 top-32 h-72 w-72 rounded-full bg-violet-500/10 blur-[90px]" />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
              </span>
              Professional AI support and action platform
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl lg:text-6xl lg:leading-[1.05]">
              Help customers with an AI assistant that understands your business and can act on it.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
              Nexus Widget connects your website chat to your business APIs, so visitors can ask questions,
              discover products or services, complete supported actions, and reach a human team when needed.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:text-base"
              >
                Start free trial
              </Link>
              <a
                href="#flow-diagram"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur transition hover:border-white/20 hover:bg-white/10 sm:text-base"
              >
                See platform flow
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {operatingPoints.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="text-sm text-slate-300">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {trustItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="rounded-[24px] border border-white/5 bg-slate-950 p-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-50">Website visitor chat</p>
                    <p className="text-xs text-emerald-400">AI plus live API actions</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                    Live session
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-indigo-500/20 px-4 py-3 text-sm text-slate-100">
                    Can you show me your September conferences and help me register?
                  </div>
                  <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-white/5 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                    I found upcoming September conferences from the connected conference API. I can also guide the visitor to registration and capture contact details if they want follow-up.
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">API data</p>
                    <p className="mt-2 text-sm font-medium text-slate-50">Conference listings</p>
                    <p className="mt-1 text-xs text-slate-400">Products, services, events, FAQs, account info</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Approval gate</p>
                    <p className="mt-2 text-sm font-medium text-slate-50">Sensitive actions stay controlled</p>
                    <p className="mt-1 text-xs text-slate-400">Irreversible and financial actions require confirmation</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/5 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-50">Operator view</p>
                      <p className="text-xs text-slate-500">Everything is visible in the dashboard</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">
                      Audit-ready
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2">Action review</div>
                    <div className="rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2">Human handoff</div>
                    <div className="rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2">Signals plus analytics</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -left-4 top-8 hidden rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur sm:block">
              <p className="text-xs text-slate-500">Connected sources</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">Products | Services | FAQ | Customer Info</p>
            </div>
            <div className="absolute -bottom-5 right-3 hidden rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur sm:block">
              <p className="text-xs text-slate-500">Safety model</p>
              <p className="mt-1 text-sm font-semibold text-emerald-300">Read live | Approve writes | Escalate humans</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
