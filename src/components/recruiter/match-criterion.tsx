import React from 'react';
import { Badge } from '../ui/badge';

export const MatchCriterion: React.FC<{ label: string; status: string; display: string; detail?: string }> = ({ label, status, display, detail }) => <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium text-[var(--foreground)]">{label}</h4><Badge>{status}</Badge></div>
  {detail && <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{detail}</p>}
  <p className="mt-2 text-sm leading-5 text-[var(--muted-foreground)]">{display}</p>
</div>;
