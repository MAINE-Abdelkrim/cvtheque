import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FormField, Input } from '../ui/form-controls';

interface StringListFieldProps {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  helperText?: string;
}

export const StringListField: React.FC<StringListFieldProps> = ({ id, label, values, onChange, placeholder, helperText }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const value = draft.trim();
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setDraft('');
  };
  return <FormField label={label} htmlFor={id} helperText={helperText}>
    <div className="space-y-2">
      {values.length > 0 && <div className="flex flex-wrap gap-2">{values.map(value => <Badge key={value} className="gap-1.5">{value}<button type="button" onClick={() => onChange(values.filter(item => item !== value))} aria-label={`Retirer ${value}`} className="rounded-sm text-[var(--muted-foreground)] hover:text-[var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"><X className="h-3 w-3" /></button></Badge>)}</div>}
      <div className="flex flex-col gap-2 sm:flex-row"><Input id={id} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder={placeholder} /><Button variant="outline" onClick={add} disabled={!draft.trim()}><Plus className="h-4 w-4" />Ajouter</Button></div>
    </div>
  </FormField>;
};
