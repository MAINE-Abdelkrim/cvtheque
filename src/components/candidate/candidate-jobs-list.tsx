import React from 'react';
import { Briefcase, MapPin, Building2, ArrowRight } from 'lucide-react';
import type { JobPosting } from '../../types';
import { LoadingSkeleton } from '../ui/loading-skeleton';

const workModeLabels: Record<string, string> = {
  onsite: 'Sur site',
  hybrid: 'Hybride',
  remote: 'À distance'
};

interface CandidateJobsListProps {
  jobs: JobPosting[];
  loading: boolean;
  onSelectJob?: (job: JobPosting) => void;
}

export const CandidateJobsList: React.FC<CandidateJobsListProps> = ({
  jobs,
  loading,
  onSelectJob
}) => {
  return (
    <section aria-labelledby="open-jobs-title" className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--primary)]">
            // OPPORTUNITÉS DISPONIBLES
          </span>
          <h2 id="open-jobs-title" className="text-xl font-extrabold font-display text-[var(--foreground)]">
            POSTES ACTUELLEMENT OUVERTS ({jobs.length})
          </h2>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton variant="list" />
      ) : jobs.length === 0 ? (
        <div className="p-10 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-2">
          <Briefcase className="w-8 h-8 text-[var(--muted-foreground)] mx-auto" />
          <h3 className="text-sm font-bold text-[var(--foreground)] font-display">Aucune offre disponible</h3>
          <p className="text-xs text-[var(--muted-foreground)] font-sans">
            Les nouvelles offres publiées apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job, idx) => {
            const formattedIdx = idx < 9 ? `[0${idx + 1}]` : `[${idx + 1}]`;
            const conditions = [
              job.contract_type,
              job.work_mode ? workModeLabels[job.work_mode] ?? job.work_mode : null
            ].filter(Boolean);

            return (
              <div
                key={job.id}
                onClick={() => onSelectJob?.(job)}
                className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--primary)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[var(--primary)]">
                      {formattedIdx}
                    </span>
                    <h3 className="text-base font-bold font-display text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">
                      {job.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)] font-sans">
                    <span className="text-[var(--foreground)] font-semibold flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[var(--muted-foreground)]" />
                      {job.company}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[var(--muted-foreground)]" />
                      {job.location}
                    </span>
                    {conditions.map((condition, cIdx) => (
                      <React.Fragment key={cIdx}>
                        <span>·</span>
                        <span className="font-mono text-[var(--foreground)]">{condition}</span>
                      </React.Fragment>
                    ))}
                  </div>

                  {job.required_skills && job.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.required_skills.slice(0, 4).map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded bg-[var(--surface-secondary)] border border-[var(--border)] text-[10px] font-mono text-[var(--foreground)]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="text-xs font-mono text-[var(--primary)] group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
                    <span>VOIR</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

