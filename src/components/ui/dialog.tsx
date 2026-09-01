import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  category?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

const maxWidths = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  '4xl': 'max-w-6xl',
};

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  category,
  children,
  footer,
  maxWidth = 'md',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[];
        const filtered = focusable.filter((el) => !el.hasAttribute('disabled'));
        if (!filtered.length) {
          event.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = filtered[0];
        const last = filtered[filtered.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`max-h-[92vh] w-full ${maxWidths[maxWidth]} flex flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-overlay)] animate-in zoom-in-95 duration-200`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5 bg-[var(--surface-secondary)]">
          <div>
            {category && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--primary)] block mb-1">
                // {category}
              </span>
            )}
            <h2 id={titleId} className="text-lg sm:text-xl font-display font-bold tracking-tight text-[var(--foreground)]">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 h-8 w-8 rounded-lg hover:bg-[var(--surface-elevated)]"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <footer className="border-t border-[var(--border)] px-6 py-4 bg-[var(--surface-secondary)] flex items-center justify-end gap-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
