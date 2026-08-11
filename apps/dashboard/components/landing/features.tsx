const features = [
  {
    index: '01',
    title: 'Actions from your OpenAPI spec',
    description:
      'Point Nexus at your spec. Every endpoint becomes something the assistant can call — re-synced nightly, answered from live data.',
    detail: 'GET /orders · GET /events · POST /registrations',
  },
  {
    index: '02',
    title: 'Risk tiers with real teeth',
    description:
      'Reads run instantly. Writes get an undo window. Refunds and cancellations stop and wait for a signed, one-time approval.',
    detail: 'read_only · reversible_write · irreversible_write · financial',
  },
  {
    index: '03',
    title: 'Specialist routing',
    description:
      'Messages are classified by meaning — misspelled, informal, or in another language — and land with a billing, sales, technical, or account specialist.',
    detail: 'router → billing · technical · sales · account',
  },
  {
    index: '04',
    title: 'Human handoff with context',
    description:
      'Visitors escalate in one click. Agents claim from a live inbox with the language detected and an English brief already written.',
    detail: 'queue → claim → reply → return to AI',
  },
  {
    index: '05',
    title: 'Proactive triggers & memory',
    description:
      'Nexus remembers returning visitors, opens conversations on page or idle events, and captures leads mid-conversation — no forms.',
    detail: 'page_view · idle · custom_event → lead.created',
  },
  {
    index: '06',
    title: 'Product signals',
    description:
      'When customers keep asking for something your API can\u2019t do, Nexus clusters the demand and drafts the endpoint that would fix it.',
    detail: 'unresolved intents → suggested OpenAPI stub',
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-b border-zinc-800/60 bg-zinc-950 px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-lg">
          <p className="font-mono text-xs text-emerald-400">what it does</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            The layer between your visitors and your backend.
          </h2>
        </div>

        <div className="mt-12 grid gap-x-16 lg:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.index}
              className="border-t border-zinc-800/70 py-7"
            >
              <div className="flex gap-5">
                <span className="pt-0.5 font-mono text-xs text-zinc-600">{feature.index}</span>
                <div>
                  <h3 className="text-[15px] font-medium text-zinc-100">{feature.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                    {feature.description}
                  </p>
                  <p className="mt-3 font-mono text-[11px] text-zinc-600">{feature.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
