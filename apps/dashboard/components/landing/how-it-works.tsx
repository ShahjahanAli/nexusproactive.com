const steps = [
  {
    index: '1',
    title: 'Connect your API',
    description: 'Paste your OpenAPI spec URL. Nexus imports endpoints and assigns risk tiers you can override.',
  },
  {
    index: '2',
    title: 'Set the rules',
    description: 'Pick which actions run free, which need approval, and where escalations go.',
  },
  {
    index: '3',
    title: 'Drop in two lines',
    description: 'One script tag, one element. Works on any site — no framework required.',
  },
  {
    index: '4',
    title: 'Watch it operate',
    description: 'Conversations, actions, approvals, and escalations stream into your dashboard.',
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-zinc-800/60 bg-zinc-950 px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <p className="font-mono text-xs text-emerald-400">setup</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Live in an afternoon.
            </h2>

            <ol className="mt-8 space-y-6">
              {steps.map((step) => (
                <li key={step.index} className="flex gap-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-700 font-mono text-xs text-zinc-400">
                    {step.index}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-medium text-zinc-100">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:pt-14">
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                <span className="font-mono text-xs text-zinc-500">index.html</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                  the whole integration
                </span>
              </div>
              <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-7">
                <code>
                  <span className="text-zinc-600">{'<!-- before </body> -->'}</span>
                  {'\n'}
                  <span className="text-zinc-400">{'<script '}</span>
                  <span className="text-sky-300">src</span>
                  <span className="text-zinc-500">=</span>
                  <span className="text-emerald-300">{'"https://api.nexusproactive.com/widget/nexus.js"'}</span>
                  <span className="text-zinc-400">{'></script>'}</span>
                  {'\n'}
                  <span className="text-zinc-400">{'<nexus-chat '}</span>
                  <span className="text-sky-300">site-id</span>
                  <span className="text-zinc-500">=</span>
                  <span className="text-emerald-300">{'"your-site-id"'}</span>
                  <span className="text-zinc-400">{'></nexus-chat>'}</span>
                </code>
              </pre>
            </div>
            <p className="mt-4 font-mono text-xs text-zinc-600">
              Ships as a web component. Shadow DOM — your CSS stays yours.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
