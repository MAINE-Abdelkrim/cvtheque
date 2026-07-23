import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { Logo } from '../ui/logo';
import { GooeyNav, GooeyNavItem } from '../ui/gooey-nav';
import {
  Search,
  Bell,
  Monitor,
  ChevronDown,
  Check,
  ShieldCheck,
  UserCheck,
  ShieldAlert,
  Sun,
  Moon,
  Menu,
  User,
  Settings,
  LogOut,
  X
} from 'lucide-react';

interface AppNavbarProps {
  title: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenCommandPalette?: () => void;
  onToggleMobileSidebar?: () => void;
  id?: string;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  title,
  currentPath,
  onNavigate,
  onOpenCommandPalette,
  onToggleMobileSidebar,
  id
}) => {
  const { profile, isSimulated, switchSimulatedUser, logout } = useAuth();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return !document.documentElement.classList.contains('light');
    }
    return true;
  });

  // Mock Notifications
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Bienvenue sur votre espace personnel CVthèque IA !', time: 'À l\'instant', read: false },
    { id: 2, text: 'Analyse IA : Score de 92% calculé pour CV_Developpeur.pdf', time: 'Il y a 2h', read: false },
    { id: 3, text: 'Nouveau message : Votre entretien technique a été validé.', time: 'Hier', read: true }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleTheme = () => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  if (!profile) return null;

  const mockProfiles = [
    { uid: 'candidate-123', name: 'Alexandre (Candidat)', role: 'CANDIDATE', icon: UserCheck },
    { uid: 'recruiter-123', name: 'Hélène (Recruteur)', role: 'RECRUITER', icon: ShieldCheck },
    { uid: 'admin-123', name: 'Thomas (Admin)', role: 'ADMIN', icon: ShieldAlert }
  ];

  // Generate French Breadcrumbs
  const getBreadcrumbs = () => {
    const segments = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [];

    if (segments[0] === 'dashboard') {
      breadcrumbs.push({ label: 'Tableau de bord', path: `/dashboard/${profile.role.toLowerCase()}` });
      if (segments[1]) {
        const roleFr: Record<string, string> = {
          admin: 'Administrateur',
          recruiter: 'Recruteur',
          candidate: 'Candidat'
        };
        breadcrumbs.push({ label: roleFr[segments[1]] || segments[1], path: currentPath });
      }
    } else if (segments[0] === 'profile') {
      breadcrumbs.push({ label: 'Mon Profil', path: '/profile' });
    } else if (segments[0] === 'settings') {
      breadcrumbs.push({ label: 'Configuration', path: '/settings' });
    } else if (segments[0] === 'unauthorized') {
      breadcrumbs.push({ label: 'Accès non autorisé', path: '/unauthorized' });
    } else {
      breadcrumbs.push({ label: title, path: currentPath });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const role = profile.role;
  const navItems: GooeyNavItem[] = [
    {
      label: 'Tableau de bord',
      path: `/dashboard/${role.toLowerCase()}`
    },
    ...(role === 'ADMIN' ? [{
      label: 'Utilisateurs',
      path: '/dashboard/admin'
    }] : []),
    {
      label: 'Profil',
      path: '/profile'
    },
    {
      label: 'Configuration',
      path: '/settings'
    }
  ];

  return (
    <header
      id={id}
      className="glass-navbar h-18 w-full px-6 flex items-center justify-between sticky top-0 z-30 select-none"
    >
      {/* Left section: Hamburger & Breadcrumbs */}
      <div className="flex items-center space-x-3.5">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Logo inside Navbar */}
        <div
          onClick={() => onNavigate(`/dashboard/${profile.role.toLowerCase()}`)}
          className="flex items-center cursor-pointer transform hover:scale-105 active:scale-95 transition-all duration-300"
          title="Retour au Tableau de bord"
        >
          <Logo
            variant="horizontal"
            height={38}
            className="md:hidden block"
            animated
          />
          <Logo
            variant="icon"
            height={34}
            className="hidden md:block mr-2"
            animated
          />
        </div>

        <div className="flex flex-col">
          {/* Title */}
          <h2 className="text-sm font-extrabold font-display text-white tracking-tight leading-tight mt-0.5 md:block hidden">
            {title}
          </h2>
        </div>

        {isSimulated && (
          <span className="hidden sm:inline-block text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20 shadow-sm">
            Simulation
          </span>
        )}
      </div>

      {/* Centered Gooey Navigation for desktop screens */}
      <div className="hidden lg:flex items-center justify-center flex-1 mx-6">
        <GooeyNav items={navItems} onNavigate={onNavigate} currentPath={currentPath} />
      </div>

      {/* Middle/Right Controls */}
      <div className="flex items-center space-x-3.5">
        {/* Ctrl+K Search Bar Trigger */}
        <div
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center space-x-3.5 px-3 py-1.5 w-52 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 text-slate-500 hover:text-slate-400 transition-all cursor-pointer text-xs"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left text-[11px]">Rechercher...</span>
          <kbd className="text-[9px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-slate-500">
            ⌘K
          </kbd>
        </div>

        {/* Real-time Role Switcher Dropdown (Simulation Helper) */}
        {isSimulated && (
          <div className="relative">
            <button
              onClick={() => {
                setShowRoleSwitcher(!showRoleSwitcher);
                setShowUserMenu(false);
                setShowNotifications(false);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-400 text-xs font-semibold font-mono transition-all cursor-pointer select-none"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="max-w-[70px] sm:max-w-none truncate">{profile.role}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showRoleSwitcher && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowRoleSwitcher(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-950 border border-slate-800 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-3 duration-200 text-left">
                  <div className="px-3.5 py-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest border-b border-slate-900 mb-1">
                    Simuler Profil
                  </div>
                  {mockProfiles.map((p) => {
                    const Icon = p.icon;
                    const isActive = profile.uid === p.uid;
                    return (
                      <button
                        key={p.uid}
                        onClick={async () => {
                          await switchSimulatedUser(p.uid);
                          setShowRoleSwitcher(false);
                          // Trigger corresponding navigation
                          onNavigate(`/dashboard/${p.role.toLowerCase()}`);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-indigo-600/10 text-indigo-400'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                          <span>{p.name}</span>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Theme Switch */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications Icon with active dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
              setShowRoleSwitcher(false);
            }}
            className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-950 border border-slate-800 p-2 shadow-2xl z-50 text-left animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-900">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Notifications ({unreadCount})
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                    >
                      Tout lire
                    </button>
                  )}
                </div>

                <div className="py-1.5 max-h-72 overflow-y-auto space-y-1">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id)}
                      className={`p-3 rounded-xl transition-all cursor-pointer text-xs ${
                        n.read ? 'opacity-60 hover:bg-slate-900/40' : 'bg-slate-900/35 hover:bg-slate-900/60 border border-indigo-500/5'
                      }`}
                    >
                      <p className="text-white text-[11px] leading-relaxed">{n.text}</p>
                      <span className="text-[9px] text-slate-500 font-mono block mt-1.5">{n.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Menu Avatar Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
              setShowRoleSwitcher(false);
            }}
            className="flex items-center space-x-1.5 p-1 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800/80 transition-all cursor-pointer"
          >
            <div className="h-7 w-7 rounded-lg overflow-hidden border border-slate-800 shrink-0 bg-slate-950">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={`${profile.firstName} ${profile.lastName}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-indigo-600/10 text-indigo-400 text-xs font-bold">
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </div>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 md:block hidden" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-950 border border-slate-800 p-2 shadow-2xl z-50 text-left animate-in fade-in slide-in-from-top-3 duration-200">
                {/* User Summary Block */}
                <div className="px-3 py-3 border-b border-slate-900/80 mb-1">
                  <div className="font-bold text-xs text-white truncate">
                    {profile.firstName} {profile.lastName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{profile.email}</div>
                  
                  {/* Role and Subscription Badges */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[8px] font-mono font-bold tracking-wider px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-md">
                      {profile.role}
                    </span>
                    <span className="text-[8px] font-mono font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-md">
                      {profile.subscription}
                    </span>
                  </div>
                </div>

                {/* Dropdown Options */}
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      onNavigate('/profile');
                      setShowUserMenu(false);
                    }}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                      currentPath === '/profile' ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span>Mon Profil</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('/settings');
                      setShowUserMenu(false);
                    }}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                      currentPath === '/settings' ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                    }`}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Configuration</span>
                  </button>

                  <div className="border-t border-slate-900 my-1" />

                  <button
                    onClick={async () => {
                      setShowUserMenu(false);
                      await logout();
                      onNavigate('/login');
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer transition-all"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
