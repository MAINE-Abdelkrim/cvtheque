import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { buildSelfProfileUpdate, getAuthErrorMessage } from '../../lib/auth/ux';
import { dbEngine } from '../../lib/firebase/db';
import { storageService } from '../../lib/storage-service';
import { useAuth } from '../../providers/auth-provider';
import { Badge, StatusBadge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { FormField, Input } from '../ui/form-controls';
import { PageHeader } from '../ui/page-header';
import { RoleBadge } from '../ui/role-badge';

export const ProfileView: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const avatarRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (profile) { setFirstName(profile.firstName); setLastName(profile.lastName); setPhotoURL(profile.photoURL ?? ''); } }, [profile]);
  if (!profile) return <div role="alert" className="text-sm text-[var(--danger)]">Votre profil est indisponible.</div>;
  const initials = `${profile.firstName.at(0) ?? ''}${profile.lastName.at(0) ?? ''}`.toUpperCase();

  const avatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Sélectionnez un fichier image valide.'); return; }
    setUploading(true); setError(undefined);
    try { setPhotoURL(await storageService.uploadFile(file, `users/${profile.uid}/avatars/${Date.now()}_${file.name}`)); toast.success('Photo chargée. Enregistrez pour confirmer.'); }
    catch (cause) { setError(getAuthErrorMessage(cause, 'profile')); }
    finally { setUploading(false); event.target.value = ''; }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(undefined);
    const payload = buildSelfProfileUpdate({ firstName, lastName, photoURL });
    if (!payload.firstName || !payload.lastName) { setError('Le prénom et le nom sont requis.'); return; }
    setSaving(true);
    try { await dbEngine.updateUserProfile(profile.uid, payload); await refreshProfile(); toast.success('Profil mis à jour.'); }
    catch (cause) { setError(getAuthErrorMessage(cause, 'profile')); }
    finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader title="Mon profil" description="Gérez vos informations personnelles et consultez les paramètres de votre compte." />
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card><CardContent className="text-center">
        <div className="relative mx-auto mb-4 h-24 w-24 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">{photoURL ? <img src={photoURL} alt="Photo de profil" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="flex h-full items-center justify-center text-xl font-semibold text-[var(--primary)]">{initials || <User className="h-6 w-6" />}</span>}<button type="button" onClick={() => avatarRef.current?.click()} disabled={uploading} className="absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center bg-black/65 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]" aria-label="Changer la photo de profil">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}</button></div>
        <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={avatar} />
        <p className="font-semibold text-[var(--foreground)]">{profile.firstName} {profile.lastName}</p><p className="mt-1 break-all text-sm text-[var(--muted-foreground)]">{profile.email}</p><div className="mt-4 flex flex-wrap justify-center gap-2"><RoleBadge role={profile.role} /><Badge>{profile.subscription === 'PREMIUM' ? 'Premium' : 'Gratuit'}</Badge><StatusBadge status={profile.isActive ? 'Actif' : 'Inactif'} /></div>
      </CardContent></Card>
      <div className="space-y-6">
        <Card><CardHeader><h2 className="text-base font-semibold text-[var(--foreground)]">Informations personnelles</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Ces informations peuvent être modifiées.</p></CardHeader><CardContent><form onSubmit={save} className="space-y-5" aria-busy={saving || uploading}>
          {error && <div role="alert" className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2.5 text-sm text-[var(--danger)]">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Prénom" htmlFor="profile-first-name" required><Input id="profile-first-name" autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} /></FormField><FormField label="Nom" htmlFor="profile-last-name" required><Input id="profile-last-name" autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} /></FormField></div>
          <Button type="submit" disabled={saving || uploading}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer les modifications</Button>
        </form></CardContent></Card>
        <Card><CardHeader><h2 className="text-base font-semibold text-[var(--foreground)]">Informations du compte</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Ces données sont gérées par la plateforme et ne sont pas modifiables ici.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><ReadOnly label="Adresse e-mail" value={profile.email} /><ReadOnly label="Rôle" value={profile.role === 'CANDIDATE' ? 'Candidat' : profile.role === 'RECRUITER' ? 'Recruteur' : 'Administrateur'} /><ReadOnly label="Abonnement" value={profile.subscription === 'PREMIUM' ? 'Premium' : 'Gratuit'} /><ReadOnly label="Statut" value={profile.isActive ? 'Actif' : 'Inactif'} /></CardContent></Card>
      </div>
    </div>
  </div>;
};

const ReadOnly: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><dt className="text-xs font-medium text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{value}</dd></div>;
