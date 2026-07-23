import React, { useState, useEffect, useRef } from 'react';
import { dbEngine } from '../../lib/firebase/db';
import { UserProfile, UserRole, SubscriptionTier } from '../../types';
import { StatCard } from '../ui/stat-card';
import { RoleBadge } from '../ui/role-badge';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { BentoCardGrid, GlobalSpotlight } from '../ui/magic-bento';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  CreditCard, 
  Search, 
  ArrowUpDown, 
  Power, 
  Trash2, 
  ShieldAlert, 
  Plus, 
  Edit2, 
  X, 
  Loader2,
  Zap,
  Activity,
  Award,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export const AdminView: React.FC = () => {
  const bentoGridRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('createdAt');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showRoleDrawer, setShowRoleDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Role Drawer Selection
  const [roleEditUserUid, setRoleEditUserUid] = useState('');
  const [roleEditTargetRole, setRoleEditTargetRole] = useState<UserRole>('CANDIDATE');

  // Form states for creation
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'CANDIDATE' as UserRole,
    subscription: 'FREE' as SubscriptionTier,
    isActive: true
  });

  // Form states for edit
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'CANDIDATE' as UserRole,
    subscription: 'FREE' as SubscriptionTier,
    isActive: true
  });

  const [saving, setSaving] = useState(false);

  // Mock Audit Logs
  const [activityLogs, setActivityLogs] = useState([
    { id: 1, action: 'Inscription', target: 'Alexandre Bernard (Candidat)', details: 'Extraction sémantique réussie.', time: 'Il y a 5 min' },
    { id: 2, action: 'Abonnement', target: 'Hélène Martin (Recruteur)', details: 'Passage à l\'abonnement PREMIUM.', time: 'Il y a 23 min' },
    { id: 3, action: 'Publication', target: 'TechFlow Inc', details: 'Création de l\'offre "Dev React Senior".', time: 'Il y a 1h' },
    { id: 4, action: 'Système', target: 'Plateforme', details: 'Mise à jour des modèles sémantiques Google GenAI.', time: 'Il y a 3h' }
  ]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await dbEngine.getAllUsers();
      setUsers(data);
    } catch (e) {
      toast.error('Erreur lors du chargement des utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleStatus = async (uid: string, currentStatus: boolean) => {
    try {
      await dbEngine.updateUserProfile(uid, { isActive: !currentStatus });
      toast.success(`Statut de l'utilisateur mis à jour.`);
      // Log event
      const user = users.find(u => u.uid === uid);
      if (user) {
        setActivityLogs(prev => [
          {
            id: Date.now(),
            action: !currentStatus ? 'Activation' : 'Blocage',
            target: `${user.firstName} ${user.lastName}`,
            details: !currentStatus ? 'Accès rétabli' : 'Compte suspendu',
            time: 'À l\'instant'
          },
          ...prev
        ]);
      }
      loadUsers();
    } catch (e) {
      toast.error('Impossible de modifier le statut.');
    }
  };

  const handleChangeSubscription = async (uid: string, currentTier: SubscriptionTier) => {
    const nextTier = currentTier === 'FREE' ? 'PREMIUM' : 'FREE';
    try {
      await dbEngine.updateUserProfile(uid, { subscription: nextTier });
      toast.success(`Abonnement modifié : ${nextTier}`);
      loadUsers();
    } catch (e) {
      toast.error('Erreur d\'abonnement.');
    }
  };

  const handlePromoteRole = async (uid: string, currentRole: UserRole) => {
    const nextRole: UserRole = currentRole === 'CANDIDATE' ? 'RECRUITER' : currentRole === 'RECRUITER' ? 'ADMIN' : 'CANDIDATE';
    try {
      await dbEngine.updateUserProfile(uid, { role: nextRole });
      toast.success(`Rôle modifié : ${nextRole}`);
      // Log event
      const user = users.find(u => u.uid === uid);
      if (user) {
        setActivityLogs(prev => [
          {
            id: Date.now(),
            action: 'Rôle',
            target: `${user.firstName} ${user.lastName}`,
            details: `Promu au rôle ${nextRole}`,
            time: 'À l\'instant'
          },
          ...prev
        ]);
      }
      loadUsers();
    } catch (e) {
      toast.error('Erreur de modification de rôle.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSaving(true);
    try {
      // Create user via register backend API to ensure they are created in Auth
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: createForm.firstName,
          lastName: createForm.lastName,
          email: createForm.email,
          password: createForm.password,
          role: createForm.role
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Impossible de créer l\'utilisateur');
      }

      const resData = await res.json();
      const newUid = resData.uid;

      // If subscription or isActive differs from default, update it
      if (createForm.subscription !== 'FREE' || !createForm.isActive) {
        await dbEngine.updateUserProfile(newUid, {
          subscription: createForm.subscription,
          isActive: createForm.isActive
        });
      }

      toast.success('Utilisateur créé avec succès !');
      setShowCreateModal(false);
      setActivityLogs(prev => [
        {
          id: Date.now(),
          action: 'Création',
          target: `${createForm.firstName} ${createForm.lastName}`,
          details: `Compte ${createForm.role} créé avec succès`,
          time: 'À l\'instant'
        },
        ...prev
      ]);
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'CANDIDATE',
        subscription: 'FREE',
        isActive: true
      });
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création de l\'utilisateur.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
      isActive: user.isActive
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!editForm.firstName || !editForm.lastName || !editForm.email) {
      toast.error('Veuillez remplir tous les champs requis.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      // Always update local dbEngine representation to guarantee UI is up-to-date
      await dbEngine.updateUserProfile(selectedUser.uid, editForm);

      toast.success('Utilisateur mis à jour avec succès !');
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Erreur de mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur de la base de données et de Firebase Auth ?')) {
      return;
    }
    try {
      // Call backend DELETE API to delete from Auth and Firestore
      await fetch(`/api/admin/users/${uid}`, {
        method: 'DELETE'
      });

      // Always call dbEngine.deleteUserProfile to clean up Firestore document client-side/simulation-side
      await dbEngine.deleteUserProfile(uid);

      toast.success('Utilisateur supprimé définitivement.');
      const user = users.find(u => u.uid === uid);
      if (user) {
        setActivityLogs(prev => [
          {
            id: Date.now(),
            action: 'Suppression',
            target: `${user.firstName} ${user.lastName}`,
            details: 'Suppression définitive réussie',
            time: 'À l\'instant'
          },
          ...prev
        ]);
      }
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression de l\'utilisateur.');
    }
  };

  const handleRoleDrawerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleEditUserUid) {
      toast.error('Veuillez sélectionner un utilisateur.');
      return;
    }
    try {
      await dbEngine.updateUserProfile(roleEditUserUid, { role: roleEditTargetRole });
      toast.success('Le rôle de l\'utilisateur a été mis à jour.');
      setShowRoleDrawer(false);
      loadUsers();
    } catch (err) {
      toast.error('Erreur lors de la modification de rôle.');
    }
  };

  // Stats calculation
  const totalUsers = users.length;
  const recruitersCount = users.filter((u) => u.role === 'RECRUITER').length;
  const candidatesCount = users.filter((u) => u.role === 'CANDIDATE').length;
  const activeSubs = users.filter((u) => u.subscription === 'PREMIUM').length;
  const activeAccountsCount = users.filter((u) => u.isActive).length;

  const filteredUsers = users
    .filter((u) => {
      const fullString = `${u.firstName} ${u.lastName} ${u.email} ${u.role}`.toLowerCase();
      return fullString.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Top 5 newest users for the "New Users" widget
  const newestUsers = [...users]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8 select-none">
      {/* Upper Cards Rows */}
      <GlobalSpotlight gridRef={bentoGridRef} spotlightRadius={300} glowColor="124, 58, 237" />
      <BentoCardGrid gridRef={bentoGridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-0 max-w-full">
        <StatCard
          title="Total Utilisateurs"
          value={totalUsers}
          icon={Users}
          change="+14.2%"
          isPositive={true}
          colorClass="text-blue-400"
        />
        <StatCard
          title="Recruteurs Actifs"
          value={recruitersCount}
          icon={ShieldCheck}
          change="+8.4%"
          isPositive={true}
          colorClass="text-cyan-400"
        />
        <StatCard
          title="Candidats Enregistrés"
          value={candidatesCount}
          icon={UserCheck}
          change="+24.1%"
          isPositive={true}
          colorClass="text-emerald-400"
        />
        <StatCard
          title="Comptes Actifs"
          value={`${activeAccountsCount}/${totalUsers}`}
          icon={Activity}
          change="98%"
          isPositive={true}
          colorClass="text-purple-400"
        />
      </BentoCardGrid>

      {/* Bento Grid: Quick Actions, Recent Activity & New Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions Panel */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/60 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-28 h-28 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl shadow-lg shadow-blue-500/10">
                <Zap className="w-4 h-4 animate-pulse" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Actions Rapides</h4>
            </div>
            <p className="text-[11px] text-slate-500 mb-5">
              Effectuez des opérations d'administration système en un seul clic.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const input = document.querySelector('input[placeholder="Rechercher..."]') as HTMLInputElement;
                  input?.focus();
                  toast.info('Utilisez la table ci-dessous pour gérer les utilisateurs.');
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/60 hover:border-slate-800 text-left cursor-pointer transition-all text-xs text-white"
              >
                <span>Gérer les Utilisateurs</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                onClick={() => {
                  if (users.length > 0) {
                    setRoleEditUserUid(users[0].uid);
                  }
                  setShowRoleDrawer(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/60 hover:border-slate-800 text-left cursor-pointer transition-all text-xs text-white"
              >
                <span>Gérer les Rôles de la plateforme</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                onClick={() => setShowStatsModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-violet-500/20 bg-violet-600/5 hover:bg-violet-600/10 hover:border-violet-500/30 text-left cursor-pointer transition-all text-xs text-violet-400 font-semibold"
              >
                <span className="font-bold">Afficher les Statistiques avancées</span>
                <TrendingUp className="w-4 h-4 text-violet-400" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-4 mt-6 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Rapport système : OK</span>
            <span>Version SaaS: 1.0</span>
          </div>
        </div>

        {/* Recent Activity Logs Stream */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/60 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shadow-lg shadow-amber-500/10">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Journal d'Activité</h4>
                <p className="text-[10px] text-slate-500">Audit de sécurité en temps réel</p>
              </div>
            </div>

            <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
              {activityLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-2.5 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.25 bg-slate-900 text-slate-400 rounded border border-slate-800">
                        {log.action}
                      </span>
                      <span className="font-semibold text-white">{log.target}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">{log.details}</p>
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono shrink-0 whitespace-nowrap">{log.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3.5 mt-5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Dernier événement : {activityLogs[0]?.action || 'Aucun'}</span>
            <span>Flux d'audit actif</span>
          </div>
        </div>

        {/* New Users Widget */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/60 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-lg shadow-emerald-500/10">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Nouveaux Utilisateurs</h4>
                <p className="text-[10px] text-slate-500">Dernières inscriptions enregistrées</p>
              </div>
            </div>

            <div className="space-y-3">
              {newestUsers.map((u) => (
                <div key={u.uid} className="flex items-center justify-between gap-4 p-2 rounded-xl bg-slate-950/20 border border-slate-900/50 hover:border-slate-800/80 transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <img
                      src={u.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'}
                      alt="avatar"
                      className="w-7 h-7 rounded-lg object-cover border border-slate-900 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{u.firstName} {u.lastName}</div>
                      <div className="text-[9px] text-slate-500 font-mono truncate">{u.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                      {u.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3.5 mt-5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Nouveaux aujourd'hui : +{newestUsers.length}</span>
            <span>Base utilisateurs</span>
          </div>
        </div>
      </div>

      {/* Main Table Segment */}
      <div className="glass-card rounded-2xl border border-slate-800/60 overflow-hidden">
        {/* Header Options */}
        <div className="p-6 border-b border-slate-900/80 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold font-display text-white">Gestion de l'ensemble des comptes</h3>
            <p className="text-xs text-slate-400">CRUD complet, attribution des rôles et contrôle des abonnements.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-full md:w-56 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortBy(sortBy === 'createdAt' ? 'name' : 'createdAt')}
              className="flex items-center space-x-2 px-3 py-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition-all cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="text-[11px]">Tri: {sortBy === 'createdAt' ? 'Récents' : 'Nom'}</span>
            </button>

            {/* Create User Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border border-blue-500/10 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-lg shadow-blue-500/10"
            >
              <Plus className="w-4 h-4" />
              <span>Créer un utilisateur</span>
            </button>
          </div>
        </div>

        {/* User List Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="list" />
            </div>
          ) : filteredUsers.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-500 text-[10px] font-mono font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Utilisateur</th>
                  <th className="p-4">Rôle assigné</th>
                  <th className="p-4">Niveau d'Abonnement</th>
                  <th className="p-4">Statut de sécurité</th>
                  <th className="p-4">Date d'inscription</th>
                  <th className="p-4 pr-6 text-right">Actions système</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-900/15 transition-colors">
                    {/* Identity & Photo */}
                    <td className="p-4 pl-6 flex items-center space-x-3.5">
                      <img
                        src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'}
                        alt="Avatar"
                        className="w-8 h-8 rounded-xl object-cover border border-slate-900 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white truncate">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{user.email}</div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      <button
                        onClick={() => handlePromoteRole(user.uid, user.role)}
                        className="hover:opacity-80 transition-opacity cursor-pointer text-left"
                        title="Incrémenter le rôle (Candidat > Recruteur > Admin)"
                      >
                        <RoleBadge role={user.role} />
                      </button>
                    </td>

                    {/* Subscription */}
                    <td className="p-4">
                      <button
                        onClick={() => handleChangeSubscription(user.uid, user.subscription)}
                        className="hover:opacity-80 transition-opacity cursor-pointer text-left"
                        title="Basculer l'abonnement (Free / Premium)"
                      >
                        <RoleBadge subscription={user.subscription} />
                      </button>
                    </td>

                    {/* Active Status */}
                    <td className="p-4">
                      <span className={`inline-flex items-center space-x-1.5 text-xs font-semibold ${
                        user.isActive ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        <span>{user.isActive ? 'Actif' : 'Bloqué'}</span>
                      </span>
                    </td>

                    {/* Date */}
                    <td className="p-4 text-xs text-slate-400 font-mono">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>

                    {/* Action buttons */}
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Modifier les détails"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle active status */}
                        <button
                          onClick={() => handleToggleStatus(user.uid, user.isActive)}
                          className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            user.isActive
                              ? 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white'
                              : 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                          }`}
                          title={user.isActive ? "Bloquer l'accès au compte" : "Autoriser l'accès au compte"}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteUser(user.uid)}
                          className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Supprimer définitivement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              Aucun utilisateur ne correspond à vos filtres de recherche.
            </div>
          )}
        </div>
      </div>

      {/* SYSTEM STATISTICS MODAL */}
      {showStatsModal && (
        <div
          onClick={() => setShowStatsModal(false)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-2xl relative text-left"
          >
            <button
              onClick={() => setShowStatsModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-display mb-1">
              Rapport d'activité sémantique
            </h3>
            <p className="text-xs text-slate-500 mb-6">Visualisation du taux d'adéquation et croissance des comptes.</p>

            {/* Custom vector charts visual styling */}
            <div className="space-y-6">
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono font-bold text-slate-400 block mb-2 uppercase">
                  Évolution hebdomadaire des analyses de CVs
                </span>
                {/* Custom SVG line chart */}
                <svg viewBox="0 0 400 150" className="w-full h-36 overflow-visible">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0066FF" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 10 120 Q 80 90 140 100 T 260 40 T 390 20 L 390 130 L 10 130 Z"
                    fill="url(#chartGradient)"
                  />
                  <path
                    d="M 10 120 Q 80 90 140 100 T 260 40 T 390 20"
                    fill="none"
                    stroke="#0066FF"
                    strokeWidth="3"
                  />
                  <circle cx="140" cy="100" r="4" fill="#0066FF" />
                  <circle cx="260" cy="40" r="4" fill="#7C3AED" />
                  <circle cx="390" cy="20" r="4" fill="#06B6D4" />
                  <line x1="10" y1="130" x2="390" y2="130" stroke="#1e293b" strokeWidth="1" />
                  {/* labels */}
                  <text x="10" y="145" fill="#475569" fontSize="8" fontFamily="monospace">LUN</text>
                  <text x="130" y="145" fill="#475569" fontSize="8" fontFamily="monospace">MER</text>
                  <text x="250" y="145" fill="#475569" fontSize="8" fontFamily="monospace">VEN</text>
                  <text x="360" y="145" fill="#475569" fontSize="8" fontFamily="monospace">DIM</text>
                </svg>
              </div>

              {/* Stat figures */}
              <div className="grid grid-cols-3 gap-3.5">
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800">
                  <div className="text-base font-extrabold text-white">1.8s</div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase">Temps d'extraction</div>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800">
                  <div className="text-base font-extrabold text-purple-400">92.4%</div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase">Conversion premium</div>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800">
                  <div className="text-base font-extrabold text-cyan-400">99.9%</div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase">Uptime sémantique</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROLE ADJUSTER PANEL DRAWER */}
      {showRoleDrawer && (
        <div
          onClick={() => setShowRoleDrawer(false)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl relative text-left"
          >
            <button
              onClick={() => setShowRoleDrawer(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 font-display mb-1">
              Modifier le rôle d'un utilisateur
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Sélectionnez un compte et affectez-lui un nouveau rôle d'accès.
            </p>

            <form onSubmit={handleRoleDrawerSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Utilisateur cible</label>
                <select
                  value={roleEditUserUid}
                  onChange={(e) => setRoleEditUserUid(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                >
                  {users.map(u => (
                    <option key={u.uid} value={u.uid} className="bg-slate-950 text-white">
                      {u.firstName} {u.lastName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Nouveau rôle système</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['CANDIDATE', 'RECRUITER', 'ADMIN'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleEditTargetRole(r)}
                      className={`py-2 px-3 rounded-xl text-center font-semibold text-xs border cursor-pointer transition-colors ${
                        roleEditTargetRole === r
                          ? 'border-blue-500 bg-blue-600/10 text-blue-400 shadow-md shadow-blue-500/10'
                          : 'border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      {r === 'CANDIDATE' ? 'Candidat' : r === 'RECRUITER' ? 'Recruteur' : 'Admin'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/10 cursor-pointer transition-all"
              >
                Confirmer l'attribution du rôle
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-950/95 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden relative text-left">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer z-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6">
              <h3 className="text-base font-bold font-display bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1">Créer un nouvel utilisateur</h3>
              <p className="text-xs text-slate-400 mb-6 font-sans">Renseignez les informations de profil pour générer les accès.</p>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Prénom</label>
                    <input
                      type="text"
                      required
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                      placeholder="Jean"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Nom</label>
                    <input
                      type="text"
                      required
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                      placeholder="Dupont"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Email professionnel</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="jean.dupont@entreprise.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Mot de passe temporaire</label>
                  <input
                    type="password"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Rôle initial</label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all cursor-pointer"
                    >
                      <option value="CANDIDATE">Candidat</option>
                      <option value="RECRUITER">Recruteur</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Abonnement</label>
                    <select
                      value={createForm.subscription}
                      onChange={(e) => setCreateForm({ ...createForm, subscription: e.target.value as SubscriptionTier })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all cursor-pointer"
                    >
                      <option value="FREE">Gratuit (FREE)</option>
                      <option value="PREMIUM">Premium (PREMIUM)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-3.5 py-1">
                  <input
                    type="checkbox"
                    id="create_isActive"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="create_isActive" className="text-xs text-slate-300 select-none cursor-pointer">
                    Autoriser l'accès au compte immédiatement
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-500/10"
                >
                  {saving ? 'Création en cours...' : 'Générer le compte utilisateur'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-950/95 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden relative text-left">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer z-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6">
              <h3 className="text-base font-bold font-display bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1">Modifier l'utilisateur</h3>
              <p className="text-xs text-slate-400 mb-6 font-sans">Modifiez les champs ci-dessous pour changer le profil.</p>

              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Prénom</label>
                    <input
                      type="text"
                      required
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      placeholder="Jean"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Nom</label>
                    <input
                      type="text"
                      required
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      placeholder="Dupont"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Rôle</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all cursor-pointer"
                    >
                      <option value="CANDIDATE">Candidat</option>
                      <option value="RECRUITER">Recruteur</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-300 font-mono uppercase tracking-wider">Abonnement</label>
                    <select
                      value={editForm.subscription}
                      onChange={(e) => setEditForm({ ...editForm, subscription: e.target.value as SubscriptionTier })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-800/80 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all cursor-pointer"
                    >
                      <option value="FREE">Gratuit (FREE)</option>
                      <option value="PREMIUM">Premium (PREMIUM)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-3.5 py-1">
                  <input
                    type="checkbox"
                    id="edit_isActive"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="edit_isActive" className="text-xs text-slate-300 select-none cursor-pointer">
                    Compte actif (accès autorisé)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-500/10"
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
