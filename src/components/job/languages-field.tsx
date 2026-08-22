import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LanguageRequirement } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FormField, Input, Select } from '../ui/form-controls';

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
  return <div className="space-y-3">
    <div><h3 className="text-sm font-medium text-[var(--foreground)]">Langues requises</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Ajoutez uniquement les langues utiles pour le poste.</p></div>
    {values.length > 0 && <div className="space-y-2">{values.map((language, index) => <div key={`${language.name}-${index}`} className="flex flex-col justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 sm:flex-row sm:items-center"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-[var(--foreground)]">{language.name}</span><Badge>{language.minimum_level}</Badge>{language.mandatory && <Badge tone="danger">Obligatoire</Badge>}</div><Button variant="ghost" size="sm" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Retirer ${language.name}`}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <FormField label="Langue" htmlFor="new-language"><Input id="new-language" value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Français" /></FormField>
      <FormField label="Niveau minimum" htmlFor="new-language-level"><Select id="new-language-level" value={level} onChange={event => setLevel(event.target.value as LanguageRequirement['minimum_level'])}><option value="beginner">Débutant</option><option value="intermediate">Intermédiaire</option><option value="fluent">Courant</option><option value="native">Natif</option></Select></FormField>
      <label className="flex min-h-10 items-center gap-2 text-sm text-[var(--foreground)]"><input type="checkbox" checked={mandatory} onChange={event => setMandatory(event.target.checked)} className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--primary)]" />Obligatoire</label>
      <Button variant="outline" onClick={add} disabled={!name.trim()}><Plus className="h-4 w-4" />Ajouter</Button>
    </div>
  </div>;
};
