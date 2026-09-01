import React from 'react';
import { AlertCircle, FileText, Sparkles, UserCheck, ShieldAlert } from 'lucide-react';
import type { RecruiterMatchingResponse } from '../../types/matching';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { RecruiterCandidateMatchCard } from './candidate-match-card';

interface MatchingResultsProps {
  loading: boolean;
  error: string | null;
  result: RecruiterMatchingResponse | null;
  hasSelection: boolean;
  onSelectCandidate?: (cvId: string) => void;
}

export const MatchingResults: React.FC<MatchingResultsProps> = ({
  loading,
  error,
  result,
  hasSelection,
  onSelectCandidate,
}) => {
  if (!hasSelection) return null;

  return (
    <section aria-labelledby="matching-results-title" aria-busy={loading} className="space-y-6 text-left">
      {/* Section Header */}
      <div className="space-y-2 border-b border-[var(--border)] pb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
            // MATCH INTELLIGENCE
          </span>
          <span className="h-px w-6 bg-white/10" />
          <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
            RÉSULTATS D'ADÉQUATION
          </span>
        </div>

        <h2 id="matching-results-title" className="text-2xl sm:text-4xl font-extrabold font-display text-white tracking-tight uppercase leading-[1.1]">
          QUELS PROFILS POUR<br />
          <span className="text-[var(--muted-foreground)]">CETTE POSITION ?</span>
        </h2>
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)] font-sans max-w-2xl">
          Analyse algorithmique sémantique croisant compétences requises, années d'expérience, langues et contraintes de poste.
        </p>
      </div>

      {loading ? (
        <div role="status" aria-label="Analyse des profils disponibles" className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-[var(--border)] text-xs font-mono text-[var(--foreground-secondary)]">
            <Sparkles className="w-4 h-4 text-[#0047FF] animate-spin" />
            <span>CALCUL DES SCORES D'ADÉQUATION SÉMANTIQUE EN COURS...</span>
          </div>
          <LoadingSkeleton variant="list" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-xs font-mono text-rose-300 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block uppercase">// ERREUR D'ANALYSE</span>
            <p className="font-sans text-[var(--foreground-secondary)]">{error}</p>
          </div>
        </div>
      ) : !result ? (
        <div className="p-12 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] text-center space-y-4">
          <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
            // MATCHING EN ATTENTE
          </span>
          <h3 className="text-xl font-extrabold font-display text-white">
            MATCHING NON DÉCLENCHÉ
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] font-sans max-w-md mx-auto">
            Cliquez sur "Rechercher les meilleurs profils" ci-dessus pour lancer l'évaluation des candidats.
          </p>
        </div>
      ) : result.topCandidates.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] text-center space-y-4">
          <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
            // AUCUN RÉSULTAT
          </span>
          <h3 className="text-xl font-extrabold font-display text-white">
            AUCUN CANDIDAT DISPONIBLE
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] font-sans max-w-md mx-auto">
            Aucun profil dans votre vivier actuel ne correspond aux critères stricts de cette offre.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Telemetry Strip for matching execution */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)]">
            <SummaryBandItem
              index="[01]"
              label="PROFILS ÉVALUÉS"
              value={result.evaluatedCandidates}
            />
            <SummaryBandItem
              index="[02]"
              label="PROFILS ÉLIGIBLES"
              value={result.eligibleCandidates}
              accent="emerald"
            />
            <SummaryBandItem
              index="[03]"
              label="NON ÉLIGIBLES"
              value={result.invalidCandidates}
              accent="rose"
            />
            <SummaryBandItem
              index="[04]"
              label="TOP CANDIDATS"
              value={result.topCandidates.length}
              accent="blue"
            />
          </div>

          {result.summary && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs sm:text-sm text-[var(--foreground-secondary)] font-sans leading-relaxed">
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase font-bold tracking-wider block mb-1">
                // SYNTHÈSE GLOBALE DU PIPELINE
              </span>
              {result.summary}
            </div>
          )}

          {/* Ranked list of candidates */}
          <ol className="space-y-5" aria-label="Classement des candidats">
            {result.topCandidates.map((candidate) => (
              <li key={candidate.cvId}>
                <RecruiterCandidateMatchCard
                  candidate={candidate}
                  onSelect={onSelectCandidate}
                />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};

const SummaryBandItem: React.FC<{
  index: string;
  label: string;
  value: number;
  accent?: 'blue' | 'emerald' | 'rose';
}> = ({ index, label, value, accent }) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
        <span className="text-[#0047FF] font-bold">{index}</span>
        <span className="truncate">{label}</span>
      </div>
      <span
        className={`text-2xl sm:text-3xl font-extrabold font-display tracking-tight block ${
          accent === 'emerald'
            ? 'text-emerald-400'
            : accent === 'rose'
            ? 'text-rose-400'
            : accent === 'blue'
            ? 'text-white'
            : 'text-white'
        }`}
      >
        {value}
      </span>
    </div>
  );
};
