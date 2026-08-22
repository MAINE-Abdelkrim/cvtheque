import React from 'react';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...props }, ref) => <input ref={ref} className={`ui-control px-3 py-2 text-sm ${className}`} {...props} />);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className = '', ...props }, ref) => <textarea ref={ref} className={`ui-control min-h-24 resize-y px-3 py-2 text-sm ${className}`} {...props} />);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className = '', ...props }, ref) => <select ref={ref} className={`ui-control px-3 py-2 text-sm ${className}`} {...props} />);
Select.displayName = 'Select';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, htmlFor, helperText, error, required, children, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--foreground)]">{label}{required && <span className="ml-1 text-[var(--danger)]" aria-hidden="true">*</span>}</label>
    {children}
    {error ? <p id={`${htmlFor}-error`} className="text-xs text-[var(--danger)]" role="alert">{error}</p> : helperText ? <p id={`${htmlFor}-help`} className="text-xs text-[var(--muted-foreground)]">{helperText}</p> : null}
  </div>
);
