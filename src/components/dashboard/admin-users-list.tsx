import React from 'react';
import { UserProfile, UserRole, SubscriptionTier } from '../../types';
import { RoleBadge } from '../ui/role-badge';
import { Edit2, Trash2, ShieldCheck, UserX, UserCheck } from 'lucide-react';

interface AdminUsersListProps {
  users: UserProfile[];
  loading: boolean;
  onToggleStatus: (uid: string, currentStatus: boolean) => void;
  onChangeSubscription: (uid: string, currentTier: SubscriptionTier) => void;
  onOpenEdit: (user: UserProfile) => void;
  onDeleteUser: (uid: string) => void;
}

export const AdminUsersList: React.FC<AdminUsersListProps> = ({
  users,
  loading,
  onToggleStatus,
  onChangeSubscription,
  onOpenEdit,
  onDeleteUser,
}) => {
  if (loading) {
    return (
      <div className="py-24 text-center text-[var(--muted-foreground)] font-mono text-xs flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#0047FF] animate-ping" />
        <span>CHARGEMENT DU DIRECTOIRE DES UTILISATEURS...</span>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="p-16 text-center text-[var(--muted-foreground)] font-mono text-xs space-y-2 border border-[var(--border)] rounded-3xl bg-[var(--surface-secondary)]">
        <p className="font-bold text-[var(--foreground)] uppercase tracking-wider">// AUCUN UTILISATEUR TROUVÉ</p>
        <p className="text-[var(--muted-foreground)]">Modifiez vos critères de recherche ou réinitialisez les filtres.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest bg-white/[0.02]">
              <th className="py-4 px-6 font-bold">INDEX</th>
              <th className="py-4 px-6 font-bold">UTILISATEUR</th>
              <th className="py-4 px-6 font-bold">RÔLE</th>
              <th className="py-4 px-6 font-bold">STATUT</th>
              <th className="py-4 px-6 font-bold">ABONNEMENT</th>
              <th className="py-4 px-6 font-bold">INSCRIPTION</th>
              <th className="py-4 px-6 font-bold text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs font-mono">
            {users.map((user, idx) => {
              const formattedIndex = `[${String(idx + 1).padStart(3, '0')}]`;
              return (
                <tr key={`user-row-${user.uid || 'idx'}-${idx}`} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-4 px-6 font-mono text-[var(--muted-foreground)] font-bold text-[11px]">
                    {formattedIndex}
                  </td>

                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                        alt=""
                        className="w-9 h-9 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface-secondary)] shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="font-bold font-display text-[var(--foreground)] text-sm">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-6">
                    <RoleBadge role={user.role} />
                  </td>

                  <td className="py-4 px-6">
                    <button
                      onClick={() => onToggleStatus(user.uid, user.isActive)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                        user.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span>{user.isActive ? 'ACTIF' : 'SUSPENDU'}</span>
                    </button>
                  </td>

                  <td className="py-4 px-6">
                    <button
                      onClick={() => onChangeSubscription(user.uid, user.subscription)}
                      className="cursor-pointer transition-transform hover:scale-105"
                      title="Cliquer pour basculer Free / Premium"
                    >
                      <RoleBadge subscription={user.subscription} />
                    </button>
                  </td>

                  <td className="py-4 px-6 text-[var(--muted-foreground)] text-[11px]">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>

                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onOpenEdit(user)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                        title="Modifier l'utilisateur"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteUser(user.uid)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title="Supprimer l'utilisateur"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile / Tablet Stacked Records View */}
      <div className="block lg:hidden space-y-4">
        {users.map((user, idx) => {
          const formattedIndex = `[${String(idx + 1).padStart(3, '0')}]`;
          return (
            <div
              key={`user-card-${user.uid || 'idx'}-${idx}`}
              className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <span className="font-mono text-xs font-bold text-[#0047FF]">{formattedIndex}</span>
                <div className="flex items-center gap-2">
                  <RoleBadge role={user.role} />
                  <button
                    onClick={() => onToggleStatus(user.uid, user.isActive)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      user.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    <span>{user.isActive ? 'ACTIF' : 'SUSPENDU'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <img
                  src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                  alt=""
                  className="w-12 h-12 rounded-2xl object-cover border border-[var(--border)] bg-[var(--surface-secondary)] shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <p className="font-bold font-display text-[var(--foreground)] text-base truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs font-mono text-[var(--muted-foreground)] truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)]">PLAN:</span>
                  <button
                    onClick={() => onChangeSubscription(user.uid, user.subscription)}
                    className="cursor-pointer"
                  >
                    <RoleBadge subscription={user.subscription} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenEdit(user)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 text-[var(--foreground)] font-bold hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    ÉDITER
                  </button>
                  <button
                    onClick={() => onDeleteUser(user.uid)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 font-bold hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    SUPPRIMER
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
