import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                N
              </span>
              <span className="font-semibold text-white">Nexus Widget</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              Action-native chatbot platform for teams who need more than documentation search.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-slate-300">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-slate-300">How it works</a></li>
                <li><a href="#pricing" className="hover:text-slate-300">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><Link href="/signup" className="hover:text-slate-300">Sign up</Link></li>
                <li><Link href="/login" className="hover:text-slate-300">Sign in</Link></li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Legal</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><span className="cursor-default">Privacy</span></li>
                <li><span className="cursor-default">Terms</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 text-center text-xs text-slate-600 sm:text-left">
          © {new Date().getFullYear()} Nexus Widget. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
