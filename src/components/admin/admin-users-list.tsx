import React from 'react';
import { Edit2, Power, Trash2 } from 'lucide-react';
import type { UserProfile, UserRole } from '../../types';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { RoleBadge } from '../ui/role-badge';
import { Badge } from '../ui/badge';
import { Users } from 'lucide-react';

interface AdminUsersListProps {
  users: UserProfile[];
  loading: boolean;
  onEdit: (user: UserProfile) => void;
  onToggleStatus: (user: UserProfile) => void;
  onDelete: (user: UserProfile) => void;
}

export const AdminUsersList: React.FC<AdminUsersListProps> = ({ users, loading, onEdit, onToggleStatus, onDelete }) => {
  if (loading) return <LoadingSkeleton variant="list" />;
  if (users.length === 0) return <EmptyState title="Aucun utilisateur" description="Aucun compte ne correspond aux filtres sélectionnés." icon={Users} />;
  return <div className="overflow-hidden rounded-xl border border-[var(--border)]">
    <div className="hidden grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto] gap-4 border-b border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3 text-xs font-medium text-[var(--muted-foreground)] md:grid" aria-hidden="true"><span>Utilisateur</span><span>Rôle</span><span>Abonnement</span><span>Statut</span><span>Actions</span></div>
    <div className="divide-y divide-[var(--border)]" role="list">{users.map(user => <article key={user.uid} role="listitem" className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--foreground)]" aria-hidden="true">{initials(user)}</span><div className="min-w-0"><h3 className="truncate text-sm font-medium text-[var(--foreground)]">{user.firstName} {user.lastName}</h3><p className="truncate text-xs text-[var(--muted-foreground)]">{user.email}</p></div></div>
      <LabeledValue label="Rôle"><RoleBadge role={user.role} /></LabeledValue>
      <LabeledValue label="Abonnement"><RoleBadge subscription={user.subscription} /></LabeledValue>
      <LabeledValue label="Statut"><Badge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Actif' : 'Inactif'}</Badge></LabeledValue>
      <div className="flex flex-wrap gap-1 md:justify-end"><Button variant="ghost" size="sm" onClick={() => onEdit(user)} aria-label={`Modifier ${user.firstName} ${user.lastName}`}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => onToggleStatus(user)} aria-label={user.isActive ? `Désactiver ${user.firstName} ${user.lastName}` : `Activer ${user.firstName} ${user.lastName}`}><Power className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => onDelete(user)} aria-label={`Supprimer ${user.firstName} ${user.lastName}`}><Trash2 className="h-4 w-4" /></Button></div>
    </article>)}</div>
  </div>;
};

const LabeledValue: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <div><span className="mb-1 block text-xs text-[var(--muted-foreground)] md:hidden">{label}</span>{children}</div>;
const initials = (user: UserProfile) => `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

export const roleOptions: Array<{ value: UserRole | 'ALL'; label: string }> = [{ value: 'ALL', label: 'Tous les rôles' }, { value: 'CANDIDATE', label: 'Candidats' }, { value: 'RECRUITER', label: 'Recruteurs' }, { value: 'ADMIN', label: 'Administrateurs' }];
