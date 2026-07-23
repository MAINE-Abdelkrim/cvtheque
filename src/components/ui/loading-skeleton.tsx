import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'avatar' | 'list';
  id?: string;
}

export const LoadingSkeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'text', id }) => {
  if (variant === 'card') {
    return (
      <div id={id} className={`glass-card rounded-2xl p-6 border border-slate-800/60 animate-pulse ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-28 bg-slate-800 rounded-md" />
          <div className="h-9 w-9 bg-slate-800 rounded-xl" />
        </div>
        <div className="flex items-baseline justify-between mt-6">
          <div className="h-8 w-20 bg-slate-800 rounded-md" />
          <div className="h-5 w-12 bg-slate-800 rounded-md" />
        </div>
      </div>
    );
  }

  if (variant === 'avatar') {
    return <div id={id} className={`h-12 w-12 rounded-full bg-slate-800 animate-pulse ${className}`} />;
  }

  if (variant === 'list') {
    return (
      <div id={id} className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center space-x-4 p-4 rounded-xl border border-slate-900 bg-slate-950/40">
            <div className="h-10 w-10 rounded-lg bg-slate-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-slate-800 rounded animate-pulse" />
              <div className="h-3 w-1/4 bg-slate-800 rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-slate-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div id={id} className={`h-4 bg-slate-800 rounded-md animate-pulse ${className}`} />
  );
};
