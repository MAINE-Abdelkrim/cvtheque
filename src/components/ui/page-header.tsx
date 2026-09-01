import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  category?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  category,
  actions,
  className = '',
}) => (
  <header className={`flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between pb-6 border-b border-[var(--border)] ${className}`}>
    <div className="space-y-1.5">
      {category && (
        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--primary)] block">
          // {category}
        </span>
      )}
      <h1 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight text-[var(--foreground)] leading-none">
        {title}
      </h1>
      {description && (
        <p className="max-w-2xl text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed pt-1">
          {description}
        </p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
  </header>
);

export const SectionHeader: React.FC<{
  title: string;
  description?: string;
  tag?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, description, tag, actions, className = '' }) => (
  <div className={`flex items-end justify-between gap-4 pb-3 border-b border-[var(--border-subtle)] ${className}`}>
    <div>
      {tag && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block mb-0.5">
          {tag}
        </span>
      )}
      <h2 className="text-base sm:text-lg font-display font-bold text-[var(--foreground)] tracking-tight">
        {title}
      </h2>
      {description && (
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
      )}
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </div>
);
