import React, { useState } from 'react';
import { Plus, X, Languages as LanguagesIcon } from 'lucide-react';
import type { LanguageRequirement } from '../../types';

export const LanguagesField: React.FC<{ values: LanguageRequirement[]; onChange: (values: LanguageRequirement[]) => void }> = ({ values, onChange }) => {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<LanguageRequirement['minimum_level']>('intermediate');
  const [mandatory, setMandatory] = useState(false);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange([...values.filter(item => item.name !== trimmed), { name: trimmed, minimum_level: level, mandatory }]);
    setName('');
    setMandatory(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
          LANGUAGES REQUISES (`required_languages`)
        </label>
        <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">LINGUISTIC TELEMETRY</span>
      </div>

      <p className="text-xs text-[var(--muted-foreground)] font-sans">
        Specify required languages and minimum proficiency thresholds.
      </p>

      {values.length > 0 && (
        <div className="space-y-2">
          {values.map((language, index) => {
            const formattedIdx = String(index + 1).padStart(2, '0');
            return (
              <div
                key={`${language.name}-${index}`}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold text-[var(--primary)]">{formattedIdx}</span>
                  <span className="font-mono font-bold text-[var(--foreground)] uppercase tracking-wider">{language.name}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--primary-subtle)] text-[var(--primary)] font-mono text-[10px] uppercase font-bold border border-[var(--primary)]/30">
                    {language.minimum_level}
                  </span>
                  {language.mandatory && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 font-mono text-[10px] uppercase font-bold border border-rose-500/20">
                      MANDATORY
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={`Retirer ${language.name}`}
                  className="text-[var(--muted-foreground)] hover:text-rose-400 transition-colors cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
        <div className="sm:col-span-4">
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Ex. French"
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-all"
          />
        </div>
        <div className="sm:col-span-4">
          <select
            value={level}
            onChange={event => setLevel(event.target.value as LanguageRequirement['minimum_level'])}
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-all cursor-pointer"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="fluent">Fluent</option>
            <option value="native">Native</option>
          </select>
        </div>
        <div className="sm:col-span-2 flex items-center px-2">
          <label className="flex items-center gap-2 text-xs font-mono text-[var(--foreground)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={event => setMandatory(event.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--primary)] focus:ring-0 cursor-pointer"
            />
            <span>Required</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={add}
            disabled={!name.trim()}
            className="w-full h-full min-h-[41px] px-4 rounded-xl bg-[var(--primary)] hover:opacity-90 disabled:opacity-40 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ADD</span>
          </button>
        </div>
      </div>
    </div>
  );
};

