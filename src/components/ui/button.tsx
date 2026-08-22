import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]',
  secondary: 'border-transparent bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--muted)]',
  outline: 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]',
  ghost: 'border-transparent bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]',
  danger: 'border-transparent bg-[var(--danger)] text-white hover:brightness-90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-5 text-sm',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className = '', variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={`inline-flex items-center justify-center gap-2 rounded-[9px] border font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
));
Button.displayName = 'Button';
