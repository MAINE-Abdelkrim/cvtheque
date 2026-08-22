import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { useAuth } from '../../providers/auth-provider';
import { AppNavbar } from './app-navbar';
import { AppSidebar } from './app-sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  id?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, currentPath, onNavigate, id }) => {
  const { profile } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', localStorage.getItem('theme') !== 'dark');
  }, []);

  if (!profile) return <>{children}</>;

  return (
    <div id={id} className="app-shell relative flex min-h-screen overflow-hidden">
      <AppSidebar currentPath={currentPath} onNavigate={onNavigate} isOpenOnMobile={isMobileSidebarOpen} onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)} />
      <div className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <AppNavbar title={title} currentPath={currentPath} onNavigate={onNavigate} onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <AnimatePresence mode="wait">
            <motion.div key={currentPath} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="mx-auto h-full max-w-7xl">
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster position="bottom-right" theme={localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'} />
    </div>
  );
};
