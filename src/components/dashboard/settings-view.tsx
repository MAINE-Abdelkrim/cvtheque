import React from 'react';
import { useAuth } from '../../providers/auth-provider';
import { isFirebaseConfigured } from '../../lib/firebase/client';
import { Settings, Server, Terminal, ShieldAlert, KeyRound, Monitor, CheckCircle2, Database, Cpu, Activity } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-12 pb-24 text-left select-none max-w-6xl mx-auto font-sans">
      {/* ================= SETTINGS HERO ================= */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--border)] pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
              // SYSTEM CONFIGURATION
            </span>
            <span className="h-px w-12 bg-white/10" />
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
              ENVIRONMENT CONTROL
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold font-display text-white tracking-tight uppercase leading-[1.05]">
            CONTROL THE<br />
            <span className="text-[var(--muted-foreground)]">ENVIRONMENT & SERVICES.</span>
          </h1>
        </div>

        {/* Status Pill */}
        <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center gap-3 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-white uppercase">
            {isFirebaseConfigured ? 'PRODUCTION CLOUD ACTIVE' : 'LOCAL SIMULATION ACTIVE'}
          </span>
        </div>
      </div>

      {/* ================= SETTINGS SECTIONS GRID ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Section 01 & 02: Connection & Environment */}
        <div className="p-8 sm:p-10 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-6">
          <div className="space-y-1 border-b border-[var(--border)] pb-4">
            <span className="text-[10px] font-mono font-bold text-[#0047FF] uppercase tracking-widest">// 01 / 02 — CONNECTION & ENVIRONMENT</span>
            <h3 className="text-2xl font-bold font-display text-white uppercase">SYSTEM DIAGNOSTICS</h3>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">DATABASE MODE</span>
              <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
                isFirebaseConfigured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {isFirebaseConfigured ? 'PRODUCTION CLOUD' : 'LOCAL SIMULATOR'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">BACKEND API SERVER</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                OPERATIONAL
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">APPLET ID</span>
              <span className="text-[var(--muted-foreground)] text-[10px]">885ca4d7-3d61-418d-8342-18313cbf565f</span>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">RUNTIME ENVIRONMENT</span>
              <span className="text-[#0047FF] font-bold">Cloud Run (AI Studio)</span>
            </div>
          </div>
        </div>

        {/* Section 03 & 04: System Information & Guidance */}
        <div className="p-8 sm:p-10 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-6">
          <div className="space-y-1 border-b border-[var(--border)] pb-4">
            <span className="text-[10px] font-mono font-bold text-[#0047FF] uppercase tracking-widest">// 03 / 04 — GUIDANCE & CONFIGURATION</span>
            <h3 className="text-2xl font-bold font-display text-white uppercase">CLOUD CONFIGURATION</h3>
          </div>

          <p className="text-xs text-[var(--foreground-secondary)] leading-relaxed font-sans">
            To connect the application to your remote Cloud instances (Firebase Auth & Firestore), configure the following environment variables in your deployment control panel:
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
              <span className="text-[#0047FF] font-bold text-[11px]">NEXT_PUBLIC_FIREBASE_API_KEY</span>
              <p className="text-[10px] text-[var(--muted-foreground)] font-sans">Web API key for your Firebase project.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
              <span className="text-[#0047FF] font-bold text-[11px]">NEXT_PUBLIC_FIREBASE_PROJECT_ID</span>
              <p className="text-[10px] text-[var(--muted-foreground)] font-sans">Unique project identifier in Firebase.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
              <span className="text-[#0047FF] font-bold text-[11px]">FIREBASE_PRIVATE_KEY</span>
              <p className="text-[10px] text-[var(--muted-foreground)] font-sans">Service account administration secret key.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

