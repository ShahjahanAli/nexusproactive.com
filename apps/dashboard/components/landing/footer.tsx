import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="bg-zinc-950 px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500 font-mono text-xs font-bold text-zinc-950">
            n
          </span>
          <span className="text-sm font-medium text-zinc-300">nexus</span>
          <span className="ml-2 font-mono text-xs text-zinc-600">
            © {new Date().getFullYear()}
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-zinc-500">
          <a href="#features" className="transition hover:text-zinc-300">What it does</a>
          <a href="#pricing" className="transition hover:text-zinc-300">Pricing</a>
          <Link href="/login" className="transition hover:text-zinc-300">Sign in</Link>
          <Link href="/signup" className="transition hover:text-zinc-300">Sign up</Link>
        </nav>
      </div>
    </footer>
  );
}
