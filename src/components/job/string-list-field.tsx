import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface StringListFieldProps {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  helperText?: string;
  tag?: string;
}

export const StringListField: React.FC<StringListFieldProps> = ({ id, label, values, onChange, placeholder, helperText, tag }) => {
  const [draft, setDraft] = useState('');
  
  const add = () => {
    const value = draft.trim();
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setDraft('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
          {label}
        </label>
        {tag && <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">{tag}</span>}
      </div>

      {helperText && (
        <p className="text-xs text-[var(--muted-foreground)] font-sans">{helperText}</p>
      )}

      {values.length > 0 && (
        <div className="space-y-2">
          {values.map((value, idx) => {
            const formattedIdx = String(idx + 1).padStart(2, '0');
            return (
              <div
                key={value}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs group hover:border-[var(--primary)]/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold text-[var(--primary)]">{formattedIdx}</span>
                  <span className="font-mono text-[var(--foreground)] font-medium">{value}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(values.filter(item => item !== value))}
                  aria-label={`Retirer ${value}`}
                  className="text-[var(--muted-foreground)] hover:text-rose-400 transition-colors cursor-pointer p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          id={id}
          type="text"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-all"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>ADD</span>
        </button>
      </div>
    </div>
  );
};

