import Link from 'next/link';

export function LandingCta() {
  return (
    <section className="border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-600/20 via-slate-900 to-violet-600/20 px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.15),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
              Ready to go beyond FAQ bots?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-400 sm:text-lg">
              Connect your first site, ingest your API, and ship an action-native chatbot today.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:text-base"
              >
                Start free trial
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/5 sm:text-base"
              >
                Sign in to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
