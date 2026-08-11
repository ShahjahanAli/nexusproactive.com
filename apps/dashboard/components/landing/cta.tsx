import Link from 'next/link';

export function LandingCta() {
  return (
    <section className="border-b border-zinc-800/60 bg-zinc-950 px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Your API can already answer most tickets.
          </h2>
          <p className="mt-2 text-sm text-zinc-400">Let it. 14 days free, two lines of HTML.</p>
        </div>
        <Link
          href="/signup"
          className="shrink-0 rounded-md bg-emerald-500 px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
        >
          Start free trial
        </Link>
      </div>
    </section>
  );
}
