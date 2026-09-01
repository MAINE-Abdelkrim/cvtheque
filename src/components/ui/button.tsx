import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] active:scale-[0.98] shadow-sm font-semibold',
  secondary:
    'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--surface-elevated)] hover:border-[var(--border-strong)] active:scale-[0.98]',
  outline:
    'border-[var(--border-strong)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-secondary)] hover:border-[var(--foreground-secondary)] active:scale-[0.98]',
  ghost:
    'border-transparent bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] active:scale-[0.98]',
  danger:
    'border-transparent bg-[var(--danger)] text-white hover:brightness-95 active:scale-[0.98]',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs tracking-tight gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-xs font-medium uppercase tracking-wider gap-2 rounded-lg',
  lg: 'h-12 px-6 text-sm font-semibold tracking-tight gap-2.5 rounded-xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', type = 'button', icon, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center font-sans transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
