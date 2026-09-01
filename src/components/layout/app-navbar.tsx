import React, { useState } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { Logo } from '../ui/logo';
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
  id,
}) => {
  const { profile, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return !document.documentElement.classList.contains('light');
    }
    return true;
  });

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      text: 'Session active initialisée avec succès.',
      time: "À l'instant",
      read: false,
    },
    {
      id: 2,
      text: 'CV Intelligence : Rapport d’adéquation mis à jour.',
      time: 'Il y a 2h',
      read: false,
    },
    {
      id: 3,
      text: 'Entretien oral IA : Évaluation enregistrée.',
      time: 'Hier',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  if (!profile) return null;


  return (
    <header
      id={id}
      className="h-16 w-full px-6 sm:px-12 flex items-center justify-between sticky top-0 z-30 select-none bg-[var(--surface)] border-b border-[var(--border)]"
    >
      {/* Left section: Hamburger & Breadcrumb */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Mobile Brand Logo */}
        <div
          onClick={() => onNavigate(`/dashboard/${profile.role.toLowerCase()}`)}
          className="md:hidden block cursor-pointer"
        >
          <Logo variant="icon" height={26} />
        </div>

        {/* Editorial Breadcrumb */}
        <div className="hidden md:flex items-center space-x-2 text-xs font-mono">
          <span className="text-[var(--muted-foreground)] uppercase tracking-wider">
            // {profile.role}
          </span>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-[var(--foreground)] font-bold uppercase tracking-wide">
            {title}
          </span>
        </div>

        {/* System Status Indicator */}
        <div className="hidden lg:flex items-center space-x-2 pl-4 border-l border-[var(--border)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
            SYSTEM READY
          </span>
        </div>

      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center space-x-3 px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-all cursor-pointer text-xs group"
        >
          <Search className="w-3.5 h-3.5 group-hover:text-[var(--primary)] transition-colors" />
          <span className="font-sans text-[11px] font-medium">Rechercher...</span>
          <kbd className="text-[9px] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)] font-mono text-[var(--muted-foreground)]">
            ⌘K
          </kbd>
        </button>



        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          title={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="p-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--primary)] rounded-full animate-ping" />
            )}
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--primary)] rounded-full" />
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] p-3 shadow-[var(--shadow-overlay)] z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)] mb-2">
                  <span className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    // NOTIFICATIONS ({unreadCount})
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-mono text-[var(--primary)] hover:underline font-bold uppercase cursor-pointer"
                    >
                      Tout lire
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id)}
                      className={`p-3 rounded-xl transition-all cursor-pointer text-xs ${
                        n.read
                          ? 'opacity-50 hover:bg-[var(--surface-secondary)]'
                          : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border)]'
                      }`}
                    >
                      <p className="text-[var(--foreground)] text-xs leading-relaxed font-sans font-medium">
                        {n.text}
                      </p>
                      <span className="text-[9px] text-[var(--muted-foreground)] font-mono block mt-1.5 uppercase">
                        {n.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-[var(--surface-secondary)] border border-transparent hover:border-[var(--border)] transition-all cursor-pointer"
          >
            <div className="h-8 w-8 rounded-lg overflow-hidden border border-[var(--border)] shrink-0 bg-[var(--surface)]">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={`${profile.firstName} ${profile.lastName}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary)] text-xs font-bold font-mono">
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </div>
              )}
            </div>
            <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] md:block hidden" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] p-3 shadow-[var(--shadow-overlay)] z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                {/* User Summary Block */}
                <div className="px-3 py-2.5 border-b border-[var(--border)] mb-2">
                  <div className="font-bold text-xs text-[var(--foreground)] truncate font-sans">
                    {profile.firstName} {profile.lastName}
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)] font-mono truncate mt-0.5">
                    {profile.email}
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5">
                    <span className="text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 bg-[var(--primary-subtle)] text-[var(--primary)] rounded-md uppercase">
                      {profile.role}
                    </span>
                    <span className="text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md uppercase">
                      {profile.subscription}
                    </span>
                  </div>
                </div>

                {/* Dropdown Options */}
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      onNavigate('/profile');
                      setShowUserMenu(false);
                    }}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-mono uppercase cursor-pointer transition-colors ${
                      currentPath === '/profile'
                        ? 'bg-[var(--primary-subtle)] text-[var(--primary)] font-bold'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span>MON PROFIL</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('/settings');
                      setShowUserMenu(false);
                    }}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-mono uppercase cursor-pointer transition-colors ${
                      currentPath === '/settings'
                        ? 'bg-[var(--primary-subtle)] text-[var(--primary)] font-bold'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                    <span>CONFIGURATION</span>
                  </button>

                  <div className="border-t border-[var(--border)] my-1.5" />

                  <button
                    onClick={async () => {
                      setShowUserMenu(false);
                      await logout();
                      onNavigate('/login');
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-mono font-bold uppercase text-[var(--danger)] hover:bg-rose-500/10 cursor-pointer transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>SE DÉCONNECTER</span>
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
