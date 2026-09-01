import React from 'react';
import { Search, Sparkles, Building2, MapPin, Briefcase, GraduationCap, Globe, Clock, ArrowRight, Loader2 } from 'lucide-react';
import type { JobPosting } from '../../types';

const workMode: Record<string, string> = { onsite: 'Sur site', hybrid: 'Hybride', remote: 'À distance' };

interface SelectedJobPanelProps {
  job: JobPosting | null;
  matching: boolean;
  onMatch: () => void;
  index?: number;
  applicationCount?: number;
}

export const SelectedJobPanel: React.FC<SelectedJobPanelProps> = ({
  job,
  matching,
  onMatch,
  index = 1,
  applicationCount,
}) => {
  if (!job) {
    return (
      <div className="p-8 sm:p-12 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] text-center space-y-4 text-left sm:text-center">
        <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
          // POSITION CIBLÉE
        </span>
        <h3 className="text-xl sm:text-2xl font-extrabold font-display text-white">
          SÉLECTIONNEZ UNE OFFRE
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] font-sans max-w-md mx-auto">
          Choisissez une fiche de poste dans le pipeline pour inspecter ses exigences et lancer l'algorithme d'adéquation sémantique.
        </p>
      </div>
    );
  }

  const formattedIndex = index < 10 ? `[0${index}]` : `[${index}]`;
  const education = job.required_education?.minimum_level;
  const statusLabel = job.status === 'OPEN' ? 'ACTIVE' : job.status;

  return (
    <div
      aria-busy={matching}
      className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-6 text-left relative overflow-hidden"
    >
      {/* Editorial Header */}
      <div className="space-y-3 border-b border-white/5 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-[#0047FF]">
              POSITION / {formattedIndex}
            </span>
            <span className="h-px w-6 bg-white/10" />
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                job.status === 'OPEN'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/5 text-[var(--muted-foreground)] border border-[var(--border)]'
              }`}
            >
              {statusLabel}
            </span>
          </div>

          {applicationCount !== undefined && (
            <span className="text-xs font-mono text-[var(--muted-foreground)]">
              {applicationCount} CANDIDATURE{applicationCount > 1 ? 'S' : ''}
            </span>
          )}
        </div>

        <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight uppercase">
          {job.title}
        </h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5 text-[var(--foreground-secondary)]">
            <Building2 className="w-3.5 h-3.5 text-[#0047FF]" />
            {job.company}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5 text-[var(--foreground-secondary)]">
            <MapPin className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            {job.location}
          </span>
          {job.contract_type && (
            <>
              <span>·</span>
              <span className="text-[var(--foreground-secondary)]">{job.contract_type}</span>
            </>
          )}
          {job.work_mode && (
            <>
              <span>·</span>
              <span className="text-[var(--foreground-secondary)]">{workMode[job.work_mode] ?? job.work_mode}</span>
            </>
          )}
        </div>
      </div>

      {/* Description Snippet if available */}
      {job.description && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] font-bold block">
            // DESCRIPTIF DU POSTE
          </span>
          <p className="text-xs text-[var(--foreground-secondary)] font-sans leading-relaxed line-clamp-3">
            {job.description}
          </p>
        </div>
      )}

      {/* Key Requirements Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-6">
        {/* Required Skills */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] font-bold block">
            COMPÉTENCES REQUISES
          </span>
          {job.required_skills && job.required_skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {job.required_skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 text-slate-200 border border-[var(--border)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono text-[var(--muted-foreground)]">Non spécifiées</p>
          )}
        </div>

        {/* Preferred Skills */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] font-bold block">
            COMPÉTENCES SOUHAITÉES
          </span>
          {job.preferred_skills && job.preferred_skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {job.preferred_skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 text-[var(--muted-foreground)] border border-white/5"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono text-[var(--muted-foreground)]">Aucune exigence supplémentaire</p>
          )}
        </div>

        {/* Minimum Experience */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] font-bold block">
            EXPÉRIENCE MINIMALE
          </span>
          <p className="text-sm font-bold font-display text-white">
            {job.minimum_experience_years !== undefined && job.minimum_experience_years !== null
              ? `${job.minimum_experience_years} an${job.minimum_experience_years > 1 ? 's' : ''}`
              : 'Non spécifiée'}
          </p>
        </div>

        {/* Education */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] font-bold block">
            NIVEAU D'ÉTUDES
          </span>
          <p className="text-sm font-bold font-display text-white">
            {education || 'Non spécifié'}
          </p>
        </div>

        {/* Languages */}
        {job.required_languages && job.required_languages.length > 0 && (
          <div className="space-y-2 sm:col-span-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] font-bold block">
              EXIGENCES LINGUISTIQUES
            </span>
            <div className="flex flex-wrap gap-2">
              {job.required_languages.map((lang, lIdx) => (
                <span
                  key={lIdx}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1.5"
                >
                  <Globe className="w-3 h-3 text-purple-400" />
                  <span>{lang.name} · {lang.minimum_level}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Button */}
      <div className="border-t border-white/5 pt-6 flex justify-end">
        <button
          onClick={onMatch}
          disabled={matching || job.status !== 'OPEN'}
          className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          {matching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>ANALYSE DES PROFILS DISPONIBLES...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>RECHERCHER LES MEILLEURS PROFILS →</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
