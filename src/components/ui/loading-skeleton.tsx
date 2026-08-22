import React from 'react';

interface SkeletonProps { className?: string; variant?: 'text' | 'card' | 'avatar' | 'list'; id?: string; }
const Block: React.FC<{ className: string }> = ({ className }) => <div className={`animate-pulse rounded-md bg-[var(--muted)] ${className}`} />;

export const LoadingSkeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'text', id }) => {
  if (variant === 'avatar') return <Block className={`h-12 w-12 rounded-full ${className}`} />;
  if (variant === 'card') return <div id={id} className={`ui-card space-y-5 p-5 ${className}`} aria-busy="true"><div className="flex justify-between"><Block className="h-4 w-28" /><Block className="h-9 w-9" /></div><Block className="h-8 w-20" /></div>;
  if (variant === 'list') return <div id={id} className={`space-y-3 ${className}`} aria-busy="true">{[1, 2, 3].map(i => <div key={i} className="ui-card flex items-center gap-4 p-4"><Block className="h-10 w-10" /><div className="flex-1 space-y-2"><Block className="h-4 w-1/3" /><Block className="h-3 w-1/4" /></div><Block className="h-6 w-16" /></div>)}</div>;
  return <Block className={`h-4 ${className}`} />;
};
