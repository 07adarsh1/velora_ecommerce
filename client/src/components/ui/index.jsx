import { useEffect, useState } from 'react';
import { Check, ImageIcon, Minus, PackageSearch, Plus, X } from 'lucide-react';
import { cimg } from '../../lib/utils/image';

// ─── Button ──────────────────────────────────────────────────────────────────
const buttonVariants = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:translate-y-px',
  secondary: 'bg-surface text-ink border border-line hover:border-ink-soft/50 active:translate-y-px',
  danger: 'bg-danger text-white hover:opacity-90 active:translate-y-px',
  ghost: 'text-accent hover:bg-accent-soft active:translate-y-px',
};

const buttonSizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-sm' };

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-input font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

// ─── Input / Select ──────────────────────────────────────────────────────────
export function Input({ label, error, id, className = '', ...rest }) {
  const inputId = id || rest.name;
  const errorId = inputId ? `${inputId}-error` : undefined;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className={`block w-full rounded-input border bg-surface px-3 py-2 text-sm text-ink shadow-none transition-colors placeholder:text-ink-soft/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${
          error ? 'border-danger' : 'border-line'
        } ${className}`}
        {...rest}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({ label, error, id, className = '', children, ...rest }) {
  const selectId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`block w-full rounded-input border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className={`relative max-h-[90vh] w-full overflow-y-auto rounded-media border border-line bg-surface p-6 shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded p-1.5 text-ink-soft hover:bg-canvas hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Drawer (Right-side slide-over for edit forms) ──────────────────────────
export function Drawer({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-ink/50 backdrop-blur-[2px] transition-opacity" onClick={onClose} aria-hidden="true" />
      <div className={`drawer-right relative z-10 flex h-full w-full flex-col border-l border-line bg-surface p-6 shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-y-auto`}>
        <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded p-1.5 text-ink-soft hover:bg-canvas hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Skeleton / Spinner ──────────────────────────────────────────────────────
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton-shimmer rounded-input ${className}`} aria-hidden="true" />;
}

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Empty / Error states ────────────────────────────────────────────────────
export function EmptyState({ title, description, action, icon }) {
  const Icon = icon || PackageSearch;
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-canvas px-6 py-16 text-center">
      <Icon className="h-8 w-8 text-ink-soft/60" aria-hidden="true" />
      <p className="mt-4 font-display text-lg text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-danger/30 bg-danger/5 px-6 py-12 text-center" role="alert">
      <p className="font-display text-lg text-ink">Something went wrong</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{message || 'An unexpected error occurred.'}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────
const badgeColors = {
  gray: 'bg-canvas text-ink-soft border-line',
  green: 'bg-success/10 text-success border-success/20',
  yellow: 'bg-warn/10 text-warn border-warn/20',
  red: 'bg-danger/10 text-danger border-danger/20',
  blue: 'bg-accent-soft text-accent border-accent/20',
  indigo: 'bg-accent-soft text-accent border-accent/20',
};

export function Badge({ color = 'gray', children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColors[color]}`}>
      {children}
    </span>
  );
}

export const ORDER_STATUS_COLORS = {
  PENDING_PAYMENT: 'yellow',
  PAYMENT_CONFIRMED: 'blue',
  PAYMENT_FAILED: 'red',
  PROCESSING: 'indigo',
  SHIPPED: 'indigo',
  DELIVERED: 'green',
  CANCELLED: 'gray',
  RETURN_REQUESTED: 'yellow',
  REFUNDED: 'gray',
};

// ─── Pagination ──────────────────────────────────────────────────────────────
function pageSlots(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const slots = [1];
  if (page > 3) slots.push('…');
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) slots.push(i);
  if (page < totalPages - 2) slots.push('…');
  slots.push(totalPages);
  return slots;
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 py-6" aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        Previous
      </Button>
      {pageSlots(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-ink-soft/60" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-sm font-medium transition-colors ${
              p === page
                ? 'bg-accent text-white'
                : 'border border-line bg-surface text-ink-soft hover:bg-canvas hover:text-ink'
            }`}
          >
            {p}
          </button>
        )
      )}
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
        Next
      </Button>
    </nav>
  );
}

// ─── Stars (rating display) ──────────────────────────────────────────────────
export function Stars({ rating, count }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${rating} out of 5`}>
      <span className="text-gold" aria-hidden="true">
        {'★'.repeat(Math.round(rating))}
        {'☆'.repeat(5 - Math.round(rating))}
      </span>
      <span className="text-ink-soft">
        {Number(rating).toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </span>
  );
}

// ─── New primitives (docs/ui-prd.md §3.5) ────────────────────────────────────

export function Eyebrow({ children, className = '' }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/** Price block — display font, current + struck original + discount chip. */
export function Price({ current, original, discountPercent, size = 'md', className = '' }) {
  const sizes = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' };
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className={`font-display font-semibold text-ink ${sizes[size]}`}>{current}</span>
      {original && discountPercent > 0 && (
        <>
          <span className="text-sm text-ink-soft/70 line-through">{original}</span>
          <span className="rounded-full bg-sale px-2 py-0.5 text-[11px] font-semibold text-white">−{discountPercent}%</span>
        </>
      )}
    </span>
  );
}

/** 4:5 media frame with lazy Cloudinary-optimized image and hover zoom. */
export function ProductMedia({ src, alt, ratio = 'aspect-[4/5]', eager = false, className = '', imgClassName = '' }) {
  return (
    <div className={`${ratio} overflow-hidden rounded-card bg-line/40 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          className={`h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] ${imgClassName}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-8 w-8 text-ink-soft/40" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/** Pill for filters / variants / removable tags. */
export function Chip({ selected = false, disabled = false, onClick, children, className = '' }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-pressed={onClick ? selected : undefined}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        selected
          ? 'border-accent/30 bg-accent-soft text-accent'
          : 'border-line bg-surface text-ink-soft hover:border-ink-soft/40 hover:text-ink'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
    >
      {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </Tag>
  );
}

/** −/value/+ stepper replacing raw number inputs. */
export function QtyStepper({ value, min = 1, max, onChange, disabled = false, label = 'Quantity' }) {
  const clamp = (v) => Math.max(min, Math.min(max ?? Infinity, v));
  return (
    <div className="inline-flex items-center rounded-input border border-line bg-surface" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        className="flex h-11 w-11 items-center justify-center text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-10 text-center text-sm font-medium tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || (max !== undefined && value >= max)}
        className="flex h-11 w-11 items-center justify-center text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Section header — eyebrow + display title + optional action link. */
export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Numbered progress stepper (checkout). */
export function Stepper({ steps, current }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                state === 'done'
                  ? 'border-accent bg-accent text-white'
                  : state === 'current'
                    ? 'border-accent text-accent'
                    : 'border-line text-ink-soft/60'
              }`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {state === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`text-sm ${state === 'todo' ? 'text-ink-soft/60' : 'text-ink'}`}>{label}</span>
            {i < steps.length - 1 && <span className={`h-px w-8 sm:w-12 ${state === 'done' ? 'bg-accent' : 'bg-line'}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
