import React from 'react';
import { UserRole, SubscriptionTier } from '../../types';

interface RoleBadgeProps {
  role?: UserRole;
  subscription?: SubscriptionTier;
  id?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, subscription, id }) => {
  if (role) {
    const configs = {
      ADMIN: {
        label: 'Administrateur',
        classes: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20'
      },
      RECRUITER: {
        label: 'Recruteur',
        classes: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      },
      CANDIDATE: {
        label: 'Candidat',
        classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      }
    };

    const current = configs[role] || configs.CANDIDATE;

    return (
      <span id={id} className={`inline-flex items-center text-xs font-medium font-mono px-2.5 py-1 rounded-full border ${current.classes}`}>
        {current.label}
      </span>
    );
  }

  if (subscription) {
    const isPremium = subscription === 'PREMIUM';
    return (
      <span id={id} className={`inline-flex items-center text-xs font-bold font-sans tracking-wide px-2.5 py-0.5 rounded-md border ${
        isPremium
          ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30 shadow-sm'
          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
      }`}>
        {isPremium ? '★ PREMIUM' : 'GRATUIT'}
      </span>
    );
  }

  return null;
};
