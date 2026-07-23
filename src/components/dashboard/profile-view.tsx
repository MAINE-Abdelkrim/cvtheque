import React, { useState, useRef } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { RoleBadge } from '../ui/role-badge';
import { User, Mail, CreditCard, Sparkles, Shield, KeyRound, Check, HelpCircle, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { storageService } from '../../lib/storage-service';

export const ProfileView: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  if (!profile) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadingAvatar(true);
      try {
        const path = `users/${profile.uid}/avatars/${Date.now()}_${file.name}`;
        const uploadedUrl = await storageService.uploadFile(file, path);
        setPhotoURL(uploadedUrl);
        toast.success('Nouvelle image chargée ! Cliquez sur Enregistrer pour valider.');
      } catch (err: any) {
        toast.error(err.message || 'Erreur d\'upload de l\'image de profil.');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      toast.error('Le prénom et le nom sont requis.');
      return;
    }

    setSaving(true);
    try {
      await dbEngine.updateUserProfile(profile.uid, {
        firstName,
        lastName,
        photoURL: photoURL.trim() || undefined
      });
      await refreshProfile();
      toast.success('Votre profil a été mis à jour avec succès.');
    } catch (err) {
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubscription = async () => {
    const nextTier = profile.subscription === 'FREE' ? 'PREMIUM' : 'FREE';
    try {
      await dbEngine.updateUserProfile(profile.uid, { subscription: nextTier });
      await refreshProfile();
      toast.success(`Abonnement mis à jour: ${nextTier === 'PREMIUM' ? 'Version Premium Activée !' : 'Retour au plan gratuit'}`);
    } catch (e) {
      toast.error('Erreur d\'abonnement.');
    }
  };

  return (
    <div className="space-y-8 select-none">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Profile overview card (1/3 of space) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-slate-800/60 flex flex-col items-center justify-center text-center relative overflow-hidden">
            {/* Glowing backdrop circle */}
            <div className="absolute -left-10 -top-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative group cursor-pointer mb-4" onClick={() => avatarInputRef.current?.click()} title="Cliquez pour changer votre image">
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
              <img
                src={photoURL || profile.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'}
                alt="Avatar"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-800 bg-slate-900 shadow-2xl transition-all duration-300 group-hover:scale-105 group-hover:border-indigo-500/50"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </div>

            <h3 className="text-base font-bold font-display text-white">
              {profile.firstName} {profile.lastName}
            </h3>
            <p className="text-xs text-slate-500 font-mono mb-4">{profile.email}</p>

            <div className="flex flex-col space-y-2 w-full mt-2">
              <div className="flex justify-between items-center px-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-xs">
                <span className="text-slate-500 font-medium">Type de compte</span>
                <RoleBadge role={profile.role} />
              </div>
              <div className="flex justify-between items-center px-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-xs">
                <span className="text-slate-500 font-medium">Abonnement</span>
                <RoleBadge subscription={profile.subscription} />
              </div>
            </div>
          </div>

          {/* Premium promotion banner if FREE */}
          {profile.subscription === 'FREE' ? (
            <div className="rounded-2xl p-6 bg-gradient-to-tr from-indigo-950/80 to-pink-950/50 border border-indigo-500/20 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-pink-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center space-x-2 text-xs text-indigo-400 font-bold mb-2.5">
                <Sparkles className="w-4.5 h-4.5 shrink-0" />
                <span>Passez à la version PREMIUM</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Débloquez le matching de CVs illimités, l'accès à la base de données candidats globale et l'évaluation d'entretiens par l'IA.
              </p>
              <button
                onClick={handleToggleSubscription}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Activer Premium (Gratuit pour démo)
              </button>
            </div>
          ) : (
            <div className="rounded-2xl p-6 bg-gradient-to-tr from-emerald-950/60 to-teal-950/40 border border-emerald-500/20 relative overflow-hidden">
              <div className="flex items-center space-x-2 text-xs text-emerald-400 font-bold mb-2.5">
                <Check className="w-4.5 h-4.5 shrink-0" />
                <span>Premium Actif</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Vous disposez de toutes les fonctionnalités de la plateforme CVthèque IA, y compris l'analyse sémantique cognitive illimitée.
              </p>
              <button
                onClick={handleToggleSubscription}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 font-semibold text-xs transition-colors cursor-pointer"
              >
                Retourner au plan gratuit
              </button>
            </div>
          )}
        </div>

        {/* Right column: Edit forms (2/3 of space) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-slate-800/60">
            <h3 className="text-sm font-bold font-display text-white border-b border-slate-900 pb-4 mb-6 flex items-center space-x-2">
              <User className="w-4.5 h-4.5 text-indigo-400" />
              <span>Détails du profil personnel</span>
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Prénom</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/40 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Nom</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/40 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Adresse e-mail (Non modifiable)</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-600" />
                  <input
                    type="email"
                    disabled
                    value={profile.email}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-900 bg-slate-950 text-slate-500 text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">URL de l'image de profil</label>
                <input
                  type="text"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/40 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
