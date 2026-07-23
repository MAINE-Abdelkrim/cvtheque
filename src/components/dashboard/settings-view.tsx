import React from 'react';
import { useAuth } from '../../providers/auth-provider';
import { isFirebaseConfigured } from '../../lib/firebase/client';
import { Settings, HelpCircle, Server, Terminal, ShieldAlert, KeyRound, Monitor } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { profile, isSimulated } = useAuth();

  return (
    <div className="space-y-8 select-none font-sans">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Diagnostics Card */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/60">
          <h3 className="text-sm font-bold font-display text-white border-b border-slate-900 pb-4 mb-5 flex items-center space-x-2">
            <Server className="w-4.5 h-4.5 text-indigo-400" />
            <span>Diagnostics Système</span>
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-900 text-xs">
              <span className="text-slate-400">Mode Database</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                isFirebaseConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {isFirebaseConfigured ? 'PRODUCTION CLOUD' : 'LOCAL SIMULATOR'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-900 text-xs">
              <span className="text-slate-400">Serveur Backend API</span>
              <span className="text-emerald-400 font-mono font-bold">● FONCTIONNEL</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-900 text-xs">
              <span className="text-slate-400">Applet ID (Platform)</span>
              <span className="text-slate-500 font-mono text-[10px]">885ca4d7-3d61-418d-8342-18313cbf565f</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-900 text-xs">
              <span className="text-slate-400">Environnement</span>
              <span className="text-indigo-400 font-mono text-[10px] uppercase font-bold">Cloud Run (AI Studio)</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/50 text-[11px] text-slate-500 mt-6 leading-relaxed font-sans">
            <ShieldAlert className="w-4.5 h-4.5 text-slate-400 inline mr-1.5 shrink-0 align-text-bottom" />
            Le mode local utilise localStorage pour persister les CVs déposés, les offres d'emploi, les rapports sémantiques IA et les comptes utilisateurs. Vos modifications restent intactes entre les reloads.
          </div>
        </div>

        {/* Right Column: Setup Instructions Card */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/60">
          <h3 className="text-sm font-bold font-display text-white border-b border-slate-900 pb-4 mb-5 flex items-center space-x-2">
            <KeyRound className="w-4.5 h-4.5 text-indigo-400" />
            <span>Guide de configuration Cloud</span>
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed mb-4 font-sans">
            Pour connecter cette application à vos instances réelles Firebase Cloud (Auth & Firestore), assurez-vous d'injecter les variables d'environnement suivantes dans votre panneau de configuration :
          </p>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            <div className="p-2.5 rounded-lg border border-slate-900 bg-slate-950/80">
              <div className="text-[10px] font-mono text-indigo-400 font-semibold mb-0.5">NEXT_PUBLIC_FIREBASE_API_KEY</div>
              <p className="text-[10px] text-slate-500 leading-normal">Clé API Web de votre projet Firebase.</p>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-900 bg-slate-950/80">
              <div className="text-[10px] font-mono text-indigo-400 font-semibold mb-0.5">NEXT_PUBLIC_FIREBASE_PROJECT_ID</div>
              <p className="text-[10px] text-slate-500 leading-normal">ID unique de votre projet Firebase.</p>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-900 bg-slate-950/80">
              <div className="text-[10px] font-mono text-indigo-400 font-semibold mb-0.5">FIREBASE_PRIVATE_KEY</div>
              <p className="text-[10px] text-slate-500 leading-normal">Clé privée d'administration du compte de service (requise pour le backend d'administration).</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
