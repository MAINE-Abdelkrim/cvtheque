import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { CVParserWarning } from '../../types/cv-parser';

export const CVWarningList: React.FC<{ warnings: CVParserWarning[] }> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2" role="status" aria-label="Avertissements concernant le CV">
      {warnings.map((warning, index) => (
        <div key={`${warning.code}-${index}`} className="flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--warning)_7%,transparent)] p-3 text-sm text-[var(--foreground)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
};
