import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './providers/auth-provider';
import { LoginForm } from './components/auth/login-form';
import { RegisterForm } from './components/auth/register-form';
import { DashboardLayout } from './components/layout/dashboard-layout';
import { AdminView } from './components/dashboard/admin-view';
import { RecruiterView } from './components/dashboard/recruiter-view';
import { CreateJobPage } from './components/dashboard/create-job-page';
import { CandidateView } from './components/dashboard/candidate-view';
import { CvUploadPage } from './components/dashboard/cv-upload-page';
import { FindJobsPage } from './components/dashboard/find-jobs-page';
import { OralInterviewRoom } from './components/dashboard/oral-interview-room';
import { ProfileView } from './components/dashboard/profile-view';
import { SettingsView } from './components/dashboard/settings-view';
import { Unauthorized } from './components/dashboard/unauthorized';
import { Logo } from './components/ui/logo';
import { motion } from 'motion/react';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
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
      if (!isAuthRoute) {
        navigate('/login');
      }
    } else {
      const role = profile.role;
      const defaultDashboard = `/dashboard/${role.toLowerCase()}`;

      if (isAuthRoute || currentPath === '/') {
        navigate(defaultDashboard);
      } else if (currentPath === '/settings' && role !== 'ADMIN') {
        toast.error('Accès refusé. Réservé aux administrateurs.');
        navigate('/unauthorized');
      } else if (currentPath.startsWith('/dashboard/admin') && role !== 'ADMIN') {
        toast.error('Accès refusé. Rôle Administrateur requis.');
        navigate('/unauthorized');
      } else if (currentPath.startsWith('/dashboard/recruiter') && role !== 'RECRUITER' && role !== 'ADMIN') {
        toast.error('Accès refusé. Rôle Recruteur requis.');
        navigate('/unauthorized');
      } else if (currentPath === '/create-job' && role !== 'RECRUITER' && role !== 'ADMIN') {
        toast.error('Accès refusé. Rôle Recruteur requis.');
        navigate('/unauthorized');
      } else if (currentPath.startsWith('/dashboard/candidate') && role !== 'CANDIDATE') {
        toast.error('Accès refusé. Rôle Candidat requis.');
        navigate('/unauthorized');
      }
    }
  }, [profile, currentPath, loading]);

  const renderView = () => {
    switch (currentPath) {
      case '/unauthorized':
        return <Unauthorized onNavigate={navigate} />;
      case '/dashboard/admin':
        return <AdminView />;
      case '/dashboard/recruiter':
        return <RecruiterView onNavigate={navigate} />;
      case '/dashboard/recruiter/create-job':
      case '/create-job':
        return <CreateJobPage onNavigate={navigate} />;
      case '/dashboard/candidate':
        return <CandidateView onNavigate={navigate} />;
      case '/dashboard/candidate/cv':
      case '/upload-cv':
      case '/cv-upload':
        return <CvUploadPage onNavigate={navigate} />;
      case '/dashboard/candidate/jobs':
      case '/jobs':
        return <FindJobsPage onNavigate={navigate} />;
      case '/dashboard/candidate/interview':
      case '/interview':
        return <OralInterviewRoom onNavigate={navigate} />;
      case '/profile':
        return <ProfileView />;
      case '/settings':
        return <SettingsView />;
      default:
        if (currentPath.startsWith('/dashboard/admin/')) {
          return <AdminView />;
        }
        if (currentPath === '/dashboard/recruiter/create-job') {
          return <CreateJobPage onNavigate={navigate} />;
        }
        if (currentPath.startsWith('/dashboard/recruiter/')) {
          return <RecruiterView onNavigate={navigate} />;
        }
        return <CandidateView />;
    }
  };

  const getPageTitle = () => {
    if (currentPath === '/unauthorized') return 'Access Restricted';
    if (currentPath.startsWith('/dashboard/admin')) return 'Admin Control Center';
    if (currentPath === '/dashboard/recruiter/create-job' || currentPath === '/create-job') return 'Create Job Position';
    if (currentPath.startsWith('/dashboard/recruiter')) return 'Recruiter Portal';
    if (currentPath === '/dashboard/candidate/cv' || currentPath === '/upload-cv') return 'CV Upload & Analysis';
    if (currentPath === '/dashboard/candidate/interview' || currentPath === '/interview') return 'AI Oral Interview';
    if (currentPath.startsWith('/dashboard/candidate')) return 'Candidate Dashboard';
    if (currentPath === '/profile') return 'User Identity';
    if (currentPath === '/settings') return 'System Configuration';
    return 'CVthèque Intelligence';
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex flex-col items-center justify-center relative overflow-hidden select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="z-10 flex flex-col items-center justify-center text-center px-4"
        >
          <div className="mb-8">
            <Logo variant="full" height={48} />
          </div>
          <div className="flex flex-col items-center space-y-3.5">
            <div className="flex items-center space-x-2.5 text-[var(--foreground-secondary)] font-mono text-xs bg-[var(--surface-secondary)] border border-[var(--border)] px-4 py-2.5 rounded-xl shadow-inner">
              <Loader2 className="w-4 h-4 animate-spin text-[#0047FF]" />
              <span className="tracking-wide">INITIALIZING COGNITIVE SESSION...</span>
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono uppercase tracking-widest">
              // CVTHÈQUE INTELLIGENCE ENGINE
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ================= EDITORIAL AUTH LAYOUT =================
  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--surface)] text-[var(--foreground)] flex flex-col lg:flex-row select-none font-sans overflow-x-hidden">
        {/* Left Brand Panel (Hidden on mobile or compact) */}
        <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[var(--border)] relative bg-[var(--surface)]">
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Logo variant="full" height={36} />
            </div>

            <div className="pt-8 space-y-4">
              <span className="text-xs font-mono font-bold text-[#0047FF] tracking-widest uppercase">
                // CVTHÈQUE INTELLIGENCE
              </span>
              <h1 className="text-4xl sm:text-6xl font-black font-display tracking-tight uppercase leading-[1.05]">
                CAREERS,<br />
                READ<br />
                <span className="text-[#0047FF]">DIFFERENTLY.</span>
              </h1>
            </div>
          </div>

          <div className="pt-12 space-y-4 font-mono text-xs text-[var(--muted-foreground)]">
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]">
              <span className="text-[#0047FF] font-bold">[01]</span>
              <span className="text-[var(--foreground)] font-medium uppercase">CV INTELLIGENCE & SEMANTIC PARSING</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]">
              <span className="text-[#0047FF] font-bold">[02]</span>
              <span className="text-[var(--foreground)] font-medium uppercase">PRECISION TALENT MATCHING</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]">
              <span className="text-[#0047FF] font-bold">[03]</span>
              <span className="text-[var(--foreground)] font-medium uppercase">AI ORAL INTERVIEWS & EVALUATION</span>
            </div>
          </div>

          <div className="pt-8 text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
            CVTHÈQUE INTELLIGENCE SYSTEM • AWWWARDS EDITORIAL EDITION
          </div>
        </div>

        {/* Right Auth Form Panel */}
        <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-center bg-[var(--surface)]">
          <div className="max-w-md w-full mx-auto space-y-8">
            {currentPath === '/register' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-bold text-[#0047FF] uppercase tracking-widest">// NEW PROFILE</div>
                  <h2 className="text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase">
                    BUILD YOUR<br />CAREER IDENTITY.
                  </h2>
                </div>

                <RegisterForm onSuccess={() => navigate('/dashboard/candidate')} />

                <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--muted-foreground)]">ALREADY REGISTERED?</span>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-[#0047FF] hover:underline font-bold uppercase cursor-pointer flex items-center space-x-1"
                  >
                    <span>SIGN IN</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : currentPath === '/forgot-password' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-bold text-[#0047FF] uppercase tracking-widest">// ACCOUNT RECOVERY</div>
                  <h2 className="text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase">
                    RESET ACCESS.
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)] font-sans">
                    Enter your email address and we'll send instructions to recover your account.
                  </p>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const email = (form.elements.namedItem('reset-email') as HTMLInputElement).value;
                    if (email) {
                      await resetPassword(email);
                      toast.success('Recovery instructions sent if account exists.');
                      navigate('/login');
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase">EMAIL ADDRESS</label>
                    <input
                      name="reset-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      className="w-full px-4 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-[#0047FF]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 px-6 rounded-xl bg-[#0047FF] hover:bg-blue-600 text-[var(--foreground)] text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#0047FF]/20"
                  >
                    SEND RESET LINK →
                  </button>
                </form>

                <div className="pt-4 border-t border-[var(--border)]">
                  <button
                    onClick={() => navigate('/login')}
                    className="text-xs font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center space-x-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>BACK TO LOGIN</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-bold text-[#0047FF] uppercase tracking-widest">// RETURNING USER</div>
                  <h2 className="text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase">
                    WELCOME BACK.
                  </h2>
                </div>

                <LoginForm
                  onSuccess={() => {
                    toast.success('Successfully authenticated.');
                  }}
                  onForgotPasswordClick={() => navigate('/forgot-password')}
                />

                <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--muted-foreground)]">NEW TO CVTHÈQUE?</span>
                  <button
                    onClick={() => navigate('/register')}
                    className="text-[#0047FF] hover:underline font-bold uppercase cursor-pointer flex items-center space-x-1"
                  >
                    <span>CREATE ACCOUNT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
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
