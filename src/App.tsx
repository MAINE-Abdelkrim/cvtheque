import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './providers/auth-provider';
import { LoginForm } from './components/auth/login-form';
import { RegisterForm } from './components/auth/register-form';
import { GoogleLoginButton } from './components/auth/google-login-button';
import { DashboardLayout } from './components/layout/dashboard-layout';
import { AdminView } from './components/dashboard/admin-view';
import { RecruiterView } from './components/dashboard/recruiter-view';
import { CandidateView } from './components/dashboard/candidate-view';
import { ProfileView } from './components/dashboard/profile-view';
import { SettingsView } from './components/dashboard/settings-view';
import { Unauthorized } from './components/dashboard/unauthorized';
import { Logo } from './components/ui/logo';
import { motion } from 'motion/react';
import { Sparkles, Loader2, ArrowRight, ShieldCheck, Mail, Lock, CheckCircle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

function AppContent() {
  const { user, profile, loading, resetPassword, signIn } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Synchronize with browser history and back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Safe navigation function
  const navigate = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  };

  // Middleware Redirections & Auth guards
  useEffect(() => {
    if (loading) return;

    const isAuthRoute = ['/login', '/register', '/forgot-password'].includes(currentPath);

    if (!profile) {
      // Unauthenticated users - redirect to login
      if (!isAuthRoute) {
        navigate('/login');
      }
    } else {
      // Authenticated users
      const role = profile.role;
      const defaultDashboard = `/dashboard/${role.toLowerCase()}`;

      if (isAuthRoute || currentPath === '/') {
        // Redirect active sessions to their default dashboard
        navigate(defaultDashboard);
      } else if (currentPath.startsWith('/dashboard/admin') && role !== 'ADMIN') {
        // Redirection middleware: unauthorized roles trying admin
        toast.error('Accès refusé. Rôle Administrateur requis.');
        navigate('/unauthorized');
      } else if (currentPath.startsWith('/dashboard/recruiter') && role !== 'RECRUITER') {
        // Redirection middleware: unauthorized roles trying recruiter
        toast.error('Accès refusé. Rôle Recruteur requis.');
        navigate('/unauthorized');
      } else if (currentPath.startsWith('/dashboard/candidate') && role !== 'CANDIDATE') {
        // Redirection middleware: unauthorized roles trying candidate
        toast.error('Accès refusé. Rôle Candidat requis.');
        navigate('/unauthorized');
      }
    }
  }, [profile, currentPath, loading]);

  // Renders the correct view matching the path
  const renderView = () => {
    switch (currentPath) {
      case '/unauthorized':
        return <Unauthorized onNavigate={navigate} />;
      case '/dashboard/admin':
        return <AdminView />;
      case '/dashboard/recruiter':
        return <RecruiterView />;
      case '/dashboard/candidate':
        return <CandidateView />;
      case '/profile':
        return <ProfileView />;
      case '/settings':
        return <SettingsView />;
      default:
        // Sub-navigation routes fallback safely to parents for Sprint 1 demo
        if (currentPath.startsWith('/dashboard/admin/')) {
          return <AdminView />;
        }
        if (currentPath.startsWith('/dashboard/recruiter/')) {
          return <RecruiterView />;
        }
        return <CandidateView />;
    }
  };

  // Determines dynamic title for headers
  const getPageTitle = () => {
    if (currentPath === '/unauthorized') return 'Accès non autorisé';
    if (currentPath.startsWith('/dashboard/admin')) return 'Panneau Administrateur';
    if (currentPath.startsWith('/dashboard/recruiter')) return 'Portail Recruteur';
    if (currentPath.startsWith('/dashboard/candidate')) return 'Espace Candidat';
    if (currentPath === '/profile') return 'Profil Utilisateur';
    if (currentPath === '/settings') return 'Configuration Système';
    return 'CVthèque IA';
  };

  // Loading Screen spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden select-none">
        <div className="absolute inset-0 glow-backdrop-purple pointer-events-none" />
        <div className="absolute inset-0 glow-backdrop-pink pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="z-10 flex flex-col items-center justify-center text-center px-4"
        >
          {/* Centered animated brand logo */}
          <motion.div 
            animate={{ 
              scale: [1, 1.03, 1],
            }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="mb-8"
          >
            <Logo variant="full" height={48} animated />
          </motion.div>

          <div className="flex flex-col items-center space-y-3.5">
            <div className="flex items-center space-x-2.5 text-slate-300 font-mono text-xs bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-2xl shadow-inner">
              <Loader2 className="w-4 h-4 animate-spin text-[#0066FF]" />
              <span className="tracking-wide">Initialisation de la session cognitive...</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
              CVthèque IA • Trouvez le talent, gagnez l'avenir
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  // Auth Layout (Login, Register, Forgot Password screens)
  if (!profile) {
    if (currentPath === '/register') {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 glow-backdrop-purple pointer-events-none" />
          <div className="absolute inset-0 glow-backdrop-pink pointer-events-none" />

          <motion.div 
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center space-y-4"
          >
            <div className="flex justify-center mb-1">
              <Logo variant="icon" height={52} animated />
            </div>
            <h2 className="text-2xl font-black font-display text-white tracking-tight">
              Créer un compte <span className="bg-gradient-to-r from-[#0066FF] to-[#7C3AED] bg-clip-text text-transparent">CVthèque IA</span>
            </h2>
            <p className="text-xs text-slate-400">
              Rejoignez le premier recruteur sémantique augmenté par l'IA.
            </p>
          </motion.div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
            <div className="glass-card py-8 px-8 rounded-3xl border border-slate-900 shadow-2xl space-y-6">
              <RegisterForm onSuccess={() => navigate('/dashboard/candidate')} />

              <p className="text-center text-xs text-slate-400 pt-2">
                Déjà un compte ?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Connectez-vous
                </button>
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (currentPath === '/forgot-password') {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 glow-backdrop-purple pointer-events-none" />

          <motion.div 
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center space-y-4"
          >
            <div className="flex justify-center mb-1">
              <Logo variant="icon" height={52} animated />
            </div>
            <h2 className="text-2xl font-black font-display text-white tracking-tight">
              Réinitialiser le mot de passe
            </h2>
            <p className="text-xs text-slate-400">
              Saisissez votre e-mail pour recevoir un lien de restauration sécurisé.
            </p>
          </motion.div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
            <div className="glass-card py-8 px-8 rounded-3xl border border-slate-900 shadow-2xl space-y-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const email = (form.elements.namedItem('reset-email') as HTMLInputElement).value;
                  if (email) {
                    await resetPassword(email);
                    toast.success('E-mail envoyé (simulation ou réel)');
                    navigate('/login');
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Adresse e-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                    <input
                      name="reset-email"
                      type="email"
                      required
                      placeholder="nom@exemple.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-900/45 text-white placeholder-slate-500 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
                >
                  Envoyer le lien
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 pt-4">
                <button
                  onClick={() => navigate('/login')}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Retourner à la connexion
                </button>
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Default: Login page screen
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-6 lg:px-8 relative overflow-hidden select-none">
        <div className="absolute inset-0 glow-backdrop-purple pointer-events-none" />
        <div className="absolute inset-0 glow-backdrop-pink pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center space-y-4"
        >
          <div className="flex justify-center mb-1">
            <Logo variant="icon" height={56} animated />
          </div>
          <h2 className="text-2xl font-black font-display text-white tracking-tight">
            Bienvenue sur <span className="bg-gradient-to-r from-[#0066FF] to-[#7C3AED] bg-clip-text text-transparent">CVthèque IA</span>
          </h2>
          <p className="text-xs text-slate-400">
            Trouvez le talent, gagnez l'avenir. Plateforme d'analyse et d'appariement intelligente de CVs.
          </p>
        </motion.div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <div className="glass-card py-8 px-8 rounded-3xl border border-slate-900 shadow-2xl space-y-6">
            <LoginForm
              onSuccess={() => {
                toast.success('Session ouverte avec succès !');
              }}
              onForgotPasswordClick={() => navigate('/forgot-password')}
            />

            <p className="text-center text-xs text-slate-400 pt-2">
              Pas encore de compte ?{' '}
              <button
                onClick={() => navigate('/register')}
                className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Inscrivez-vous gratuitement
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard layout container with actual views
  return (
    <DashboardLayout
      title={getPageTitle()}
      currentPath={currentPath}
      onNavigate={navigate}
    >
      {renderView()}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
