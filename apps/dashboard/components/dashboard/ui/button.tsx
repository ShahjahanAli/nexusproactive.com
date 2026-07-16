import Link from 'next/link';
import { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary:
    'border-emerald-600/50 bg-emerald-600 text-white hover:border-emerald-500/70 hover:bg-emerald-500',
  secondary:
    'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100',
  ghost: 'border-transparent text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-200',
  danger:
    'border-red-500/30 bg-red-950/40 text-red-400 hover:border-red-500/50 hover:bg-red-950/60',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
};

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: BtnProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg border font-medium transition disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: {
  href: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-lg border font-medium transition ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Input({
  label,
  hint,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <input
        className={`w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 ${className}`}
        {...props}
      />
      {hint && (
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{hint}</p>
      )}
    </div>
  );
}
