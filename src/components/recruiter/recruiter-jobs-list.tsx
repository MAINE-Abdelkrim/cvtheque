import React from 'react';
import { Building2, MapPin, Trash2, Plus, ArrowRight, Briefcase } from 'lucide-react';
import type { JobPosting } from '../../types';
import { LoadingSkeleton } from '../ui/loading-skeleton';

const workMode: Record<string, string> = { onsite: 'Sur site', hybrid: 'Hybride', remote: 'À distance' };

interface RecruiterJobsListProps {
  jobs: JobPosting[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (jobId: string) => void;
  onDelete: (job: JobPosting) => void;
  onCreate: () => void;
  applicationsCountMap?: Record<string, number>;
}

export const RecruiterJobsList: React.FC<RecruiterJobsListProps> = ({
  jobs,
  loading,
  selectedId,
  onSelect,
  onDelete,
  onCreate,
  applicationsCountMap = {},
}) => {
  return (
    <section aria-label="Offres du recruteur" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
            // ACTIVE POSITIONS
          </span>
          <span className="h-px w-6 bg-white/10" />
          <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
            PIPELINE DE POSTES ({jobs.length})
          </span>
        </div>

        <button
          onClick={onCreate}
          className="px-3.5 py-1.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-white/10 text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#0047FF]" />
          <span>NOUVELLE OFFRE</span>
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton variant="list" />
      ) : jobs.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-4">
          <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
            // RECRUITMENT PIPELINE
          </span>
          <h3 className="text-xl sm:text-2xl font-extrabold font-display text-[var(--foreground)]">
            AUCUNE OFFRE ACTIVE
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] font-sans max-w-md mx-auto">
            Créez votre première fiche de poste et démarrez l'analyse d'adéquation sémantique de vos viviers.
          </p>
          <button
            onClick={onCreate}
            className="px-6 py-3 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 cursor-pointer"
          >
            CRÉER UNE OFFRE →
          </button>
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Offres du recruteur">
          {jobs.map((job, idx) => {
            const formattedIdx = idx < 9 ? `[0${idx + 1}]` : `[${idx + 1}]`;
            const selected = selectedId === job.id;
            const appCount = applicationsCountMap[job.id] ?? 0;
            const statusLabel = job.status === 'OPEN' ? 'ACTIVE' : job.status;

            return (
              <article
                key={job.id}
                role="listitem"
                onClick={() => onSelect(job.id)}
                className={`p-5 sm:p-6 rounded-2xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                  selected
                    ? 'bg-[var(--surface-secondary)] border-[#0047FF] shadow-lg shadow-[#0047FF]/5'
                    : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                {/* Active Indicator bar */}
                {selected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0047FF]" />
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-[#0047FF]">
                        {formattedIdx}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                          job.status === 'OPEN'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-[var(--surface-elevated)] text-[var(--muted-foreground)] border border-[var(--border)]'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      {selected && (
                        <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                          // SÉLECTIONNÉE
                        </span>
                      )}
                    </div>

                    <h4 className="text-base sm:text-lg font-bold font-display text-[var(--foreground)] uppercase tracking-tight truncate group-hover:text-blue-300 transition-colors">
                      {job.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[var(--muted-foreground)]">
                      <span className="flex items-center gap-1 text-[var(--foreground-secondary)]">
                        <Building2 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                        {job.company}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-[var(--foreground-secondary)]">
                        <MapPin className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                        {job.location}
                      </span>
                      {job.contract_type && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--muted-foreground)]">{job.contract_type}</span>
                        </>
                      )}
                    </div>

                    {/* Applications & Skills preview */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-[var(--foreground-secondary)] font-bold bg-[var(--surface-elevated)] px-2.5 py-1 rounded-lg border border-white/5">
                        {appCount} CANDIDATURE{appCount > 1 ? 'S' : ''}
                      </span>

                      {job.required_skills && job.required_skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {job.required_skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--surface-elevated)] text-[var(--muted-foreground)] border border-white/5"
                            >
                              {skill}
                            </span>
                          ))}
                          {job.required_skills.length > 3 && (
                            <span className="text-[10px] font-mono text-[var(--muted-foreground)] self-center">
                              +{job.required_skills.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(job);
                      }}
                      className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Supprimer l'offre"
                      aria-label={`Supprimer l'offre ${job.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="p-2 rounded-xl bg-[var(--surface-elevated)] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] group-hover:bg-[#0047FF] transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
