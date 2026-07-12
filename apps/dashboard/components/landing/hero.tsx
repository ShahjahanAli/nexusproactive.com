import Link from 'next/link';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8 lg:pb-32 lg:pt-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -right-20 top-40 h-72 w-72 rounded-full bg-violet-600/10 blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 sm:text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
            </span>
            Action-native conversational layer
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Chatbots that{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              execute
            </span>{' '}
            your backend — not just answer FAQs
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg lg:mx-0">
            Nexus Widget introspects your OpenAPI spec, classifies action risk, and
            safely runs read/write operations with undo and inline approval cards.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 transition hover:bg-indigo-400 sm:text-base"
            >
              Start free trial
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur transition hover:border-white/20 hover:bg-white/10 sm:text-base"
            >
              See how it works
            </a>
          </div>

          <p className="mt-4 text-xs text-slate-500 sm:text-sm">
            No credit card required · 500 conversations/month on trial
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="rounded-xl bg-slate-950 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600" />
                <div>
                  <p className="text-sm font-medium text-slate-50">Nexus Assistant</p>
                  <p className="text-xs text-emerald-400">Online · Billing specialist</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-500/20 px-3 py-2 text-sm text-slate-200">
                  Can you cancel order #4821 and refund me?
                </div>
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-white/5 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                  I found a cancel action. This is irreversible — please confirm below.
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs font-medium text-amber-200">Approval required</p>
                  <p className="mt-1 text-xs text-slate-400">POST /orders/4821/cancel · Refund $129.00</p>
                  <div className="mt-3 flex gap-2">
                    <span className="flex-1 rounded-lg bg-indigo-500 py-1.5 text-center text-xs font-medium text-slate-50">
                      Confirm
                    </span>
                    <span className="flex-1 rounded-lg border border-white/10 py-1.5 text-center text-xs text-slate-400">
                      Decline
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-4 -left-4 hidden rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 shadow-xl backdrop-blur sm:block">
            <p className="text-xs text-slate-400">Risk tier</p>
            <p className="text-sm font-medium text-amber-400">Irreversible write</p>
          </div>
          <div className="absolute -right-2 -top-3 hidden rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 shadow-xl backdrop-blur sm:block">
            <p className="text-xs text-slate-400">Actions discovered</p>
            <p className="text-sm font-medium text-emerald-400">847 from OpenAPI</p>
          </div>
        </div>
      </div>
    </section>
  );
}
