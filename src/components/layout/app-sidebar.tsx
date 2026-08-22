import React, { useState } from 'react';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, History, LayoutDashboard, LogOut, MessageSquareText, User, X } from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';
import { Button } from '../ui/button';
import { Logo } from '../ui/logo';

interface AppSidebarProps { currentPath: string; onNavigate: (path: string) => void; isOpenOnMobile?: boolean; onCloseMobileSidebar?: () => void; id?: string; }

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentPath, onNavigate, isOpenOnMobile = false, onCloseMobileSidebar, id }) => {
  const { profile, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  if (!profile) return null;
  const role = profile.role;
  const navItems = [
    { label: 'Tableau de bord', path: `/dashboard/${role.toLowerCase()}`, icon: LayoutDashboard, roles: ['ADMIN', 'RECRUITER', 'CANDIDATE'] },
    { label: 'AI Interview', path: '/dashboard/candidate/interview', icon: MessageSquareText, roles: ['CANDIDATE'] },
    { label: 'Mes entretiens', path: '/dashboard/candidate/interviews', icon: History, roles: ['CANDIDATE'] },
    { label: 'Créer une offre', path: '/dashboard/recruiter/create-job', icon: BriefcaseBusiness, roles: ['RECRUITER'] },
    { label: 'Mon profil', path: '/profile', icon: User, roles: ['ADMIN', 'RECRUITER', 'CANDIDATE'] },
  ].filter(item => item.roles.includes(role));

  const navigate = (path: string) => { onNavigate(path); onCloseMobileSidebar?.(); };
  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase();

  return <>
    {isOpenOnMobile && <button type="button" aria-label="Fermer la navigation" onClick={onCloseMobileSidebar} className="fixed inset-0 z-40 bg-[var(--overlay)] md:hidden" />}
    <aside id={id} aria-label="Navigation principale" className={`app-shell-sidebar z-50 flex h-screen flex-col border-r transition-[width,transform] duration-200 ${isCollapsed ? 'md:w-20' : 'md:w-64'} ${isOpenOnMobile ? 'fixed inset-y-0 left-0 w-64 translate-x-0 shadow-[var(--shadow-overlay)]' : 'hidden md:flex'}`}>
      <div className="flex h-17 items-center justify-between border-b border-[var(--border)] px-4">
        <button type="button" onClick={() => navigate(`/dashboard/${role.toLowerCase()}`)} aria-label="Accueil" className="flex min-w-0 items-center"><Logo variant={isCollapsed && !isOpenOnMobile ? 'icon' : 'horizontal'} height={34} /></button>
        {isOpenOnMobile && <Button variant="ghost" size="sm" onClick={onCloseMobileSidebar} aria-label="Fermer"><X className="h-4 w-4" /></Button>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = currentPath === item.path;
          return <button key={item.path} type="button" onClick={() => navigate(item.path)} title={isCollapsed ? item.label : undefined} aria-current={active ? 'page' : undefined} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)] ${active ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]'}`}><Icon className="h-[18px] w-[18px] shrink-0" />{(!isCollapsed || isOpenOnMobile) && <span className="truncate">{item.label}</span>}</button>;
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <div className={`mb-2 flex items-center gap-3 rounded-lg px-2 py-2 ${isCollapsed && !isOpenOnMobile ? 'justify-center' : ''}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--primary)]">{profile.photoURL ? <img src={profile.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials}</span>{(!isCollapsed || isOpenOnMobile) && <div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--foreground)]">{profile.firstName} {profile.lastName}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{profile.role === 'RECRUITER' ? 'Recruteur' : profile.role === 'ADMIN' ? 'Administrateur' : 'Candidat'}</p></div>}</div>
        <Button variant="ghost" className={`w-full ${isCollapsed && !isOpenOnMobile ? 'px-0' : 'justify-start'}`} onClick={async () => { await logout(); onNavigate('/login'); }} aria-label="Se déconnecter"><LogOut className="h-4 w-4" />{(!isCollapsed || isOpenOnMobile) && 'Se déconnecter'}</Button>
      </div>
      <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} aria-label={isCollapsed ? 'Déployer la navigation' : 'Réduire la navigation'} className="absolute bottom-20 -right-3 hidden h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)] md:flex">{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
    </aside>
  </>;
};
