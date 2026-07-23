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
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center select-none">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-md w-full glass-card border border-rose-500/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Glow decoration */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Shield Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/5 mb-6">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>

        {/* Texts */}
        <h2 className="text-xl font-black font-display text-white tracking-tight mb-2">
          Accès Non Autorisé
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          Votre rôle actuel ne vous donne pas l'autorisation d'accéder à cette page protégée. Pour des raisons de sécurité, l'accès à ce tableau de bord est restreint.
        </p>

        {/* Separator */}
        <div className="border-t border-slate-900 my-4" />

        {/* User Identity info for debugging */}
        {profile && (
          <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3 mb-6 text-left">
            <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">
              Profil Connecté
            </div>
            <div className="flex items-center space-x-2.5">
              <div className="text-xs font-bold text-white">
                {profile.firstName} {profile.lastName}
              </div>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md">
                {profile.role}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{profile.email}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2.5">
          <button
            onClick={() => onNavigate(safeDashboard)}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-600/15"
          >
            <span>Retourner au tableau de bord</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('/profile')}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-all cursor-pointer"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>Consulter mon profil</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
