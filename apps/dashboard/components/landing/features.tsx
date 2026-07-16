const featureGroups = [
  {
    title: 'Understand every request',
    description:
      'The platform helps the assistant interpret what the visitor needs and use the right source of truth.',
    points: [
      'Intent-aware routing across support, sales, technical, and account scenarios',
      'Typed OpenAPI sources such as products, services, FAQ, and customer information',
      'Conversation context and specialist behaviors for clearer answers',
    ],
  },
  {
    title: 'Connect to live business systems',
    description:
      'Use your existing backend instead of rebuilding your knowledge inside a chatbot tool.',
    points: [
      'OpenAPI ingestion discovers callable endpoints automatically',
      'Live API lookups keep answers aligned with current business data',
      'Clickable product or service links can be returned directly from your APIs',
    ],
  },
  {
    title: 'Act safely when it matters',
    description:
      'Nexus is designed for businesses that need control, not just automation for automation sake.',
    points: [
      'Risk-tiered actions separate safe reads from sensitive writes',
      'Inline approvals protect financial or irreversible operations',
      'Undo paths and action review improve operational safety',
    ],
  },
  {
    title: 'Operate and improve over time',
    description:
      'Beyond chat, the platform gives teams visibility into what is happening and what to optimize next.',
    points: [
      'Dashboard views for deployments, actions, conversations, and analytics',
      'Human escalation and queue handling for edge cases or sensitive moments',
      'Signals and unresolved patterns that surface product or service gaps',
    ],
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">
            Capabilities
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Built to make AI useful in real business workflows.
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-400 sm:text-lg">
            Instead of acting like a generic website chatbot, Nexus is designed to work as an operational layer
            between your visitors, your APIs, and your support team.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {featureGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-[28px] border border-white/5 bg-slate-900/50 p-6 sm:p-8"
            >
              <div className="inline-flex rounded-2xl bg-indigo-500/10 p-3 text-indigo-300 ring-1 ring-indigo-500/20">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
                  />
                </svg>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-slate-50">{group.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">{group.description}</p>
              <ul className="mt-6 space-y-3">
                {group.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-7 text-slate-300 sm:text-base">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
