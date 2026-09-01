import React from 'react';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full h-11 px-3.5 bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] rounded-lg border border-[var(--border)] text-sm transition-all focus:bg-[var(--surface)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full min-h-24 p-3.5 bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] rounded-lg border border-[var(--border)] text-sm transition-all focus:bg-[var(--surface)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed resize-y ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...props }, ref) => (
    <select
      ref={ref}
      className={`w-full h-11 px-3.5 bg-[var(--surface-secondary)] text-[var(--foreground)] rounded-lg border border-[var(--border)] text-sm transition-all focus:bg-[var(--surface)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${className}`}
      {...props}
    />
  )
);
Select.displayName = 'Select';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  tag?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  helperText,
  error,
  required,
  tag,
  children,
  className = '',
}) => (
  <div className={`space-y-1.5 ${className}`}>
    <div className="flex items-center justify-between">
      <label htmlFor={htmlFor} className="block text-xs font-mono font-medium uppercase tracking-wider text-[var(--foreground-secondary)]">
        {label}
        {required && <span className="ml-1 text-[var(--primary)]" aria-hidden="true">*</span>}
      </label>
      {tag && <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{tag}</span>}
    </div>
    {children}
    {error ? (
      <p id={`${htmlFor}-error`} className="text-xs font-mono text-[var(--danger)] flex items-center gap-1" role="alert">
        <span>⚠</span> {error}
      </p>
    ) : helperText ? (
      <p id={`${htmlFor}-help`} className="text-xs font-sans text-[var(--muted-foreground)]">
        {helperText}
      </p>
    ) : null}
  </div>
);
