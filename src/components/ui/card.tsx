import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  index?: string | number;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className = '',
  index,
  hoverable = false,
  children,
  ...props
}) => (
  <section
    className={`editorial-panel rounded-xl overflow-hidden relative ${
      hoverable ? 'editorial-panel-hover' : ''
    } ${className}`}
    {...props}
  >
    {index !== undefined && (
      <span className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] select-none pointer-events-none">
        [{typeof index === 'number' && index < 10 ? `0${index}` : index}]
      </span>
    )}
    {children}
  </section>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => (
  <div
    className={`border-b border-[var(--border)] px-6 py-4.5 flex items-center justify-between ${className}`}
    {...props}
  />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => <div className={`p-6 ${className}`} {...props} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => (
  <div
    className={`border-t border-[var(--border)] px-6 py-4 bg-[var(--surface-secondary)] flex items-center justify-between ${className}`}
    {...props}
  />
);
