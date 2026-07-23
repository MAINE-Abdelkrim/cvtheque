import React, { useState } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { Logo } from '../ui/logo';
import {
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  Briefcase,
  Users,
  X
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
  id
}) => {
  const { profile, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!profile) return null;

  const role = profile.role;

  // Navigation schema based on User Role
  const navItems = [
    {
      label: 'Tableau de bord',
      path: `/dashboard/${role.toLowerCase()}`,
      icon: LayoutDashboard,
      roles: ['ADMIN', 'RECRUITER', 'CANDIDATE']
    },
    {
      label: 'Gestion Utilisateurs',
      path: '/dashboard/admin', // aligned with routing in App.tsx
      icon: Users,
      roles: ['ADMIN']
    },
    {
      label: 'Mon Profil',
      path: '/profile',
      icon: User,
      roles: ['ADMIN', 'RECRUITER', 'CANDIDATE']
    },
    {
      label: 'Configuration',
      path: '/settings',
      icon: Settings,
      roles: ['ADMIN', 'RECRUITER', 'CANDIDATE']
    }
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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Main Sidebar Wrapper */}
      <aside
        id={id}
        className={`relative h-screen border-r border-slate-900 bg-slate-950 flex flex-col justify-between transition-all duration-300 select-none app-sidebar-bg z-50 ${
          isCollapsed ? 'md:w-20' : 'md:w-66'
        } ${
          isOpenOnMobile
            ? 'fixed inset-y-0 left-0 w-66 shadow-2xl flex animate-in slide-in-from-left duration-250'
            : 'hidden md:flex'
        }`}
      >
        {/* Collapse Toggle Handle (Only Desktop) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3.5 top-14 w-7 h-7 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-full items-center justify-center text-slate-400 hover:text-white cursor-pointer z-40 transition-colors sidebar-toggle-btn"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Top Brand Logo */}
        <div className="p-5 border-b border-slate-900/40">
          <div className="flex items-center justify-between">
            <div
              onClick={() => handleLinkClick(`/dashboard/${role.toLowerCase()}`)}
              className="flex items-center cursor-pointer group"
            >
              <Logo
                variant={(isCollapsed && !isOpenOnMobile) ? 'icon' : 'horizontal'}
                height={40}
                className="transform hover:scale-105 active:scale-95 transition-all duration-300"
                animated
              />
            </div>

            {/* Mobile Close Button */}
            {isOpenOnMobile && (
              <button
                onClick={onCloseMobileSidebar}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer md:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Center Navigation Links */}
        <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {(!isCollapsed || isOpenOnMobile) && (
            <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 px-3 mb-3">
              Navigation
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path || (item.path.startsWith('/dashboard/') && currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => handleLinkClick(item.path)}
                className={`w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-xl transition-all text-xs font-medium cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`} />
                {(!isCollapsed || isOpenOnMobile) && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Bottom Profile Section */}
        <div className="p-4 border-t border-slate-900/80 flex flex-col space-y-2">
          <div className="flex items-center space-x-3 px-2 py-1.5 rounded-xl bg-slate-900/25">
            <div className="h-8 w-8 shrink-0 rounded-lg overflow-hidden bg-slate-800 border border-slate-800">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt="Avatar"
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
            {(!isCollapsed || isOpenOnMobile) && (
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-white truncate font-display">
                  {profile.firstName} {profile.lastName}
                </div>
                <div className="text-[9px] text-slate-500 truncate font-mono uppercase tracking-wider">
                  {profile.role}
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
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all text-xs font-medium cursor-pointer border border-transparent"
          >
            <LogOut className="w-4.5 h-4.5 shrink-0 text-slate-500 group-hover:text-rose-400" />
            {(!isCollapsed || isOpenOnMobile) && <span>Se déconnecter</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
