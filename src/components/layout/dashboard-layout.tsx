import React, { useState, useEffect } from 'react';
import { AppSidebar } from './app-sidebar';
import { AppNavbar } from './app-navbar';
import { useAuth } from '../../providers/auth-provider';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Monitor, Command, FileText, User, Settings, LogOut, Heart, HelpCircle, ShieldAlert } from 'lucide-react';

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
  id
}) => {
  const { profile, logout, switchSimulatedUser } = useAuth();
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
    { name: 'Tableau de bord', desc: 'Accéder au tableau de bord principal', action: () => onNavigate(`/dashboard/${profile.role.toLowerCase()}`), icon: Command },
    { name: 'Mon Profil', desc: 'Gérer les informations personnelles', action: () => onNavigate('/profile'), icon: User },
    { name: 'Paramètres', desc: 'Configurer les préférences système', action: () => onNavigate('/settings'), icon: Settings },
    { name: 'Se déconnecter', desc: 'Fermer la session active', action: () => logout(), icon: LogOut }
  ];

  const roleCommands = profile.role === 'RECRUITER' ? [
    { name: 'Créer une offre d\'emploi', desc: 'Poster un nouveau descriptif de poste', action: () => onNavigate(`/dashboard/recruiter`), icon: Command },
    { name: 'Voir les CVs importés', desc: 'Consulter l\'analyse d\'adéquation de vos CVs', action: () => onNavigate(`/dashboard/recruiter`), icon: FileText }
  ] : profile.role === 'CANDIDATE' ? [
    { name: 'Déposer mon CV', desc: 'Uploader et faire analyser un nouveau CV', action: () => onNavigate(`/dashboard/candidate`), icon: FileText }
  ] : [
    { name: 'Gestion des Utilisateurs', desc: 'CRUD complet, rôles et abonnements', action: () => onNavigate(`/dashboard/admin`), icon: User }
  ];

  const simulationCommands = [
    { name: 'Simuler Rôle Candidat', desc: 'Incarner Alexandre Bernard', action: () => switchSimulatedUser('candidate-123'), icon: Monitor },
    { name: 'Simuler Rôle Recruteur', desc: 'Incarner Hélène Martin', action: () => switchSimulatedUser('recruiter-123'), icon: Monitor },
    { name: 'Simuler Rôle Administrateur', desc: 'Incarner Thomas Dubois', action: () => switchSimulatedUser('admin-123'), icon: Monitor }
  ];

  const allCommands = [...baseCommands, ...roleCommands, ...simulationCommands];
  const filteredCommands = allCommands.filter((cmd) =>
    cmd.name.toLowerCase().includes(paletteSearch.toLowerCase()) ||
    cmd.desc.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  return (
    <div id={id} className="min-h-screen bg-slate-950 flex relative overflow-hidden transition-colors duration-300">
      {/* Glow blobs background design */}
      <div className="absolute inset-0 glow-backdrop-purple pointer-events-none" />
      <div className="absolute inset-0 glow-backdrop-pink pointer-events-none" />

      {/* Sidebar navigation (with mobile support) */}
      <AppSidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpenOnMobile={isMobileSidebarOpen}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
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
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPath}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="max-w-7xl mx-auto h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Minimalist Premium Footer */}
          <footer className="border-t border-slate-900/60 bg-slate-950/20 backdrop-blur-sm py-5 px-6 sm:px-8 text-center sm:text-left">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-[11px] text-slate-500 font-medium">
                <span>© {new Date().getFullYear()} CVthèque IA, Inc.</span>
                <span className="hidden sm:inline text-slate-700">•</span>
                <span className="flex items-center gap-0.5">
                  Fait avec <Heart className="w-3 h-3 text-indigo-500 fill-indigo-500" /> pour le recrutement sémantique.
                </span>
              </div>

              <div className="flex items-center justify-center gap-6 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                <button
                  onClick={() => onNavigate('/settings')}
                  className="hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  Conditions
                </button>
                <button
                  onClick={() => onNavigate('/settings')}
                  className="hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  Confidentialité
                </button>
                <button
                  onClick={() => onNavigate('/profile')}
                  className="flex items-center gap-1 hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3 text-slate-600" />
                  <span>Aide</span>
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Sonner Toaster component with Dark styling */}
      <Toaster position="bottom-right" theme="dark" />

      {/* Collapsible Command Palette Palette (Ctrl+K Modal) */}
      <AnimatePresence>
        {isPaletteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaletteOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
            >
              <motion.div
                initial={{ scale: 0.95, y: -20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: -20, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-800 p-4 shadow-2xl relative"
              >
                {/* Search input inside palette */}
                <div className="flex items-center space-x-3.5 border-b border-slate-900 pb-3 mb-3">
                  <Search className="w-5 h-5 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                    placeholder="Tapez une commande ou simulez un rôle..."
                    className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500 font-sans"
                    autoFocus
                  />
                  <div className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono shrink-0">
                    ESC
                  </div>
                </div>

                {/* Commands listing list */}
                <div className="max-h-72 overflow-y-auto space-y-1">
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
                          className="w-full text-left flex items-center space-x-3.5 px-3 py-3 rounded-xl hover:bg-indigo-600/10 hover:text-indigo-400 cursor-pointer group transition-colors text-slate-300"
                        >
                          <div className="p-2 bg-slate-900 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 rounded-lg border border-slate-800 transition-colors">
                            <Icon className="w-4.5 h-4.5 text-slate-400 group-hover:text-indigo-400" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold">{cmd.name}</div>
                            <div className="text-[10px] text-slate-500">{cmd.desc}</div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-500">
                      Aucune commande ne correspond à votre recherche.
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
