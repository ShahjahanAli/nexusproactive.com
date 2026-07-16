import Link from 'next/link';

export function LandingCta() {
  return (
    <section className="border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent_40%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">Get started</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
                Launch a cleaner, more useful AI experience for your customers.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
                Connect your APIs, review how actions should behave, and deploy a chat experience that explains,
                assists, and escalates with much more clarity than a basic FAQ bot.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:text-base"
              >
                Start free trial
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-slate-50 transition hover:bg-white/5 sm:text-base"
              >
                Open dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}