const steps = [
  {
    step: '01',
    title: 'Create a deployment',
    description:
      'Add your site, brand details, and the backend URL your assistant should rely on.',
  },
  {
    step: '02',
    title: 'Connect typed OpenAPI sources',
    description:
      'Attach product, service, FAQ, customer, or other API sources so the assistant knows where to fetch each type of information.',
  },
  {
    step: '03',
    title: 'Review actions and safety rules',
    description:
      'Verify discovered operations, adjust risk tiers if needed, and keep sensitive actions behind approval gates.',
  },
  {
    step: '04',
    title: 'Embed and launch the widget',
    description:
      'Drop the chat widget into your website and start handling real visitor questions with live business context.',
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-white/5 bg-slate-900/20 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">
              Getting started
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
              A setup path teams can actually follow.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-400 sm:text-lg">
              The platform is designed to be understandable during evaluation and manageable during rollout.
              Teams can move from connection to launch without building a custom chat flow system from scratch.
            </p>
          </div>

          <div className="grid gap-4">
            {steps.map((item) => (
              <div
                key={item.step}
                className="flex gap-4 rounded-[28px] border border-white/5 bg-slate-950/60 p-6 sm:gap-5 sm:p-7"
              >
                <span className="shrink-0 font-mono text-2xl font-bold text-indigo-500/40 sm:text-3xl">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-50 sm:text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400 sm:text-base">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}