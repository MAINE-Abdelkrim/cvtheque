import React, { useState, useRef } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { RoleBadge } from '../ui/role-badge';
import { User, Mail, CreditCard, Sparkles, Shield, Camera, Loader2, Check, ArrowRight } from 'lucide-react';
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
        toast.success('New image loaded. Click Save Changes to confirm.');
      } catch (err: any) {
        toast.error(err.message || 'Error uploading profile image.');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      toast.error('First name and last name are required.');
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
      toast.success('Your profile has been successfully updated.');
    } catch (err) {
      toast.error('Error during update.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubscription = async () => {
    const nextTier = profile.subscription === 'FREE' ? 'PREMIUM' : 'FREE';
    try {
      await dbEngine.updateUserProfile(profile.uid, { subscription: nextTier });
      await refreshProfile();
      toast.success(`Subscription updated: ${nextTier === 'PREMIUM' ? 'Premium Activated!' : 'Free Plan Active'}`);
    } catch (e) {
      toast.error('Subscription error.');
    }
  };

  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="space-y-12 pb-24 text-left select-none max-w-6xl mx-auto font-sans">
      {/* ================= PROFILE HERO ================= */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--border)] pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
              // PROFESSIONAL IDENTITY
            </span>
            <span className="h-px w-12 bg-white/10" />
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
              ACCOUNT DOSSIER
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase leading-[1.05]">
            YOUR PROFILE.<br />
            <span className="text-[var(--muted-foreground)]">YOUR SIGNAL.</span>
          </h1>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center gap-3 shrink-0">
          <RoleBadge role={profile.role} />
          <RoleBadge subscription={profile.subscription} />
        </div>
      </div>

      {/* ================= ASYMMETRIC COMPOSITION ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Identity & Status (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] flex flex-col items-center text-center space-y-6">
            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()} title="Change Avatar">
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
              {photoURL || profile.photoURL ? (
                <img
                  src={photoURL || profile.photoURL}
                  alt=""
                  className="w-28 h-28 rounded-2xl object-cover border-2 border-[var(--border-strong)] bg-[var(--surface-secondary)] shadow-xl transition-transform group-hover:scale-105 group-hover:border-[#0047FF]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-[#0047FF]/10 border-2 border-[#0047FF]/30 flex items-center justify-center text-3xl font-mono font-bold text-[var(--foreground)] shadow-xl transition-transform group-hover:scale-105">
                  {initials || 'USER'}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-[#0047FF] animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-[var(--foreground)]" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold font-display text-[var(--foreground)] uppercase tracking-tight">
                {profile.firstName} {profile.lastName}
              </h3>
              <p className="text-xs font-mono text-[var(--muted-foreground)]">{profile.email}</p>
            </div>

            <div className="w-full pt-4 border-t border-[var(--border)] space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center px-4 py-3 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
                <span className="text-[var(--muted-foreground)] uppercase text-[10px]">ACCOUNT STATUS</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
                <span className="text-[var(--muted-foreground)] uppercase text-[10px]">USER ID</span>
                <span className="text-[var(--foreground)] font-bold">{profile.uid.slice(0, 8)}...</span>
              </div>
            </div>
          </div>

          {/* Subscription Panel */}
          <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <span className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest">// PLAN SIGNATURE</span>
              <RoleBadge subscription={profile.subscription} />
            </div>

            <p className="text-xs text-[var(--foreground-secondary)] font-sans leading-relaxed">
              {profile.subscription === 'PREMIUM'
                ? 'You currently hold unlimited access to advanced semantic ranking and AI interview studio suites.'
                : 'You are operating on the standard candidate and recruiter tier with standard quotas.'}
            </p>

            <button
              onClick={handleToggleSubscription}
              className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0047FF]" />
              <span>{profile.subscription === 'PREMIUM' ? 'SWITCH TO FREE PLAN' : 'ACTIVATE PREMIUM'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Personal Information Form (8 cols) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSaveProfile} className="p-8 sm:p-10 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-8">
            <div className="space-y-2 border-b border-[var(--border)] pb-4">
              <span className="text-[10px] font-mono font-bold text-[#0047FF] uppercase tracking-widest">// 01 / IDENTITY METRICS</span>
              <h3 className="text-2xl font-bold font-display text-[var(--foreground)] uppercase">PERSONAL INFORMATION</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono text-xs">
              <div className="space-y-2">
                <label className="text-[var(--muted-foreground)] uppercase text-[10px] font-bold">FIRST NAME</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[var(--muted-foreground)] uppercase text-[10px] font-bold">LAST NAME</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <label className="text-[var(--muted-foreground)] uppercase text-[10px] font-bold">EMAIL ADDRESS (IMMUTABLE)</label>
              <input
                type="email"
                disabled
                value={profile.email}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] cursor-not-allowed"
              />
            </div>

            <div className="space-y-2 border-b border-[var(--border)] pb-4 pt-4">
              <span className="text-[10px] font-mono font-bold text-[#0047FF] uppercase tracking-widest">// 02 / SYSTEM ACCESS</span>
              <h3 className="text-2xl font-bold font-display text-[var(--foreground)] uppercase">ACCESS PRIVILEGES</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono text-xs">
              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--muted-foreground)] text-[10px]">ASSIGNED ROLE</span>
                <p className="text-[var(--foreground)] font-bold text-sm uppercase">{profile.role}</p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--muted-foreground)] text-[10px]">SUBSCRIPTION TIER</span>
                <p className="text-[var(--foreground)] font-bold text-sm uppercase">{profile.subscription}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-[var(--border)] flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3.5 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>SAVE CHANGES →</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

