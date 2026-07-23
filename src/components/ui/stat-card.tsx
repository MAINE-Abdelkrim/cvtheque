import React from 'react';
import { LucideIcon } from 'lucide-react';
import { ParticleCard } from './magic-bento';
import { CountUp } from './count-up';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  isPositive?: boolean;
  colorClass?: string;
  id?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  change,
  isPositive = true,
  colorClass = 'text-indigo-500',
  id
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
    // Match structure like: Optional prefix, a float/int, optional suffix
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
    <ParticleCard
      id={id}
      className="magic-bento-card glass-card rounded-2xl p-6 relative overflow-hidden select-none cursor-pointer"
      enableTilt={true}
      enableMagnetism={true}
      clickEffect={true}
      particleCount={10}
      glowColor="124, 58, 237"
    >
      {/* Decorative background glow */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <span className="text-sm font-medium text-slate-400 font-sans">{title}</span>
        <div className={`p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline justify-between relative z-10">
        <span className="text-3xl font-bold font-display text-white tracking-tight">
          {isNumeric ? (
            <>
              {prefix}
              <CountUp to={numValue} duration={1.5} />
              {suffix}
            </>
          ) : (
            value
          )}
        </span>
        {change && (
          <span className={`text-xs font-mono font-medium px-2 py-1 rounded-md ${
            isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {change}
          </span>
        )}
      </div>
    </ParticleCard>
  );
};

