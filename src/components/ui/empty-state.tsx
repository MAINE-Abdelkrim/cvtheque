import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  actionText?: string;
  onAction?: () => void;
  id?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  actionText,
  onAction,
  id
}) => {
  return (
    <div id={id} className="flex flex-col items-center justify-center p-8 text-center glass-card rounded-2xl border border-slate-800/40 py-12">
      <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-500 mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold font-display text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-6">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-all cursor-pointer shadow-lg shadow-indigo-600/15 border border-indigo-500/30 hover:border-indigo-400/50"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
