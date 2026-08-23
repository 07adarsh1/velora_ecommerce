import { Link } from 'react-router-dom';

/** Centered card shell shared by the auth pages (docs/ui-prd.md §4.9). */
export function AuthCard({ title, subtitle, children }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-6">
      <Link to="/" className="font-display text-xl font-semibold tracking-tight text-ink">
        Vel<span className="text-accent">ora</span>
      </Link>
      <div className="mt-6 w-full rounded-card border border-line bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function AuthFooterLink({ text, to, label }) {
  return (
    <p className="mt-5 text-center text-sm text-ink-soft">
      {text}{' '}
      <Link to={to} className="font-medium text-accent hover:text-accent-hover">
        {label}
      </Link>
    </p>
  );
}
