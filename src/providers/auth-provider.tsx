import React, { createContext, useContext, useState, useEffect } from 'react';
import { isFirebaseConfigured, auth as clientAuth } from '../lib/firebase/client';
import { dbEngine, DEFAULT_MOCK_USERS } from '../lib/firebase/db';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from 'firebase/auth';
import { UserProfile, UserRole, SubscriptionTier } from '../types';
import { AlertTriangle, Copy, Check, ExternalLink, X, Globe } from 'lucide-react';
import firebaseAppletConfig from '../../firebase-applet-config.json';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isSimulated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, role: UserRole) => Promise<void>;
  signInWithGoogle: (role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchSimulatedUser: (uid: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSimulated, setIsSimulated] = useState(!isFirebaseConfigured);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Load profile from database/mock
  const fetchProfile = async (uid: string) => {
    try {
      const p = await dbEngine.getUserProfile(uid);
      if (p) {
        setProfile(p);
      } else {
        // Automatically create user profile document if it does not exist. Default role: CANDIDATE.
        // Try to fetch email and name from current authenticated user if available
        let email = 'user@cvtheque.ai';
        let firstName = 'Utilisateur';
        let lastName = 'Nouveau';
        let photoURL = undefined;

        if (isFirebaseConfigured && clientAuth && clientAuth.currentUser) {
          email = clientAuth.currentUser.email || email;
          const displayName = clientAuth.currentUser.displayName || '';
          if (displayName) {
            const parts = displayName.split(' ');
            firstName = parts[0] || firstName;
            lastName = parts.slice(1).join(' ') || lastName;
          }
          photoURL = clientAuth.currentUser.photoURL || undefined;
        }

        const role = email.includes('admin') ? 'ADMIN' : email.includes('recruiter') ? 'RECRUITER' : 'CANDIDATE';

        const defaultProfile: UserProfile = {
          uid,
          firstName,
          lastName,
          email,
          role,
          subscription: role === 'CANDIDATE' ? 'FREE' : 'PREMIUM',
          isActive: true,
          photoURL,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await dbEngine.createUserProfile(defaultProfile);
        setProfile(defaultProfile);
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
    }
  };

  const refreshProfile = async () => {
    if (user?.uid) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    if (isFirebaseConfigured && clientAuth) {
      const unsubscribe = onAuthStateChanged(clientAuth, async (firebaseUser) => {
        setLoading(true);
        if (firebaseUser) {
          setUser(firebaseUser);
          await fetchProfile(firebaseUser.uid);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && clientAuth) {
        try {
          const cred = await signInWithEmailAndPassword(clientAuth, email, password);
          setUser(cred.user);
          await fetchProfile(cred.user.uid);
        } catch (error: any) {
          if (error.code === 'auth/operation-not-allowed') {
            throw new Error("La méthode d'authentification par e-mail/mot de passe n'est pas activée dans votre console Firebase.");
          }
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            throw new Error("Identifiants invalides. Vérifiez votre mot de passe, ou si vous avez utilisé Google pour vous inscrire, cliquez sur 'Continuer avec Google'.");
          }
          throw error;
        }
      } else { throw new Error("Firebase non configuré. Veuillez connecter un projet Firebase."); } } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, role: UserRole) => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && clientAuth) {
        try {
          const cred = await createUserWithEmailAndPassword(clientAuth, email, password);
          const newProfile: UserProfile = {
            uid: cred.user.uid,
            firstName,
            lastName,
            email,
            role,
            subscription: 'FREE',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await dbEngine.createUserProfile(newProfile);
          setUser(cred.user);
          setProfile(newProfile);
        } catch (error: any) {
          if (error.code === 'auth/operation-not-allowed') {
            throw new Error(
              "La méthode d'inscription par e-mail/mot de passe n'est pas activée dans votre console Firebase. " +
              "Pour l'activer : rendez-vous dans votre console Firebase > Authentication > Sign-in method, puis activez 'Adresse e-mail/Mot de passe'. " +
              "Après l'avoir activée, réessayez de vous inscrire pour voir le compte apparaître dans l'onglet Users de Firebase !"
            );
          }
          throw error;
        }
      } else { throw new Error("Firebase non configuré. Veuillez connecter un projet Firebase."); } } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (role: UserRole = 'CANDIDATE') => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && clientAuth) {
        const provider = new GoogleAuthProvider();
        try {
          const cred = await signInWithPopup(clientAuth, provider);
          setUser(cred.user);
          // Check if profile exists, if not create it
          const existingProfile = await dbEngine.getUserProfile(cred.user.uid);
          if (!existingProfile) {
            const names = cred.user.displayName?.split(' ') || ['Utilisateur', 'Google'];
            const newProfile: UserProfile = {
              uid: cred.user.uid,
              firstName: names[0] || 'Prénom',
              lastName: names.slice(1).join(' ') || 'Nom',
              email: cred.user.email || '',
              role,
              subscription: 'FREE',
              isActive: true,
              photoURL: cred.user.photoURL || undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await dbEngine.createUserProfile(newProfile);
            setProfile(newProfile);
          } else {
            setProfile(existingProfile);
          }
        } catch (error: any) {
          if (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup-closed-by-user')) {
            console.info('Connexion Google annulée par l\'utilisateur (fenêtre fermée).');
            return;
          }
          if (error.code === 'auth/popup-blocked' || error.message?.includes('popup-blocked')) {
            throw new Error(
              "La fenêtre contextuelle Google a été bloquée par votre navigateur. " +
              "Veuillez autoriser les popups pour ce site ou ouvrir l'application dans un nouvel onglet."
            );
          }
          if (error.code === 'auth/cancelled-popup-request') {
            return;
          }
          if (error.code === 'auth/unauthorized-domain' || error.message?.includes('unauthorized-domain')) {
            setShowDomainModal(true);
            throw new Error(
              "Ce domaine de prévisualisation n'est pas autorisé dans votre console Firebase. " +
              "Veuillez l'ajouter dans les paramètres d'authentification Firebase."
            );
          }
          throw error;
        }
      } else {
        throw new Error("Firebase non configuré. L'authentification Google nécessite une configuration backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && clientAuth) {
        await signOut(clientAuth);
      } else {
        localStorage.removeItem('cv_sim_active_uid');
        setUser(null);
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (isFirebaseConfigured && clientAuth) {
      await sendPasswordResetEmail(clientAuth, email);
    } else {
      // Simulation password reset
      console.log(`Simulation: Un email de réinitialisation de mot de passe a été envoyé à ${email}`);
    }
  };

  const switchSimulatedUser = async (uid: string) => {
    setLoading(true);
    try {
      localStorage.setItem('cv_sim_active_uid', uid);
      const matched = await dbEngine.getUserProfile(uid);
      if (matched) {
        setUser({
          uid: matched.uid,
          email: matched.email,
          displayName: `${matched.firstName} ${matched.lastName}`,
          photoURL: matched.photoURL
        });
        setProfile(matched);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const devHostname = currentHostname.includes('ais-pre-')
    ? currentHostname.replace('ais-pre-', 'ais-dev-')
    : currentHostname;
  const preHostname = currentHostname.includes('ais-dev-')
    ? currentHostname.replace('ais-dev-', 'ais-pre-')
    : currentHostname;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const firebaseProjectId = firebaseAppletConfig?.projectId || 'cvtheque-ai';
  const consoleSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isSimulated,
        signIn,
        signUp,
        signInWithGoogle,
        logout,
        resetPassword,
        switchSimulatedUser,
        refreshProfile
      }}
    >
      {children}

      {/* Modal d'instructions d'autorisation de domaine Firebase */}
      {showDomainModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-xl bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 lg:p-8 shadow-2xl space-y-6 relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 p-4">
              <button
                onClick={() => setShowDomainModal(false)}
                className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-xl hover:bg-[var(--surface-elevated)] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-3 text-amber-500 bg-amber-500/10 p-4 rounded-2xl border border-amber-500/15">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-amber-400">Action requise : Autoriser le domaine</h3>
                <p className="text-xs text-amber-300/80 mt-0.5">La connexion Google nécessite l'autorisation du domaine de prévisualisation.</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[var(--foreground-secondary)] leading-relaxed">
                Firebase refuse la connexion car les domaines de la plateforme AI Studio ne sont pas enregistrés dans votre console Firebase. Veuillez suivre ces étapes rapides pour l'activer :
              </p>

              <div className="space-y-3.5">
                <div className="flex items-start space-x-3 text-xs">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-bold mt-0.5">1</span>
                  <div className="space-y-1 text-[var(--foreground-secondary)]">
                    <span>Ouvrez votre console Firebase dans l'onglet des domaines autorisés :</span>
                    <a
                      href={consoleSettingsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4 mt-1"
                    >
                      <span>Ouvrir les Paramètres Firebase</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-xs">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-bold mt-0.5">2</span>
                  <div className="space-y-1.5 text-[var(--foreground-secondary)] w-full">
                    <span>Dans la section <b>Domaines autorisés</b>, cliquez sur <b>Ajouter un domaine</b> et ajoutez ces deux adresses :</span>
                    
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono">
                        <span className="text-indigo-300 truncate mr-2">{devHostname}</span>
                        <button
                          onClick={() => handleCopy(devHostname)}
                          className="flex items-center space-x-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-elevated)] p-1 px-2.5 rounded-lg transition-all cursor-pointer"
                        >
                          {copiedText === devHostname ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[10px] text-emerald-400">Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Copier</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono">
                        <span className="text-indigo-300 truncate mr-2">{preHostname}</span>
                        <button
                          onClick={() => handleCopy(preHostname)}
                          className="flex items-center space-x-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-elevated)] p-1 px-2.5 rounded-lg transition-all cursor-pointer"
                        >
                          {copiedText === preHostname ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[10px] text-emerald-400">Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Copier</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-xs">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-bold mt-0.5">3</span>
                  <p className="text-[var(--foreground-secondary)] mt-0.5">
                    Une fois enregistrés dans Firebase, fermez cette fenêtre et réessayez la connexion Google !
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDomainModal(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-[var(--foreground)] text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
              >
                Compris, j'ai ajouté les domaines
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
