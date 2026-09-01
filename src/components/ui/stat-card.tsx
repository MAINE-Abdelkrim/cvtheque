import React from 'react';
import { LucideIcon } from 'lucide-react';
import { CountUp } from './count-up';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  change?: string;
  isPositive?: boolean;
  colorClass?: string;
  index?: string | number;
  id?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  change,
  isPositive = true,
  index,
  id,
  className = '',
}) => {
  // Parse dynamic numeric values, prefix, and suffix
  let numValue = 0;
  let prefix = '';
  let suffix = '';
  let isNumeric = false;

  if (typeof value === 'number') {
    numValue = value;
    isNumeric = true;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^([^0-9.-]*)([0-9.]+)([^0-9.-]*)$/);
    if (match) {
      const parsed = parseFloat(match[2]);
      if (!isNaN(parsed)) {
        prefix = match[1] || '';
        numValue = parsed;
        suffix = match[3] || '';
        isNumeric = true;
      }
    }
  }

  return (
    <div
      id={id}
      className={`editorial-panel rounded-xl p-6 relative overflow-hidden transition-all duration-200 hover:border-[var(--border-strong)] ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          {index !== undefined && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block">
              [{typeof index === 'number' && index < 10 ? `0${index}` : index}]
            </span>
          )}
          <span className="text-xs font-mono font-medium uppercase tracking-wider text-[var(--foreground-secondary)]">
            {title}
          </span>
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground-secondary)]">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <span className="text-3xl sm:text-4xl font-display font-bold text-[var(--foreground)] tracking-tight">
          {isNumeric ? (
            <>
              {prefix}
              <CountUp to={numValue} duration={1.2} />
              {suffix}
            </>
          ) : (
            value
          )}
        </span>

        {change && (
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
};
