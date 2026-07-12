import Link from 'next/link';
import { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary:
    'border-amber-600/50 bg-amber-950/60 text-amber-400 hover:border-amber-500/70 hover:bg-amber-950',
  secondary:
    'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100',
  ghost: 'border-transparent text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200',
  danger:
    'border-red-500/30 bg-red-950/40 text-red-400 hover:border-red-500/50 hover:bg-red-950/60',
};

const sizes = {
  sm: 'px-3 py-1.5 text-[10px]',
  md: 'px-4 py-2 text-xs',
  lg: 'px-5 py-2.5 text-xs',
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
      className={`inline-flex items-center justify-center rounded border font-mono uppercase tracking-wider transition disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
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
      className={`inline-flex items-center justify-center rounded border font-mono uppercase tracking-wider transition ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Input({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </label>
      )}
      <input
        className={`w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 ${className}`}
        {...props}
      />
    </div>
  );
}

export function Select({
  label,
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </label>
      )}
      <select
        className={`w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function Textarea({
  label,
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </label>
      )}
      <textarea
        className={`w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 ${className}`}
        {...props}
      />
    </div>
  );
}
