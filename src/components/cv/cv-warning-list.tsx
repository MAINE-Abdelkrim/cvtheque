import React from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import type { CVParserWarning } from '../../types/cv-parser';
import { motion } from 'motion/react';

interface CVWarningListProps {
  warnings: CVParserWarning[];
  className?: string;
}

export const CVWarningList: React.FC<CVWarningListProps> = ({ warnings, className = '' }) => {
  if (!warnings || warnings.length === 0) {
    return (
      <div className={`p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400 font-sans flex items-center gap-3 ${className}`}>
        <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-emerald-300 block">
            Structure Optimale
          </span>
          <p className="text-[var(--muted-foreground)] text-[11px] mt-0.5">
            Aucune anomalie critique détectée lors de l'extraction sémantique.
          </p>
        </div>
      </div>
    );
  }

  const getCategoryLabel = (code: string) => {
    const upper = (code || '').toUpperCase();
    if (upper.includes('IMPACT') || upper.includes('METRIC') || upper.includes('NUMBER')) return 'IMPACT';
    if (upper.includes('KEYWORD') || upper.includes('SKILL')) return 'MOTS-CLÉS';
    if (upper.includes('STRUCT') || upper.includes('FORMAT') || upper.includes('LAYOUT')) return 'STRUCTURE';
    if (upper.includes('DATE') || upper.includes('TIME') || upper.includes('CHRONO')) return 'CHRONOLOGIE';
    if (upper.includes('CONTACT') || upper.includes('EMAIL') || upper.includes('PHONE')) return 'COORDONNÉES';
    return 'OPTIMISATION';
  };

  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Signaux d'optimisation IA">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          // SIGNAUX D'OPTIMISATION ({warnings.length})
        </span>
        <span className="text-[10px] font-mono text-[var(--muted-foreground)]">ANALYSE COGNITIVE</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {warnings.map((warning, index) => {
          const category = getCategoryLabel(warning.code);
          const indexFormatted = `[0${index + 1}]`;

          return (
            <motion.div
              key={`${warning.code}-${index}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-amber-500/20 hover:border-amber-500/40 transition-colors flex items-start gap-3.5 group"
            >
              <span className="font-mono text-xs font-bold text-amber-400/80 shrink-0 mt-0.5">
                {indexFormatted}
              </span>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono font-bold text-amber-300">
                    {category}
                  </span>
                  {warning.code && (
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                      ID: {warning.code}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[var(--foreground-secondary)] leading-relaxed font-sans font-normal">
                  {warning.message}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
