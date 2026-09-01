import React from 'react';

interface MatchCriterionProps {
  label: string;
  status: string;
  display: string;
  detail?: string;
  score?: number;
}

export const MatchCriterion: React.FC<MatchCriterionProps> = ({
  label,
  status,
  display,
  detail,
  score,
}) => {
  const isPositive = status.toLowerCase().includes('satisfait') || 
                    status.toLowerCase().includes('meets') || 
                    status.toLowerCase().includes('compatible') || 
                    status.toLowerCase().includes('valide');
  const isNegative = status.toLowerCase().includes('non') || 
                    status.toLowerCase().includes('manque') || 
                    status.toLowerCase().includes('insuffisant') ||
                    status.toLowerCase().includes('unmet');

  return (
    <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[var(--border)] transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] font-bold">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {score !== undefined && (
            <span className="text-xs font-mono font-bold text-[var(--foreground)]">
              {score}%
            </span>
          )}
          <span
            className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : isNegative
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-white/5 text-[var(--foreground-secondary)] border border-[var(--border)]'
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {score !== undefined && (
        <div className="w-full h-1 bg-[var(--surface-elevated)] rounded-full overflow-hidden my-2 border border-[var(--border)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isPositive ? 'bg-emerald-500' : isNegative ? 'bg-rose-500' : 'bg-[#0047FF]'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      )}

      {detail && (
        <p className="mt-1 text-xs font-medium text-[var(--foreground)] font-sans">
          {detail}
        </p>
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)] font-sans">
        {display}
      </p>
    </div>
  );
};
