import React from 'react';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral:
    'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground-secondary)]',
  primary:
    'border-[var(--primary-subtle)] bg-[var(--primary-subtle)] text-[var(--primary)] font-semibold',
  success:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-medium',
  warning:
    'border-amber-500/20 bg-amber-500/10 text-amber-400 font-medium',
  danger:
    'border-rose-500/20 bg-rose-500/10 text-rose-400 font-medium',
  info:
    'border-sky-500/20 bg-sky-500/10 text-sky-400 font-medium',
};

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; mono?: boolean }> = ({
  tone = 'neutral',
  mono = true,
  className = '',
  ...props
}) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] ${
      mono ? 'font-mono tracking-tight' : 'font-sans'
    } ${tones[tone]} ${className}`}
    {...props}
  />
);

export const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className }) => {
  const normalized = status.toUpperCase();
  const tone: BadgeTone = ['OPEN', 'ELIGIBLE', 'PROCESSED', 'ACTIVE', 'COMPLETED'].includes(normalized)
    ? 'success'
    : ['CLOSED', 'INELIGIBLE', 'ERROR', 'INACTIVE', 'REJECTED'].includes(normalized)
    ? 'danger'
    : normalized.includes('WARN') || normalized === 'PENDING'
    ? 'warning'
    : 'neutral';
  return (
    <Badge tone={tone} className={className}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          tone === 'success'
            ? 'bg-emerald-400'
            : tone === 'danger'
            ? 'bg-rose-400'
            : tone === 'warning'
            ? 'bg-amber-400'
            : 'bg-[var(--muted-foreground)]'
        }`}
      />
      <span>{status}</span>
    </Badge>
  );
};
