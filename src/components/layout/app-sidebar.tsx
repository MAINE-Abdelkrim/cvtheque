import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { Logo } from '../ui/logo';
import {
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Users,
  Mic,
  FileUp,
  Target,
  X,
  Compass
} from 'lucide-react';

interface AppSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpenOnMobile?: boolean;
  onCloseMobileSidebar?: () => void;
  id?: string;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentPath,
  onNavigate,
  isOpenOnMobile = false,
  onCloseMobileSidebar,
  id,
}) => {
  const { profile, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!profile) return null;

  const role = profile.role;

  // Navigation schema based on User Role with editorial index numbering
  const navItems = [
    {
      label: 'TABLEAU DE BORD',
      index: '01',
      path: `/dashboard/${role.toLowerCase()}`,
      icon: LayoutDashboard,
      roles: ['ADMIN', 'RECRUITER', 'CANDIDATE'],
    },
    {
      label: 'CV INTELLIGENCE',
      index: '02',
      path: '/dashboard/candidate/cv',
      icon: FileUp,
      roles: ['ADMIN', 'CANDIDATE'],
    },
    {
      label: 'OPPORTUNITÉS',
      index: '03',
      path: '/dashboard/candidate/jobs',
      icon: Target,
      roles: ['ADMIN', 'CANDIDATE'],
    },
    {
      label: 'CRÉER UNE OFFRE (IA)',
      index: '03',
      path: '/dashboard/recruiter/create-job',
      icon: Briefcase,
      roles: ['ADMIN', 'RECRUITER'],
    },
    {
      label: 'ENTRETIEN ORAL (IA)',
      index: '04',
      path: '/dashboard/candidate/interview',
      icon: Mic,
      roles: ['ADMIN', 'CANDIDATE'],
    },
    {
      label: 'GESTION UTILISATEURS',
      index: '05',
      path: '/dashboard/admin',
      icon: Users,
      roles: ['ADMIN'],
    },
  ].filter((item) => item.roles.includes(role));

  const accountItems = [
    {
      label: 'MON PROFIL',
      path: '/profile',
      icon: User,
      roles: ['CANDIDATE', 'RECRUITER', 'ADMIN'],
    },
    {
      label: 'CONFIGURATION',
      path: '/settings',
      icon: Settings,
      roles: ['ADMIN'],
    },
  ].filter(item => item.roles.includes(role));

  const handleLinkClick = (path: string) => {
    onNavigate(path);
    if (onCloseMobileSidebar) {
      onCloseMobileSidebar();
    }
  };

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isOpenOnMobile && (
        <div
          onClick={onCloseMobileSidebar}
          className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-150"
        />
      )}

      {/* Main Sidebar Wrapper */}
      <aside
        id={id}
        className={`relative h-screen border-r border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between transition-all duration-200 select-none z-50 ${
          isCollapsed ? 'md:w-20' : 'md:w-64'
        } ${
          isOpenOnMobile
            ? 'fixed inset-y-0 left-0 w-64 shadow-2xl flex animate-in slide-in-from-left duration-200'
            : 'hidden md:flex'
        }`}
      >
        {/* Collapse Toggle Handle (Only Desktop) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-12 w-6 h-6 bg-[var(--surface)] border border-[var(--border-strong)] rounded-full items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] cursor-pointer z-40 transition-colors shadow-sm"
          title={isCollapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Top Brand Logo */}
        <div className="p-5 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div
              onClick={() => handleLinkClick(`/dashboard/${role.toLowerCase()}`)}
              className="flex items-center cursor-pointer group"
            >
              <Logo
                variant={isCollapsed && !isOpenOnMobile ? 'icon' : 'horizontal'}
                height={30}
              />
            </div>

            {/* Mobile Close Button */}
            {isOpenOnMobile && (
              <button
                onClick={onCloseMobileSidebar}
                className="p-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer md:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Center Navigation Links */}
        <div className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
          {/* Workspace Group */}
          <div className="space-y-1">
            {(!isCollapsed || isOpenOnMobile) && (
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] px-3 mb-3">
                // WORKSPACE
              </div>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentPath === item.path ||
                (item.path.startsWith('/dashboard/') && currentPath.startsWith(item.path));
              return (
                <button
                  key={`${item.path}-${item.label}`}
                  onClick={() => handleLinkClick(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-xs font-mono cursor-pointer group relative ${
                    isActive
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary)] font-bold'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                  }`}
                  title={isCollapsed && !isOpenOnMobile ? item.label : undefined}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]'
                      }`}
                    />
                    {(!isCollapsed || isOpenOnMobile) && (
                      <span className="truncate tracking-wide text-[11px]">{item.label}</span>
                    )}
                  </div>
                  {(!isCollapsed || isOpenOnMobile) && item.index && (
                    <span className={`text-[9px] font-mono opacity-60 ${isActive ? 'text-[var(--primary)] font-bold' : ''}`}>
                      {item.index}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[var(--primary)] rounded-r-full md:block hidden" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Account Group */}
          <div className="space-y-1 pt-2">
            {(!isCollapsed || isOpenOnMobile) && (
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] px-3 mb-3">
                // ACCOUNT
              </div>
            )}
            {accountItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <button
                  key={`${item.path}-${item.label}`}
                  onClick={() => handleLinkClick(item.path)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all text-xs font-mono cursor-pointer group relative ${
                    isActive
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary)] font-bold'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                  }`}
                  title={isCollapsed && !isOpenOnMobile ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]'
                    }`}
                  />
                  {(!isCollapsed || isOpenOnMobile) && (
                    <span className="truncate tracking-wide text-[11px]">{item.label}</span>
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[var(--primary)] rounded-r-full md:block hidden" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Profile & Status Section */}
        <div className="p-3 border-t border-[var(--border)] flex flex-col space-y-2 bg-[var(--surface-secondary)]">
          <div className="flex items-center space-x-2.5 px-2 py-1.5 rounded-xl">
            <div className="h-8 w-8 shrink-0 rounded-lg overflow-hidden bg-[var(--surface)] border border-[var(--border)]">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt="Avatar"
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
            {(!isCollapsed || isOpenOnMobile) && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[var(--foreground)] truncate font-sans">
                  {profile.firstName} {profile.lastName}
                </div>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] text-[var(--muted-foreground)] font-mono uppercase tracking-wider">
                    {profile.role} • ACTIVE
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={async () => {
              if (onCloseMobileSidebar) onCloseMobileSidebar();
              await logout();
              onNavigate('/login');
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--danger)] hover:bg-[var(--surface)] transition-all text-xs font-mono uppercase tracking-wider cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(!isCollapsed || isOpenOnMobile) && <span>SE DÉCONNECTER</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
