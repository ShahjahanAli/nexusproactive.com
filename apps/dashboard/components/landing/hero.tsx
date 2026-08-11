import Link from 'next/link';

export function LandingHero() {
  return (
    <section className="border-b border-zinc-800/60 bg-zinc-950 px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="pt-2">
            <p className="font-mono text-xs text-emerald-400">
              chat widget · action engine · human inbox
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-50 sm:text-5xl lg:text-[3.4rem]">
              Support chat that
              <br />
              does the work.
            </h1>

            <p className="mt-6 max-w-md text-[15px] leading-7 text-zinc-400">
              Nexus reads your OpenAPI spec and turns your endpoints into things a website
              visitor can just ask for — order lookups, registrations, account changes.
              Risky operations wait for approval. Humans are one click away.
            </p>

            <div className="mt-8 flex items-center gap-3">
              <Link
                href="/signup"
                className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
              >
                Start free trial
              </Link>
              <a
                href="#how-it-works"
                className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                See setup
              </a>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-zinc-500">
              <span className="text-zinc-300">ask</span>
              <span>→</span>
              <span className="text-zinc-300">route</span>
              <span>→</span>
              <span className="text-zinc-300">act</span>
              <span>→</span>
              <span className="text-amber-400/80">approve if risky</span>
              <span>→</span>
              <span className="text-zinc-300">hand off if human</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <p className="text-[13px] font-medium text-zinc-200">GCA Assistant</p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                live
              </span>
            </div>

            <div className="space-y-3 px-4 py-5">
              <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-emerald-600/90 px-3.5 py-2.5 text-[13px] leading-6 text-white">
                What&rsquo;s my order status? ORD-20260712-8C345B
              </div>

              <div className="w-fit font-mono text-[11px] text-zinc-500">
                → billing specialist · GET /orders/&#123;id&#125; · 214ms
              </div>

              <div className="w-fit max-w-[90%] rounded-lg rounded-bl-sm border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-[13px] leading-6 text-zinc-300">
                Paid ✓ — Author ticket for the Global Conference on African Business &amp;
                Technology, July 31 – Aug 2. Your confirmation email is on the way.
              </div>

              <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-emerald-600/90 px-3.5 py-2.5 text-[13px] leading-6 text-white">
                Actually, cancel it and refund me.
              </div>

              <div className="w-fit max-w-[90%] rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
                  approval required · financial
                </p>
                <p className="mt-1.5 text-[13px] leading-6 text-zinc-300">
                  Refund $2.00 to card ending 4242 and cancel registration 2026-TOR-GCABT?
                </p>
                <div className="mt-2.5 flex gap-2">
                  <span className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
                    Approve
                  </span>
                  <span className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                    Decline
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
