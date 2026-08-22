import React from 'react';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
const tones: Record<BadgeTone, string> = {
  neutral: 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]',
  primary: 'border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_9%,transparent)] text-[var(--primary)]',
  success: 'border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_9%,transparent)] text-[var(--success)]',
  warning: 'border-[color-mix(in_srgb,var(--warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--warning)_9%,transparent)] text-[var(--warning)]',
  danger: 'border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_9%,transparent)] text-[var(--danger)]',
  info: 'border-[color-mix(in_srgb,var(--info)_25%,transparent)] bg-[color-mix(in_srgb,var(--info)_9%,transparent)] text-[var(--info)]',
};

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }> = ({ tone = 'neutral', className = '', ...props }) => <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`} {...props} />;

export const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className }) => {
  const normalized = status.toUpperCase();
  const tone: BadgeTone = ['OPEN', 'ELIGIBLE', 'PROCESSED', 'ACTIVE'].includes(normalized) ? 'success' : ['CLOSED', 'INELIGIBLE', 'ERROR', 'INACTIVE'].includes(normalized) ? 'danger' : normalized.includes('WARN') ? 'warning' : 'neutral';
  return <Badge tone={tone} className={className}>{status}</Badge>;
};
