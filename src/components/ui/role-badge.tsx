import React from 'react';
import type { SubscriptionTier, UserRole } from '../../types';
import { Badge, type BadgeTone } from './badge';

export const RoleBadge: React.FC<{ role?: UserRole; subscription?: SubscriptionTier; id?: string }> = ({ role, subscription, id }) => {
  if (role) {
    const labels: Record<UserRole, string> = { ADMIN: 'Administrateur', RECRUITER: 'Recruteur', CANDIDATE: 'Candidat' };
    const tones: Record<UserRole, BadgeTone> = { ADMIN: 'primary', RECRUITER: 'info', CANDIDATE: 'success' };
    return <Badge id={id} tone={tones[role]}>{labels[role]}</Badge>;
  }
  if (subscription) return <Badge id={id} tone={subscription === 'PREMIUM' ? 'warning' : 'neutral'}>{subscription === 'PREMIUM' ? 'Premium' : 'Gratuit'}</Badge>;
  return null;
};
