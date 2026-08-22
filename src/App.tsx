import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthProvider, useAuth } from './providers/auth-provider';
import { LoginForm } from './components/auth/login-form';
import { RegisterForm } from './components/auth/register-form';
import { AdminView } from './components/dashboard/admin-view';
import { CandidateView } from './components/dashboard/candidate-view';
import { InterviewView } from './components/candidate/interview-view';
import { InterviewHistoryView } from './components/candidate/interview-history-view';
import { CreateJobPage } from './components/dashboard/create-job-page';
import { NotFound } from './components/dashboard/not-found';
import { ProfileView } from './components/dashboard/profile-view';
import { RecruiterView } from './components/dashboard/recruiter-view';
import { Unauthorized } from './components/dashboard/unauthorized';
import { DashboardLayout } from './components/layout/dashboard-layout';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { FormField, Input } from './components/ui/form-controls';
import { Logo } from './components/ui/logo';
import { getAuthErrorMessage } from './lib/auth/ux';

function AppContent() {
  const { profile, loading, resetPassword } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  const navigate = (next: string) => { window.history.pushState(null, '', next); setPath(next); };
  useEffect(() => { const handler = () => setPath(window.location.pathname); window.addEventListener('popstate', handler); return () => window.removeEventListener('popstate', handler); }, []);
  useEffect(() => {
    if (loading) return;
    const authRoute = ['/login', '/register', '/forgot-password'].includes(path);
    if (!profile && !authRoute) navigate('/login');
    if (profile) {
      const home = `/dashboard/${profile.role.toLowerCase()}`;
      if (authRoute || path === '/') navigate(home);
      else if (path === '/create-job') navigate('/dashboard/recruiter/create-job');
      else if (path.startsWith('/dashboard/admin') && profile.role !== 'ADMIN') navigate('/unauthorized');
      else if (path.startsWith('/dashboard/recruiter') && profile.role !== 'RECRUITER') navigate('/unauthorized');
      else if (path.startsWith('/dashboard/candidate') && profile.role !== 'CANDIDATE') navigate('/unauthorized');
    }
  }, [loading, profile, path]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[var(--background)]" aria-busy="true"><div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]"><Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />Chargement de votre session…</div></main>;
  if (!profile) {
    if (path === '/forgot-password') return <AuthPage title="Réinitialiser le mot de passe" description="Recevez un lien de réinitialisation sur votre adresse e-mail."><ResetPasswordForm onSubmit={resetPassword} onBack={() => navigate('/login')} /></AuthPage>;
    if (path === '/register') return <AuthPage title="Créer un compte" description="Créez votre espace candidat ou recruteur."><RegisterForm /><AuthSwitch text="Vous avez déjà un compte ?" action="Se connecter" onClick={() => navigate('/login')} /></AuthPage>;
    return <AuthPage title="Bienvenue" description="Accédez à votre espace de recrutement."><LoginForm onForgotPasswordClick={() => navigate('/forgot-password')} /><AuthSwitch text="Vous n’avez pas encore de compte ?" action="Créer un compte" onClick={() => navigate('/register')} /></AuthPage>;
  }

  const titles: Record<string,string> = { '/dashboard/admin':'Administration', '/dashboard/recruiter':'Espace recruteur', '/dashboard/recruiter/create-job':'Créer une offre', '/dashboard/candidate':'Espace candidat', '/dashboard/candidate/interview':'AI Interview', '/dashboard/candidate/interviews':'Mes entretiens', '/profile':'Mon profil', '/unauthorized':'Accès non autorisé' };
  const view = path === '/dashboard/admin' ? <AdminView /> : path === '/dashboard/recruiter' ? <RecruiterView onNavigate={navigate} /> : path === '/dashboard/recruiter/create-job' ? <CreateJobPage onNavigate={navigate} /> : path === '/dashboard/candidate' ? <CandidateView /> : path === '/dashboard/candidate/interview' ? <InterviewView onNavigate={navigate} /> : path === '/dashboard/candidate/interviews' ? <InterviewHistoryView onNavigate={navigate} /> : path === '/profile' ? <ProfileView /> : path === '/unauthorized' ? <Unauthorized onNavigate={navigate} /> : <NotFound onNavigate={navigate} />;
  return <DashboardLayout title={titles[path] ?? 'CVthèque'} currentPath={path} onNavigate={navigate}>{view}</DashboardLayout>;
}

const AuthPage: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10"><div className="w-full max-w-md"><div className="mb-7 text-center"><div className="mb-5 flex justify-center"><Logo variant="full" height={38} /></div><h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">{description}</p></div><Card><CardContent className="p-6 sm:p-7">{children}</CardContent></Card></div></main>;
const AuthSwitch: React.FC<{ text: string; action: string; onClick: () => void }> = ({ text, action, onClick }) => <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">{text} <button type="button" onClick={onClick} className="font-medium text-[var(--primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">{action}</button></p>;

const ResetPasswordForm: React.FC<{ onSubmit: (email: string) => Promise<void>; onBack: () => void }> = ({ onSubmit, onBack }) => {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(undefined); try { await onSubmit(email); toast.success('Si cette adresse correspond à un compte, un e-mail a été envoyé.'); onBack(); } catch (cause) { setError(getAuthErrorMessage(cause, 'reset')); } finally { setBusy(false); } };
  return <form onSubmit={submit} className="space-y-5" aria-busy={busy}>{error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}<FormField label="Adresse e-mail" htmlFor="reset-email" required><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></FormField><Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Envoyer le lien</Button><Button type="button" variant="ghost" className="w-full" onClick={onBack}>Retour à la connexion</Button></form>;
};

export default function App() { return <AuthProvider><AppContent /></AuthProvider>; }
