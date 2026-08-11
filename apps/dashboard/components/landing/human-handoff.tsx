export function LandingHumanHandoff() {
  return (
    <section id="human-handoff" className="border-b border-zinc-800/60 bg-zinc-950 px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-20">
          <div>
            <p className="font-mono text-xs text-emerald-400">handoff</p>
            <h2 className="mt-3 max-w-md text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              A French visitor. An English-speaking agent. Nobody notices.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-zinc-400">
              When a chat escalates, Nexus detects the visitor&rsquo;s language and writes an
              English brief for whoever claims it — what they want, what the AI already did,
              what to do next. The visitor keeps chatting in their own language. When the human
              part is done, the chat goes back to the AI in one click.
            </p>
            <p className="mt-5 font-mono text-xs text-zinc-600">
              detect language → write brief → agent claims → return to AI
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                  GC
                </span>
                <div>
                  <p className="text-[13px] font-medium text-zinc-200">Visitor c48dc6da…</p>
                  <p className="font-mono text-[10px] text-zinc-500">escalated · waiting 12s</p>
                </div>
              </div>
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-violet-300">
                fr
              </span>
            </div>

            <div className="px-4 py-4">
              <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 px-3.5 py-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-violet-300">
                  agent brief
                </p>
                <dl className="mt-2 space-y-1 text-[13px] leading-6">
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-zinc-500">Intent</dt>
                    <dd className="text-zinc-300">invitation letter status for a paid order</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-zinc-500">AI did</dt>
                    <dd className="text-zinc-300">confirmed payment, order ORD-…8C345B</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-zinc-500">Next</dt>
                    <dd className="text-zinc-300">confirm the 3-business-day letter timeline</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="w-fit max-w-[85%] rounded-lg rounded-bl-sm border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-[13px] text-zinc-300">
                  Bonjour, où est ma lettre d&rsquo;invitation ?
                </div>
                <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-emerald-600/90 px-3.5 py-2 text-[13px] text-white">
                  Bonjour ! Votre lettre arrive sous 3 jours ouvrables.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
