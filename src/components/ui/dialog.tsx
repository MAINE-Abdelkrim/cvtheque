import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export const Dialog: React.FC<{ open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }> = ({ open, onClose, title, description, children, footer }) => {
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
        const focusable = (Array.from(panelRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')) as HTMLElement[]).filter(element => !element.hasAttribute('disabled'));
        if (!focusable.length) { event.preventDefault(); panelRef.current.focus(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-overlay)]"><header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4"><div><h2 id={titleId} className="text-lg font-semibold">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>}</div><Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer"><X className="h-4 w-4" /></Button></header><div className="p-5">{children}</div>{footer && <footer className="border-t border-[var(--border)] px-5 py-4">{footer}</footer>}</div></div>;
};
