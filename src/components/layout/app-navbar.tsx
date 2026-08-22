import React, { useState } from 'react';
import { ChevronDown, LogOut, Menu, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';
import { Button } from '../ui/button';

interface AppNavbarProps { title: string; currentPath: string; onNavigate: (path: string) => void; onToggleMobileSidebar?: () => void; id?: string; }

export const AppNavbar: React.FC<AppNavbarProps> = ({ title, currentPath, onNavigate, onToggleMobileSidebar, id }) => {
  const { profile, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  if (!profile) return null;

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    document.documentElement.classList.toggle('light', !nextDark);
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    setIsDarkMode(nextDark);
  };

  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase();
  return <header id={id} className="app-shell-header sticky top-0 z-30 flex h-17 items-center justify-between border-b px-4 backdrop-blur-sm sm:px-6">
    <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="sm" onClick={onToggleMobileSidebar} aria-label="Ouvrir la navigation" className="md:hidden"><Menu className="h-5 w-5" /></Button><h1 className="truncate text-xl font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</h1></div>
    <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}>{isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><div className="relative"><button type="button" onClick={() => setShowUserMenu(!showUserMenu)} aria-expanded={showUserMenu} aria-haspopup="menu" className="flex min-h-10 items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-[var(--surface-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"><span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--primary)]">{profile.photoURL ? <img src={profile.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials}</span><span className="hidden max-w-32 truncate text-sm font-medium text-[var(--foreground)] sm:block">{profile.firstName}</span><ChevronDown className="hidden h-3.5 w-3.5 text-[var(--muted-foreground)] sm:block" /></button>{showUserMenu && <><button type="button" aria-label="Fermer le menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowUserMenu(false)} /><div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--foreground)] shadow-[var(--shadow-overlay)]"><div className="border-b border-[var(--border)] px-3 py-2.5"><p className="truncate text-sm font-medium">{profile.firstName} {profile.lastName}</p><p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{profile.email}</p></div><Button variant={currentPath === '/profile' ? 'secondary' : 'ghost'} className="mt-1 w-full justify-start" onClick={() => { onNavigate('/profile'); setShowUserMenu(false); }} role="menuitem"><User className="h-4 w-4" /> Mon profil</Button><Button variant="ghost" className="mt-1 w-full justify-start text-[var(--danger)]" onClick={async () => { setShowUserMenu(false); await logout(); onNavigate('/login'); }} role="menuitem"><LogOut className="h-4 w-4" /> Se déconnecter</Button></div></>}</div></div>
  </header>;
};
