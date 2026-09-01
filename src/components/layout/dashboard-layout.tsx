import React, { useState, useEffect } from 'react';
import { AppSidebar } from './app-sidebar';
import { AppNavbar } from './app-navbar';
import { useAuth } from '../../providers/auth-provider';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Monitor, Command, FileText, User, Settings, LogOut, HelpCircle, ArrowRight } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  id?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  currentPath,
  onNavigate,
  id,
}) => {
  const { profile, logout } = useAuth();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Synchronize Theme class on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    }
  }, []);

  // Handle Cmd+K / Ctrl+K to open/close command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!profile) return <>{children}</>;

  // Palette commands
  const baseCommands = [
    {
      name: 'Tableau de bord',
      desc: 'Accéder au tableau de bord principal',
      action: () => onNavigate(`/dashboard/${profile.role.toLowerCase()}`),
      icon: Command,
    },
    {
      name: 'Mon Profil',
      desc: 'Gérer les informations personnelles',
      action: () => onNavigate('/profile'),
      icon: User,
    },
    {
      name: 'Configuration',
      desc: 'Préférences système et diagnostics',
      action: () => onNavigate('/settings'),
      icon: Settings,
    },
    {
      name: 'Se déconnecter',
      desc: 'Fermer la session active',
      action: () => logout(),
      icon: LogOut,
    },
  ];

  const roleCommands =
    profile.role === 'RECRUITER'
      ? [
          {
            name: "Créer une offre d'emploi",
            desc: 'Génération IA et publication de poste',
            action: () => onNavigate(`/dashboard/recruiter/create-job`),
            icon: Command,
          },
          {
            name: 'Vivier & Candidats',
            desc: "Consulter l'analyse d'adéquation des CVs",
            action: () => onNavigate(`/dashboard/recruiter`),
            icon: FileText,
          },
        ]
      : profile.role === 'CANDIDATE'
      ? [
          {
            name: 'Déposer mon CV',
            desc: 'Extraction sémantique et analyse IA',
            action: () => onNavigate(`/dashboard/candidate/cv`),
            icon: FileText,
          },
          {
            name: 'Trouver des Offres',
            desc: 'Explorer les opportunités matchées',
            action: () => onNavigate(`/dashboard/candidate/jobs`),
            icon: Search,
          },
        ]
      : [
          {
            name: 'Gestion des Utilisateurs',
            desc: 'CRUD complet, rôles et abonnements',
            action: () => onNavigate(`/dashboard/admin`),
            icon: User,
          },
        ];


  const allCommands = [...baseCommands, ...roleCommands];
  const filteredCommands = allCommands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(paletteSearch.toLowerCase()) ||
      cmd.desc.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  return (
    <div
      id={id}
      className="min-h-screen bg-[var(--background)] flex relative overflow-hidden transition-colors duration-200"
    >
      {/* Subtle Architectural Grid Background */}
      <div className="absolute inset-0 editorial-bg-grid opacity-60 pointer-events-none" />

      {/* Sidebar navigation */}
      <AppSidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpenOnMobile={isMobileSidebarOpen}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Top bar navbar */}
        <AppNavbar
          title={title}
          currentPath={currentPath}
          onNavigate={onNavigate}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Content & Footer Wrapper */}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          <main className="flex-1 px-4 sm:px-8 lg:px-12 py-8 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPath}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-7xl mx-auto h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Minimalist Editorial Footer */}
          <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-5 px-6 sm:px-12 text-center sm:text-left">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-[var(--muted-foreground)]">
                <span className="font-mono font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                  CVTHÈQUE INTELLIGENCE
                </span>
                <span className="hidden sm:inline text-[var(--border-strong)]">/</span>
                <span>Plateforme d'intelligence de carrière & recrutement sémantique</span>
              </div>

              <div className="flex items-center justify-center gap-6 text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest">
                <button
                  onClick={() => onNavigate('/settings')}
                  className="hover:text-[var(--primary)] transition-colors cursor-pointer"
                >
                  Conditions
                </button>
                <button
                  onClick={() => onNavigate('/settings')}
                  className="hover:text-[var(--primary)] transition-colors cursor-pointer"
                >
                  Confidentialité
                </button>
                <button
                  onClick={() => onNavigate('/profile')}
                  className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Aide</span>
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Sonner Toaster */}
      <Toaster position="bottom-right" theme="dark" />

      {/* Editorial Command Palette (Ctrl+K) */}
      <AnimatePresence>
        {isPaletteOpen && (
          <div
            onClick={() => setIsPaletteOpen(false)}
            className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-md z-50 flex items-start justify-center pt-[12vh] p-4 animate-in fade-in duration-150"
          >
            <motion.div
              initial={{ scale: 0.96, y: -10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: -10, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-[var(--shadow-overlay)] overflow-hidden"
            >
              {/* Search input inside palette */}
              <div className="flex items-center space-x-3.5 px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-secondary)]">
                <Search className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
                <input
                  type="text"
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  placeholder="Tapez une commande, une page ou simulez un profil..."
                  className="w-full bg-transparent text-sm text-[var(--foreground)] focus:outline-none placeholder:text-[var(--muted-foreground)] font-sans"
                  autoFocus
                />
                <kbd className="text-[10px] bg-[var(--surface)] border border-[var(--border-strong)] px-2 py-0.5 rounded font-mono text-[var(--muted-foreground)] shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Commands list */}
              <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                {filteredCommands.length > 0 ? (
                  filteredCommands.map((cmd, idx) => {
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          cmd.action();
                          setIsPaletteOpen(false);
                          setPaletteSearch('');
                        }}
                        className="w-full text-left flex items-center justify-between px-3.5 py-3 rounded-lg hover:bg-[var(--surface-secondary)] hover:text-[var(--primary)] cursor-pointer group transition-colors text-[var(--foreground)]"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="p-2 bg-[var(--surface-secondary)] group-hover:bg-[var(--primary-subtle)] group-hover:text-[var(--primary)] rounded-lg border border-[var(--border)] transition-colors shrink-0">
                            <Icon className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate font-sans">
                              {cmd.name}
                            </div>
                            <div className="text-[11px] text-[var(--muted-foreground)] truncate font-sans">
                              {cmd.desc}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 group-hover:text-[var(--primary)] transition-all shrink-0 ml-2" />
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-[var(--muted-foreground)] font-mono">
                    // AUCUNE COMMANDE CORRESPONDANTE
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
