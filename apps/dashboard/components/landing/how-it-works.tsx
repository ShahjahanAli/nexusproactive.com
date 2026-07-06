const steps = [
  {
    step: '01',
    title: 'Connect your site',
    description: 'Add your domain and OpenAPI spec URL. Nexus builds a live Action Graph automatically.',
  },
  {
    step: '02',
    title: 'Review risk tiers',
    description: 'Every action is classified as read-only, reversible, irreversible, or financial. Override in the dashboard.',
  },
  {
    step: '03',
    title: 'Embed the widget',
    description: 'Paste one script tag. The chatbot streams responses, handoffs, approvals, and undo buttons inline.',
  },
  {
    step: '04',
    title: 'Learn from gaps',
    description: 'Product Signals surfaces what customers ask for that your product doesn\'t yet support.',
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-white/5 bg-slate-900/30 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-indigo-400">
            How it works
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            Live in minutes, not months
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:gap-8">
          {steps.map((item, index) => (
            <div
              key={item.step}
              className="relative flex gap-4 rounded-2xl border border-white/5 bg-slate-950/60 p-6 sm:gap-5 sm:p-8"
            >
              <span className="shrink-0 font-mono text-2xl font-bold text-indigo-500/40 sm:text-3xl">
                {item.step}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white sm:text-xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-base">
                  {item.description}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className="absolute -bottom-3 left-1/2 hidden h-6 w-px bg-gradient-to-b from-indigo-500/50 to-transparent lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
