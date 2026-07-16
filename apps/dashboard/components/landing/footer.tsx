import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-sm font-bold text-white">
                N
              </span>
              <div>
                <p className="font-semibold text-slate-50">Nexus Widget</p>
                <p className="text-xs text-slate-500">AI chat platform for live business operations</p>
              </div>
            </Link>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              A cleaner way to connect website chat with business APIs, safe action controls, and human support operations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Platform</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><a href="#platform-overview" className="hover:text-slate-300">Overview</a></li>
                <li><a href="#features" className="hover:text-slate-300">Capabilities</a></li>
                <li><a href="#flow-diagram" className="hover:text-slate-300">Flow</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><a href="#how-it-works" className="hover:text-slate-300">Getting started</a></li>
                <li><a href="#pricing" className="hover:text-slate-300">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Account</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><Link href="/signup" className="hover:text-slate-300">Sign up</Link></li>
                <li><Link href="/login" className="hover:text-slate-300">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Legal</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><span className="cursor-default">Privacy</span></li>
                <li><span className="cursor-default">Terms</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 text-xs text-slate-600">
          Copyright {new Date().getFullYear()} Nexus Widget. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
