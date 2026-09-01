import React from 'react';
import { useAuth } from '../../providers/auth-provider';
import { ShieldAlert, ArrowRight, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface UnauthorizedProps {
  onNavigate: (path: string) => void;
}

export const Unauthorized: React.FC<UnauthorizedProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const safeDashboard = profile ? `/dashboard/${profile.role.toLowerCase()}` : '/login';

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 text-left select-none max-w-xl mx-auto font-sans">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full p-10 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-8 shadow-2xl relative overflow-hidden"
      >
        {/* Top Header */}
        <div className="space-y-3 border-b border-[var(--border)] pb-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-rose-400">
              // ACCESS CONTROL
            </span>
            <span className="h-px w-12 bg-white/10" />
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
              SECURITY RESTRICTION
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-white tracking-tight uppercase">
            ACCESS<br />
            <span className="text-rose-400">RESTRICTED.</span>
          </h1>
        </div>

        <p className="text-xs text-[var(--foreground-secondary)] leading-relaxed font-sans">
          Your current account role does not have authorization to access this workspace or protected route. Please return to your designated dashboard.
        </p>

        {/* Profile info if available */}
        {profile && (
          <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2 font-mono text-xs">
            <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">// CONNECTED IDENTITY</div>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold">{profile.firstName} {profile.lastName}</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#0047FF]/10 text-[#0047FF] border border-[#0047FF]/20 uppercase">
                {profile.role}
              </span>
            </div>
            <div className="text-[var(--muted-foreground)] text-[11px]">{profile.email}</div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => onNavigate(safeDashboard)}
            className="w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-xl bg-[#0047FF] hover:bg-blue-600 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#0047FF]/20"
          >
            <span>RETURN TO DASHBOARD</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('/profile')}
            className="w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--foreground-secondary)] text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
          >
            <Home className="w-4 h-4 text-[var(--muted-foreground)]" />
            <span>VIEW USER PROFILE</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
