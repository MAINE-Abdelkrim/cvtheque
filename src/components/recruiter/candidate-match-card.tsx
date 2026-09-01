import React from 'react';
import { Check, X, AlertTriangle, ArrowRight, FileText } from 'lucide-react';
import type { RecruiterCandidateMatch } from '../../types/matching';
import { MatchCriterion } from './match-criterion';

interface RecruiterCandidateMatchCardProps {
  candidate: RecruiterCandidateMatch;
  onSelect?: (cvId: string) => void;
}

export const RecruiterCandidateMatchCard: React.FC<RecruiterCandidateMatchCardProps> = ({
  candidate,
  onSelect,
}) => {
  const formattedRank = candidate.rank < 10 ? `[0${candidate.rank}]` : `[${candidate.rank}]`;
  const isHighMatch = candidate.score >= 80;

  return (
    <article
      className="p-6 sm:p-7 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all space-y-6 relative overflow-hidden group text-left"
    >
      {/* Top Identity & Dominant Score Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-[var(--border)] pb-6">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-[#0047FF]">
              {formattedRank}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                candidate.eligible
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {candidate.eligible ? 'ÉLIGIBLE' : 'NON ÉLIGIBLE'}
            </span>
            <span className="text-xs font-mono text-[var(--muted-foreground)]">
              {candidate.matchLevel}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold font-display text-[var(--foreground)] tracking-tight">
            {candidate.candidateName ?? 'PROFIL CANDIDAT'}
          </h3>

          {candidate.summary && (
            <p className="text-xs sm:text-sm text-[var(--foreground-secondary)] font-sans leading-relaxed max-w-2xl">
              {candidate.summary}
            </p>
          )}
        </div>

        {/* Visually Dominant Syne Score */}
        <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start gap-1 shrink-0 bg-white/[0.02] sm:bg-transparent p-4 sm:p-0 rounded-2xl border border-[var(--border)] sm:border-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl sm:text-5xl font-extrabold font-display text-[var(--foreground)] tracking-tighter">
              {candidate.score}
            </span>
            <span className="text-xs font-mono text-[var(--muted-foreground)]">/ 100</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#0047FF] font-bold block">
            MATCH SCORE
          </span>

          {/* Thin score bar indicator */}
          <div className="hidden sm:block w-28 h-1 bg-[var(--surface-secondary)] rounded-full overflow-hidden mt-2 border border-[var(--border)]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isHighMatch ? 'bg-[#0047FF]' : 'bg-slate-500'
              }`}
              style={{ width: `${candidate.score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Skills Matrix Section */}
      <section aria-labelledby={`skills-${candidate.cvId}`} className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 id={`skills-${candidate.cvId}`} className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            // COMPÉTENCES REQUISES
          </h4>
          {candidate.requiredSkills.display && (
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
              {candidate.requiredSkills.display}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Matched skills */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2">
            <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider block">
              CORRESPONDANTES ({candidate.requiredSkills.matched.length})
            </span>
            {candidate.requiredSkills.matched.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {candidate.requiredSkills.matched.map(skill => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  >
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-[var(--muted-foreground)]">Aucune compétence correspondante</p>
            )}
          </div>

          {/* Missing skills */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2">
            <span className="text-[10px] font-mono text-rose-400 uppercase font-bold tracking-wider block">
              MANQUANTES ({candidate.requiredSkills.missing.length})
            </span>
            {candidate.requiredSkills.missing.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {candidate.requiredSkills.missing.map(skill => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20"
                  >
                    <X className="w-3 h-3 text-rose-400" />
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-[var(--muted-foreground)]">Aucune compétence manquante</p>
            )}
          </div>
        </div>
      </section>

      {/* Criteria Breakdown Grid */}
      <section aria-label="Évaluation des critères" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <MatchCriterion
          label="Expérience"
          status={candidate.experience.status}
          display={candidate.experience.display}
          detail={candidate.experience.candidateYears !== null ? `${candidate.experience.candidateYears} an${candidate.experience.candidateYears > 1 ? 's' : ''}${candidate.experience.requiredYears !== null ? ` · ${candidate.experience.requiredYears} an${candidate.experience.requiredYears > 1 ? 's' : ''} requis` : ''}` : undefined}
        />
        <MatchCriterion
          label="Formation"
          status={candidate.education.status}
          display={candidate.education.display}
        />
        <MatchCriterion
          label="Langues"
          status={candidate.languages.status}
          display={candidate.languages.display}
        />
        <MatchCriterion
          label="Lieu & Modalité"
          status={candidate.locationAndWorkMode.status}
          display={candidate.locationAndWorkMode.display}
        />
        <MatchCriterion
          label="Type de Contrat"
          status={candidate.contract.status}
          display={candidate.contract.display}
        />
      </section>

      {/* Strengths & Gaps Signals */}
      {(candidate.strengths.length > 0 || candidate.gaps.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--border)] pt-5">
          {candidate.strengths.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 block">
                // SIGNAUX FORTS ({candidate.strengths.length})
              </span>
              <ul className="space-y-1.5">
                {candidate.strengths.map((item, idx) => (
                  <li key={idx} className="text-xs font-sans text-[var(--foreground-secondary)] flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.gaps.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-400 block">
                // POINTS DE VIGILANCE ({candidate.gaps.length})
              </span>
              <ul className="space-y-1.5">
                {candidate.gaps.map((item, idx) => (
                  <li key={idx} className="text-xs font-sans text-[var(--muted-foreground)] flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Mandatory Ineligibility Alert */}
      {!candidate.eligible && (
        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-xs text-rose-300 space-y-2">
          <div className="flex items-center gap-2 font-mono font-bold uppercase">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Critères obligatoires non satisfaits</span>
          </div>
          {candidate.eligibilityMessage && (
            <p className="font-sans text-[var(--foreground-secondary)]">{candidate.eligibilityMessage}</p>
          )}
          {candidate.mandatoryFailures.length > 0 && (
            <ul className="list-disc pl-5 font-mono text-[11px] text-rose-400/90 space-y-1">
              {candidate.mandatoryFailures.map((fail, idx) => (
                <li key={idx}>{fail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action Footer */}
      {onSelect && (
        <div className="border-t border-[var(--border)] pt-4 flex justify-end">
          <button
            onClick={() => onSelect(candidate.cvId)}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] transition-all flex items-center gap-2 cursor-pointer group-hover:border-[#0047FF]/40"
          >
            <span>VOIR LE DOSSIER</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#0047FF]" />
          </button>
        </div>
      )}
    </article>
  );
};
