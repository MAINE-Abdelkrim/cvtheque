import React, { createContext, useContext, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth as clientAuth, isFirebaseConfigured } from '../lib/firebase/client';
import { dbEngine, DEFAULT_MOCK_USERS } from '../lib/firebase/db';
import type { UserProfile, UserRole } from '../types';

interface AuthContextValue {
  user: any | null; profile: UserProfile | null; loading: boolean; isSimulated: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, firstName: string, lastName: string, role: UserRole): Promise<void>;
  signInWithGoogle(role?: UserRole): Promise<void>; logout(): Promise<void>; resetPassword(email: string): Promise<void>;
  switchSimulatedUser(uid: string): Promise<void>; refreshProfile(): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const simulationEnabled = Boolean((import.meta as any).env?.DEV) && !isFirebaseConfigured;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const value = await dbEngine.getUserProfile(uid);
    if (!value) { setProfile(null); if (clientAuth?.currentUser) await signOut(clientAuth); throw Object.assign(new Error('PROFILE_MISSING'), { code: 'auth/profile-missing' }); }
    if (!value.isActive) { setProfile(null); if (clientAuth?.currentUser) await signOut(clientAuth); throw Object.assign(new Error('ACCOUNT_INACTIVE'), { code: 'auth/account-disabled' }); }
    setProfile(value);
  };
  const refreshProfile = async () => { if (user?.uid) await fetchProfile(user.uid); };

  useEffect(() => {
    if (isFirebaseConfigured && clientAuth) return onAuthStateChanged(clientAuth, async firebaseUser => {
      setLoading(true); setUser(firebaseUser);
      try { if (firebaseUser) await fetchProfile(firebaseUser.uid); else setProfile(null); } catch { setProfile(null); }
      finally { setLoading(false); }
    });
    if (simulationEnabled) {
      const uid = localStorage.getItem('cv_sim_active_uid') || DEFAULT_MOCK_USERS.find(value => value.role === 'CANDIDATE')?.uid;
      if (uid) dbEngine.getUserProfile(uid).then(value => { if (value) { setUser({ uid: value.uid, email: value.email, displayName: `${value.firstName} ${value.lastName}` }); setProfile(value); } }).finally(() => setLoading(false));
      else setLoading(false);
    } else setLoading(false);
  }, []);

  const requireAuth = () => { if (!isFirebaseConfigured || !clientAuth) throw Object.assign(new Error('AUTH_UNAVAILABLE'), { code: 'auth/network-request-failed' }); return clientAuth; };
  const signIn = async (email: string, password: string) => { setLoading(true); try { if (simulationEnabled) { const value = (await dbEngine.getAllUsers()).find(item => item.email.toLowerCase() === email.trim().toLowerCase()); if (!value) throw Object.assign(new Error('INVALID_CREDENTIAL'), { code: 'auth/invalid-credential' }); setUser({ uid:value.uid,email:value.email }); setProfile(value); localStorage.setItem('cv_sim_active_uid', value.uid); return; } const credential = await signInWithEmailAndPassword(requireAuth(), email, password); setUser(credential.user); await fetchProfile(credential.user.uid); } finally { setLoading(false); } };
  const signUp = async (email: string, password: string, firstName: string, lastName: string, role: UserRole) => { if (!['CANDIDATE','RECRUITER'].includes(role)) throw Object.assign(new Error('ROLE_INVALID'), { code: 'auth/invalid-role' }); setLoading(true); try { const auth = requireAuth(); const credential = await createUserWithEmailAndPassword(auth, email, password); const value: UserProfile = { uid:credential.user.uid, firstName:firstName.trim(), lastName:lastName.trim(), email:email.trim(), role:role as 'CANDIDATE'|'RECRUITER', subscription:'FREE', isActive:true, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }; await dbEngine.createUserProfile(value); setUser(credential.user); setProfile(value); } finally { setLoading(false); } };
  const signInWithGoogle = async (role: UserRole = 'CANDIDATE') => { if (!['CANDIDATE','RECRUITER'].includes(role)) role = 'CANDIDATE'; setLoading(true); try { const credential = await signInWithPopup(requireAuth(), new GoogleAuthProvider()); setUser(credential.user); const existing = await dbEngine.getUserProfile(credential.user.uid); if (existing) { if (!existing.isActive) throw Object.assign(new Error('ACCOUNT_INACTIVE'), { code:'auth/account-disabled' }); setProfile(existing); return; } const parts = credential.user.displayName?.trim().split(/\s+/) ?? []; const value: UserProfile = { uid:credential.user.uid, firstName:parts[0] || 'Utilisateur', lastName:parts.slice(1).join(' '), email:credential.user.email || '', role:role as 'CANDIDATE'|'RECRUITER', subscription:'FREE', isActive:true, photoURL:credential.user.photoURL || undefined, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }; await dbEngine.createUserProfile(value); setProfile(value); } finally { setLoading(false); } };
  const logout = async () => { setLoading(true); try { if (isFirebaseConfigured && clientAuth) await signOut(clientAuth); else if (simulationEnabled) localStorage.removeItem('cv_sim_active_uid'); setUser(null); setProfile(null); } finally { setLoading(false); } };
  const resetPassword = async (email: string) => { await sendPasswordResetEmail(requireAuth(), email); };
  const switchSimulatedUser = async (uid: string) => { if (!simulationEnabled) return; const value = await dbEngine.getUserProfile(uid); if (value) { localStorage.setItem('cv_sim_active_uid', uid); setUser({uid:value.uid,email:value.email}); setProfile(value); } };
  return <AuthContext.Provider value={{ user, profile, loading, isSimulated:simulationEnabled, signIn, signUp, signInWithGoogle, logout, resetPassword, switchSimulatedUser, refreshProfile }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within an AuthProvider'); return value; };
