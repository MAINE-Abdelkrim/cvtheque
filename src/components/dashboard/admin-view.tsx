import React, { useState, useEffect } from 'react';
import { dbEngine } from '../../lib/firebase/db';
import { UserProfile, UserRole, SubscriptionTier } from '../../types';
import { RoleBadge } from '../ui/role-badge';
import { AdminUsersList } from './admin-users-list';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  CreditCard, 
  Search, 
  Trash2, 
  Plus, 
  Edit2, 
  X, 
  Loader2,
  Activity,
  Server,
  Database,
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export const AdminView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CANDIDATE' | 'RECRUITER' | 'ADMIN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PREMIUM'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('createdAt');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

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

  // Audit Logs
  const [activityLogs, setActivityLogs] = useState([
    { id: 1, action: 'INSCRIPTION', target: 'Alexandre Bernard (Candidat)', details: 'Extraction sémantique réussie.', time: 'Il y a 5 min' },
    { id: 2, action: 'ABONNEMENT', target: 'Hélène Martin (Recruteur)', details: 'Passage à l\'abonnement PREMIUM.', time: 'Il y a 23 min' },
    { id: 3, action: 'PUBLICATION', target: 'TechFlow Inc', details: 'Création de l\'offre "Dev React Senior".', time: 'Il y a 1h' },
    { id: 4, action: 'SYSTÈME', target: 'Plateforme', details: 'Mise à jour des modèles sémantiques Google GenAI.', time: 'Il y a 3h' }
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
      const user = users.find(u => u.uid === uid);
      if (user) {
        setActivityLogs(prev => [
          {
            id: Date.now(),
            action: !currentStatus ? 'ACTIVATION' : 'BLOCAGE',
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSaving(true);
    try {
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
          action: 'CRÉATION',
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
      await fetch(`/api/admin/users/${selectedUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

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
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur de la base de données et de l\'authentification ?')) {
      return;
    }
    try {
      await fetch(`/api/admin/users/${uid}`, {
        method: 'DELETE'
      });
      await dbEngine.deleteUserProfile(uid);

      toast.success('Utilisateur supprimé définitivement.');
      const user = users.find(u => u.uid === uid);
      if (user) {
        setActivityLogs(prev => [
          {
            id: Date.now(),
            action: 'SUPPRESSION',
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

  // Stats calculation
  const totalUsers = users.length;
  const recruitersCount = users.filter((u) => u.role === 'RECRUITER').length;
  const candidatesCount = users.filter((u) => u.role === 'CANDIDATE').length;
  const adminsCount = users.filter((u) => u.role === 'ADMIN').length;
  const activeSubs = users.filter((u) => u.subscription === 'PREMIUM').length;
  const freeSubs = totalUsers - activeSubs;

  const filteredUsers = users
    .filter((u) => {
      const fullString = `${u.firstName} ${u.lastName} ${u.email} ${u.role}`.toLowerCase();
      const matchesSearch = fullString.includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'ACTIVE' ? u.isActive :
        statusFilter === 'SUSPENDED' ? !u.isActive :
        statusFilter === 'PREMIUM' ? u.subscription === 'PREMIUM' : true;

      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-12 pb-24 text-left select-none max-w-7xl mx-auto">
      {/* ================= SECTION 01 — ADMIN HERO & SYSTEM STATUS ================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 border-b border-[var(--border)] pb-10">
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
              // SYSTEM ADMINISTRATION
            </span>
            <span className="h-px w-12 bg-white/10" />
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
              CONSOLE CENTRALISÉE
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold font-display text-white tracking-tight uppercase leading-[1.04]">
            THE SYSTEM<br />
            <span className="text-[var(--muted-foreground)]">AT A GLANCE.</span>
          </h1>
          <p className="text-sm sm:text-base text-[var(--foreground-secondary)] font-sans leading-relaxed">
            A concise overview of users, access, subscriptions and platform activity.
          </p>
        </div>

        {/* Operational Status Telemetry Box */}
        <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4 shrink-0 min-w-[300px]">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              // SYSTEM STATUS
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              OPERATIONAL
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)] flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                AUTH
              </span>
              <span className="text-emerald-400 font-bold">●</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)] flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                DATABASE
              </span>
              <span className="text-emerald-400 font-bold">●</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)] flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-[#0047FF]" />
                AI SERVICES
              </span>
              <span className="text-[#0047FF] font-bold">●</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 02 — GLOBAL SYSTEM TELEMETRY STRIP ================= */}
      <section className="space-y-4">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)] block">
          // TELEMETRY & SIGNALS
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
            <span className="text-xs font-mono font-bold text-[#0047FF]">[01]</span>
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)] block font-bold">
              TOTAL USERS
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-extrabold font-display text-white tracking-tight">
                {totalUsers}
              </span>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                ONLINE
              </span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
            <span className="text-xs font-mono font-bold text-[#0047FF]">[02]</span>
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)] block font-bold">
              CANDIDATES
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-extrabold font-display text-white tracking-tight">
                {candidatesCount}
              </span>
              <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                {Math.round((candidatesCount / (totalUsers || 1)) * 100)}% RATIO
              </span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
            <span className="text-xs font-mono font-bold text-[#0047FF]">[03]</span>
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)] block font-bold">
              RECRUITERS
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-extrabold font-display text-white tracking-tight">
                {recruitersCount}
              </span>
              <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                {Math.round((recruitersCount / (totalUsers || 1)) * 100)}% RATIO
              </span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
            <span className="text-xs font-mono font-bold text-[#0047FF]">[04]</span>
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)] block font-bold">
              PREMIUM
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-extrabold font-display text-white tracking-tight">
                {activeSubs}
              </span>
              <span className="text-[11px] font-mono text-[#0047FF] bg-[#0047FF]/10 px-2.5 py-0.5 rounded-full border border-[#0047FF]/20 font-bold">
                SUBSCRIPTION
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 03 & 04 — USER DIRECTORY ================= */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#0047FF] block">
              // USER DIRECTORY
            </span>
            <h2 className="text-3xl font-extrabold font-display text-white tracking-tight uppercase">
              MANAGE ACCESS & SUBSCRIPTIONS.
            </h2>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE USER →</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email or role..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="CANDIDATE">Candidates</option>
                <option value="RECRUITER">Recruiters</option>
                <option value="ADMIN">Administrators</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="PREMIUM">Premium Subs</option>
              </select>
            </div>
          </div>

          <AdminUsersList
            users={filteredUsers}
            loading={loading}
            onToggleStatus={handleToggleStatus}
            onChangeSubscription={handleChangeSubscription}
            onOpenEdit={handleOpenEdit}
            onDeleteUser={handleDeleteUser}
          />
        </div>
      </section>

      {/* ================= SECTION 05 & 06 — INTELLIGENCE & AUDIT GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Role Distribution */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-[#0047FF] uppercase tracking-widest">// DISTRIBUTION</span>
            <h3 className="text-xl font-bold font-display text-[var(--foreground)] uppercase">USER ROLES</h3>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">CANDIDATES</span>
              <span className="text-[var(--foreground)] font-bold text-sm">{candidatesCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">RECRUITERS</span>
              <span className="text-[var(--foreground)] font-bold text-sm">{recruitersCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">ADMINISTRATORS</span>
              <span className="text-[var(--foreground)] font-bold text-sm">{adminsCount}</span>
            </div>
          </div>
        </div>

        {/* Subscription Intelligence */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-[#0047FF] uppercase tracking-widest">// MONETIZATION</span>
            <h3 className="text-xl font-bold font-display text-[var(--foreground)] uppercase">SUBSCRIPTION SIGNAL</h3>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-[#0047FF]/10 border border-[#0047FF]/30 flex items-center justify-between">
              <span className="text-[#0047FF] font-bold">PREMIUM USERS</span>
              <span className="text-[var(--foreground)] font-bold text-sm">{activeSubs}</span>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">FREE USERS</span>
              <span className="text-[var(--foreground)] font-bold text-sm">{freeSubs}</span>
            </div>
          </div>
        </div>

        {/* System Activity / Audit Log */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-[#0047FF] uppercase tracking-widest">// AUDIT LOG</span>
            <h3 className="text-xl font-bold font-display text-[var(--foreground)] uppercase">SYSTEM ACTIVITY</h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {activityLogs.map((log, idx) => (
              <div key={`log-${log.id || 'idx'}-${idx}`} className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#0047FF] font-bold">[{log.action}]</span>
                  <span className="text-[var(--muted-foreground)]">{log.time}</span>
                </div>
                <p className="font-bold text-[var(--foreground)] truncate">{log.target}</p>
                <p className="text-[11px] text-[var(--foreground-secondary)] font-sans">{log.details}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= MODAL: CREATE USER ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 space-y-6 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[#0047FF] font-bold">// USER PROVISIONING</span>
                <h3 className="text-xl font-bold font-display text-[var(--foreground)] uppercase">Create New User</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[var(--muted-foreground)] uppercase text-[10px]">First Name</label>
                  <input
                    type="text"
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Last Name</label>
                  <input
                    type="text"
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Email Address</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] cursor-pointer"
                  >
                    <option value="CANDIDATE">Candidate</option>
                    <option value="RECRUITER">Recruiter</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Subscription</label>
                  <select
                    value={createForm.subscription}
                    onChange={(e) => setCreateForm({ ...createForm, subscription: e.target.value as SubscriptionTier })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] cursor-pointer"
                  >
                    <option value="FREE">Free</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account →</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT USER ================= */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 space-y-6 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[#0047FF] font-bold">// USER RECORD</span>
                <h3 className="text-xl font-bold font-display text-[var(--foreground)] uppercase">Edit User Account</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[var(--muted-foreground)] uppercase text-[10px]">First Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Email Address</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] cursor-pointer"
                  >
                    <option value="CANDIDATE">Candidate</option>
                    <option value="RECRUITER">Recruiter</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[var(--muted-foreground)] uppercase text-[10px]">Subscription</label>
                  <select
                    value={editForm.subscription}
                    onChange={(e) => setEditForm({ ...editForm, subscription: e.target.value as SubscriptionTier })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] cursor-pointer"
                  >
                    <option value="FREE">Free</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes →</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
