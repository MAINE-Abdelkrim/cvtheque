import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Building2,
  MapPin,
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Mic,
  GraduationCap,
  Languages,
  Layers,
  Calendar,
  Check,
  FileText,
  ExternalLink
} from 'lucide-react';
import { JobPosting, CandidateCV, JobApplication } from '../../types';
import { DetailedMatchAnalysis } from '../../lib/matching-engine';
import { CountUp } from '../ui/count-up';

interface JobDetailDrawerProps {
  job: JobPosting | null;
  activeCv: CandidateCV | null;
  allCvs: CandidateCV[];
  existingApplication?: JobApplication;
  matchAnalysis?: DetailedMatchAnalysis;
  onClose: () => void;
  onApply: (jobId: string, cvId: string) => Promise<void>;
  onStartInterview: () => void;
  onSelectCv?: (cvId: string) => void;
}

export const JobDetailDrawer: React.FC<JobDetailDrawerProps> = ({
  job,
  activeCv,
  allCvs,
  existingApplication,
  matchAnalysis,
  onClose,
  onApply,
  onStartInterview,
  onSelectCv
}) => {
  const [selectedCvId, setSelectedCvId] = useState<string>(activeCv?.id || (allCvs[0]?.id ?? ''));
  const [applying, setApplying] = useState(false);

  if (!job) return null;

  const isApplied = Boolean(existingApplication);
  const score = existingApplication?.matchScore ?? matchAnalysis?.score ?? 0;

  const handleApplyClick = async () => {
    if (!selectedCvId) return;
    setApplying(true);
    try {
      await onApply(job.id, selectedCvId);
    } finally {
      setApplying(false);
    }
  };

  const workModeLabel = job.work_mode === 'remote' ? 'À distance' : job.work_mode === 'hybrid' ? 'Hybride' : job.work_mode === 'onsite' ? 'Sur site' : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-[var(--surface)]/85 backdrop-blur-md"
        />

        {/* Slide-over Architectural Panel */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-16">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-screen max-w-2xl bg-[var(--surface-secondary)] border-l border-[var(--border)] shadow-2xl flex flex-col h-full overflow-hidden relative"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#0047FF]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Control Bar */}
            <div className="px-6 sm:px-8 py-5 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--surface-secondary)]/90 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#0047FF]">
                  // FICHE D'OPPORTUNITÉ
                </span>
                <span className="h-px w-6 bg-white/10" />
                <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
                  ID: {job.id.slice(0, 8)}
                </span>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                title="Fermer la vue détaillée"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 space-y-8 relative z-10">
              
              {/* Header Title & Match Score Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div className="space-y-2 max-w-md">
                    <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight leading-tight">
                      {job.title}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)] font-sans">
                      <span className="font-semibold">{job.company}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[var(--muted-foreground)] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                        {job.location}
                      </span>
                    </div>
                  </div>

                  {/* Monumental Score Display */}
                  <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] shrink-0 self-start">
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
                      SCORE D'ADÉQUATION
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-[var(--foreground)] font-display">
                        <CountUp to={score} duration={1.2} />
                      </span>
                      <span className="text-xs font-mono text-[var(--muted-foreground)]">/ 100</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#0047FF] font-bold mt-1 block">
                      {score >= 80 ? 'MATCH ÉLEVÉ' : score >= 50 ? 'MATCH MODÉRÉ' : 'REQUIS SPÉCIFIQUES'}
                    </span>
                  </div>
                </div>

                {/* Metadata badges row */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {job.contract_type && (
                    <span className="px-3 py-1 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono text-[var(--foreground-secondary)]">
                      {job.contract_type}
                    </span>
                  )}
                  {workModeLabel && (
                    <span className="px-3 py-1 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono text-[var(--foreground-secondary)]">
                      {workModeLabel}
                    </span>
                  )}
                  {job.minimum_experience_years !== undefined && job.minimum_experience_years !== null && (
                    <span className="px-3 py-1 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono text-[var(--foreground-secondary)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                      {job.minimum_experience_years === 0 ? 'Débutant accepté' : `${job.minimum_experience_years} ans min.`}
                    </span>
                  )}
                  {isApplied && (
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      CANDIDATURE ENVOYÉE
                    </span>
                  )}
                </div>
              </div>

              {/* Match Intelligence Breakdown */}
              {activeCv && matchAnalysis && (
                <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0047FF]">
                      // ANALYSE CROISÉE DU PROFIL
                    </span>
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                      CV: {activeCv.jobTitle || activeCv.fileName}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--foreground-secondary)] leading-relaxed font-sans">
                    {matchAnalysis.explanation}
                  </p>

                  {/* Matched & Missing Skills Matrix */}
                  <div className="space-y-3 pt-2">
                    {matchAnalysis.matchedRequirements.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase block tracking-wider">
                          ✓ CRITÈRES VALIDÉS ({matchAnalysis.matchedRequirements.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {matchAnalysis.matchedRequirements.map((m, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono"
                            >
                              {m.requirement}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {matchAnalysis.missingRequirements.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono font-bold text-amber-400 uppercase block tracking-wider">
                          △ COMPÉTENCES OU REQUIS À COMPLÉTER ({matchAnalysis.missingRequirements.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {matchAnalysis.missingRequirements.map((m, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono"
                            >
                              {m.requirement}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section: Description */}
              <div className="space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                  // DESCRIPTION DU POSTE
                </span>
                <div className="p-6 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--foreground-secondary)] leading-relaxed font-sans whitespace-pre-line">
                  {job.description}
                </div>
              </div>

              {/* Section: Required & Preferred Skills */}
              {((job.required_skills && job.required_skills.length > 0) || (job.preferred_skills && job.preferred_skills.length > 0)) && (
                <div className="space-y-4">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                    // COMPÉTENCES ATTENDUES
                  </span>
                  
                  {job.required_skills && job.required_skills.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)]">Requis indispensables :</span>
                      <div className="flex flex-wrap gap-2">
                        {job.required_skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {job.preferred_skills && job.preferred_skills.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)]">Compétences appréciées :</span>
                      <div className="flex flex-wrap gap-2">
                        {job.preferred_skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono text-[var(--muted-foreground)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Section: Education & Languages */}
              {(job.required_education || (job.required_languages && job.required_languages.length > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {job.required_education && (
                    <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-1.5">
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs font-mono">
                        <GraduationCap className="w-4 h-4 text-[#0047FF]" />
                        <span>NIVEAU D'ÉTUDES</span>
                      </div>
                      <p className="text-xs font-bold text-[var(--foreground)] font-display">
                        {job.required_education.minimum_level || 'Non spécifié'}
                      </p>
                      {job.required_education.preferred_fields?.length > 0 && (
                        <p className="text-[10px] text-[var(--muted-foreground)] font-mono">
                          Domaines : {job.required_education.preferred_fields.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {job.required_languages && job.required_languages.length > 0 && (
                    <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-1.5">
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs font-mono">
                        <Languages className="w-4 h-4 text-[#0047FF]" />
                        <span>LANGUES REQUISES</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {job.required_languages.map((l, idx) => (
                          <span key={idx} className="text-xs font-bold text-[var(--foreground)] font-display">
                            {l.name} ({l.minimum_level}){idx < (job.required_languages?.length ?? 1) - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Fixed Action Footer */}
            <div className="p-6 sm:p-8 border-t border-[var(--border)] bg-[var(--surface)] shrink-0 space-y-4 z-10">
              {!isApplied ? (
                <div className="space-y-3">
                  {allCvs.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] font-bold block">
                        Sélectionner le CV pour postuler :
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative flex-1">
                          <select
                            value={selectedCvId}
                            onChange={(e) => {
                              setSelectedCvId(e.target.value);
                              if (onSelectCv) onSelectCv(e.target.value);
                            }}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] cursor-pointer appearance-none pr-8"
                          >
                            {allCvs.map(cv => (
                              <option key={cv.id} value={cv.id}>
                                {cv.jobTitle || cv.fileName || 'CV Candidat'} (Index: {cv.aiScore ?? 80}/100)
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted-foreground)] text-xs">
                            ▼
                          </div>
                        </div>

                        <button
                          onClick={handleApplyClick}
                          disabled={applying || !selectedCvId}
                          className="px-6 py-3.5 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-xl shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          {applying ? (
                            <>
                              <Clock className="w-4 h-4 animate-spin text-[var(--foreground)]" />
                              <span>TRANSMISSION...</span>
                            </>
                          ) : (
                            <>
                              <span>POSTULER AVEC CE CV</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 text-xs text-amber-300 font-mono">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Aucun CV indexé sur votre profil pour postuler.</span>
                      </div>
                      <a
                        href="/dashboard/candidate/cv"
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-mono text-xs font-bold hover:bg-amber-400 transition-colors shrink-0"
                      >
                        DÉPOSER UN CV →
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-xs text-emerald-400 font-mono">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Candidature enregistrée · Session d'entraînement disponible</span>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onStartInterview();
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span>PASSER L'ENTRETIEN ORAL IA</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
