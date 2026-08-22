import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AdminUsersList, roleOptions } from '../admin/admin-users-list';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Dialog } from '../ui/dialog';
import { FormField, Input, Select } from '../ui/form-controls';
import { PageHeader, SectionHeader } from '../ui/page-header';
import { dbEngine } from '../../lib/firebase/db';
import { createAdminUser, deleteAdminUser, updateAdminUser } from '../../lib/api/admin-users';
import type { SubscriptionTier, UserProfile, UserRole } from '../../types';

type UserForm = { firstName: string; lastName: string; email: string; role: UserRole; subscription: SubscriptionTier; isActive: boolean };
const emptyCreate: UserForm & { password: string } = { firstName: '', lastName: '', email: '', password: '', role: 'CANDIDATE', subscription: 'FREE', isActive: true };

export const AdminView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<UserForm | null>(null);
  const [statusTarget, setStatusTarget] = useState<UserProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setLoadError(null);
    try { setUsers(await dbEngine.getAllUsers()); }
    catch { setLoadError('Impossible de charger les utilisateurs pour le moment.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadUsers(); }, []);

  const filteredUsers = useMemo(() => users.filter(user => {
    const matchesQuery = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesRole = role === 'ALL' || user.role === role;
    const matchesStatus = status === 'ALL' || (status === 'ACTIVE' ? user.isActive : !user.isActive);
    return matchesQuery && matchesRole && matchesStatus;
  }), [users, query, role, status]);

  const counts = { total: users.length, candidates: users.filter(user => user.role === 'CANDIDATE').length, recruiters: users.filter(user => user.role === 'RECRUITER').length, active: users.filter(user => user.isActive).length };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim() || !createForm.password) return;
    setSaving(true);
    try {
      await createAdminUser(createForm);
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      toast.success('Utilisateur créé.');
      await loadUsers();
    } catch { toast.error('Impossible de créer cet utilisateur.'); }
    finally { setSaving(false); }
  };

  const openEdit = (user: UserProfile) => {
    setEditing(user);
    setEditForm({ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, subscription: user.subscription, isActive: user.isActive });
  };

  const updateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !editForm) return;
    setSaving(true);
    try {
      await updateAdminUser(editing.uid, editForm);
      setEditing(null);
      setEditForm(null);
      toast.success('Utilisateur mis à jour.');
      await loadUsers();
    } catch { toast.error('Impossible de mettre à jour cet utilisateur.'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (!statusTarget) return;
    setSaving(true);
    try {
      await updateAdminUser(statusTarget.uid, { isActive: !statusTarget.isActive });
      setStatusTarget(null);
      toast.success('Statut du compte mis à jour.');
      await loadUsers();
    } catch { toast.error('Impossible de modifier le statut du compte.'); }
    finally { setSaving(false); }
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteAdminUser(deleteTarget.uid);
      setDeleteTarget(null);
      toast.success('Utilisateur supprimé.');
      await loadUsers();
    } catch { toast.error('Impossible de supprimer cet utilisateur.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-8">
    <PageHeader title="Administration" description="Gérez les comptes et les accès de la plateforme." actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />Créer un utilisateur</Button>} />

    <section aria-labelledby="platform-overview-title"><Card><CardHeader><SectionHeader title="Vue d’ensemble" description="Données calculées à partir des comptes actuellement enregistrés." /></CardHeader><CardContent><h2 id="platform-overview-title" className="sr-only">Vue d’ensemble de la plateforme</h2><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><OverviewValue label="Utilisateurs" value={counts.total} /><OverviewValue label="Candidats" value={counts.candidates} /><OverviewValue label="Recruteurs" value={counts.recruiters} /><OverviewValue label="Comptes actifs" value={counts.active} /></dl></CardContent></Card></section>

    <Card aria-busy={loading}>
      <CardHeader><SectionHeader title="Utilisateurs" description="Consultez les rôles, abonnements et statuts des comptes." /></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input aria-label="Rechercher un utilisateur" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher par nom ou email" className="pl-9" /></div><Select aria-label="Filtrer par rôle" value={role} onChange={event => setRole(event.target.value as UserRole | 'ALL')}>{roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><Select aria-label="Filtrer par statut" value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="ALL">Tous les statuts</option><option value="ACTIVE">Actifs</option><option value="INACTIVE">Inactifs</option></Select></div>
        {loadError ? <div role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,transparent)] p-4 text-sm text-[var(--danger)]">{loadError}<Button variant="outline" size="sm" className="ml-3" onClick={() => void loadUsers()}>Réessayer</Button></div> : <AdminUsersList users={filteredUsers} loading={loading} onEdit={openEdit} onToggleStatus={setStatusTarget} onDelete={setDeleteTarget} />}
      </CardContent>
    </Card>

    <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} title="Créer un utilisateur" description="Créez un compte et définissez ses accès initiaux." footer={<DialogActions saving={saving} submitLabel="Créer l’utilisateur" formId="create-user-form" onCancel={() => setCreateOpen(false)} />}><form id="create-user-form" onSubmit={createUser}><UserFormFields id="create" form={createForm} setForm={setCreateForm} includePassword /></form></Dialog>

    <Dialog open={Boolean(editing && editForm)} onClose={() => !saving && setEditing(null)} title="Modifier l’utilisateur" description="Mettez à jour les informations et les accès du compte." footer={<DialogActions saving={saving} submitLabel="Enregistrer" formId="edit-user-form" onCancel={() => setEditing(null)} />}><form id="edit-user-form" onSubmit={updateUser}><UserFormFields id="edit" form={editForm!} setForm={setEditForm as React.Dispatch<React.SetStateAction<UserForm>>} /></form></Dialog>

    <Dialog open={Boolean(statusTarget)} onClose={() => !saving && setStatusTarget(null)} title={statusTarget?.isActive ? 'Désactiver ce compte ?' : 'Activer ce compte ?'} description={statusTarget?.isActive ? 'Cet utilisateur ne pourra plus accéder à la plateforme.' : 'Cet utilisateur pourra de nouveau accéder à la plateforme.'} footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStatusTarget(null)} disabled={saving}>Annuler</Button><Button variant={statusTarget?.isActive ? 'danger' : 'primary'} onClick={() => void toggleStatus()} disabled={saving}>{saving ? 'Mise à jour…' : statusTarget?.isActive ? 'Désactiver' : 'Activer'}</Button></div>}><p className="text-sm text-[var(--muted-foreground)]">{statusTarget?.firstName} {statusTarget?.lastName}</p></Dialog>

    <Dialog open={Boolean(deleteTarget)} onClose={() => !saving && setDeleteTarget(null)} title="Supprimer cet utilisateur ?" description="Cette action supprimera définitivement le compte." footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Annuler</Button><Button variant="danger" onClick={() => void deleteUser()} disabled={saving}>{saving ? 'Suppression…' : 'Supprimer'}</Button></div>}><p className="text-sm text-[var(--muted-foreground)]">{deleteTarget?.firstName} {deleteTarget?.lastName}</p></Dialog>
  </div>;
};

const OverviewValue: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-4"><dt className="text-sm text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">{value}</dd></div>;

const DialogActions: React.FC<{ saving: boolean; submitLabel: string; formId: string; onCancel: () => void }> = ({ saving, submitLabel, formId, onCancel }) => <div className="flex justify-end gap-2"><Button variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button><Button type="submit" form={formId} disabled={saving}>{saving ? 'Enregistrement…' : submitLabel}</Button></div>;

const UserFormFields = <T extends UserForm & { password?: string }>({ id, form, setForm, includePassword = false }: { id: string; form: T; setForm: React.Dispatch<React.SetStateAction<T>>; includePassword?: boolean }) => <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><FormField label="Prénom" htmlFor={`${id}-first-name`} required><Input id={`${id}-first-name`} required value={form.firstName} onChange={event => setForm(current => ({ ...current, firstName: event.target.value }))} /></FormField><FormField label="Nom" htmlFor={`${id}-last-name`} required><Input id={`${id}-last-name`} required value={form.lastName} onChange={event => setForm(current => ({ ...current, lastName: event.target.value }))} /></FormField></div><FormField label="Email" htmlFor={`${id}-email`} required><Input id={`${id}-email`} type="email" required value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></FormField>{includePassword && <FormField label="Mot de passe temporaire" htmlFor={`${id}-password`} required><Input id={`${id}-password`} type="password" required value={form.password ?? ''} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} /></FormField>}<div className="grid gap-4 sm:grid-cols-2"><FormField label="Rôle" htmlFor={`${id}-role`}><Select id={`${id}-role`} value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value as UserRole }))}><option value="CANDIDATE">Candidat</option><option value="RECRUITER">Recruteur</option><option value="ADMIN">Administrateur</option></Select></FormField><FormField label="Abonnement" htmlFor={`${id}-subscription`}><Select id={`${id}-subscription`} value={form.subscription} onChange={event => setForm(current => ({ ...current, subscription: event.target.value as SubscriptionTier }))}><option value="FREE">Gratuit</option><option value="PREMIUM">Premium</option></Select></FormField></div><label className="flex items-center gap-2 text-sm text-[var(--foreground)]"><input type="checkbox" checked={form.isActive} onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded accent-[var(--primary)]" />Compte actif</label></div>;
