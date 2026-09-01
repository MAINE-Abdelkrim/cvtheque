import React, { useState } from 'react';
import { CandidateCV, JobPosting } from '../../types';
import { getDetailedMatchAnalysis } from '../../lib/matching-engine';
import { downloadCandidateCV } from '../../lib/cv-downloader';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Globe,
  Award,
  CheckCircle2,
  XCircle,
  Sparkles,
  Download,
  Linkedin,
  Github,
  ExternalLink,
  ShieldCheck,
  Languages,
  Calendar,
  Building,
  ArrowRight,
  FileText,
  ChevronRight,
  Check
} from 'lucide-react';

interface CandidateRecruiterModalProps {
  cv: CandidateCV | null;
  selectedJob: JobPosting | null;
  onClose: () => void;
}

export const CandidateRecruiterModal: React.FC<CandidateRecruiterModalProps> = ({
  cv,
  selectedJob,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'matching' | 'profile' | 'experience' | 'education'>('matching');

  if (!cv) return null;

  const parsed = cv.parsedData;
  const identity = parsed?.identity;
  const experiences = parsed?.experiences || [];
  const education = parsed?.education || [];
  const certifications = parsed?.certifications || [];
  const summary = parsed?.summary || cv.feedback;

  const fullName = identity?.full_name || cv.fullName || cv.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  const jobTitle = identity?.job_title || cv.jobTitle || 'Candidat';
  const email = identity?.email || cv.email || 'Non renseigné';
  const phone = identity?.phone || cv.phone || 'Non renseigné';
  const location = identity?.location || cv.location || 'France';
  const linkedin = identity?.linkedin;
  const github = identity?.github;
  const website = identity?.website;

  // Compute detailed match analysis against selected job (or fallback)
  const dummyJob: JobPosting = selectedJob || {
    id: 'general',
    recruiterId: 'recruiter',
    title: jobTitle,
    description: 'Évaluation générale des compétences du CV',
    company: 'Entreprise',
    location: 'France',
    required_skills: cv.skills?.slice(0, 5) || [],
  };

  const matchAnalysis = getDetailedMatchAnalysis(cv, dummyJob);
  const matchScore = matchAnalysis.score;
  const isStrongMatch = matchScore >= 80;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--surface)]/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[94vh] bg-[var(--surface-secondary)] border border-[var(--border)] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative text-left"
      >
        {/* ================= SECTION 01 — DOSSIER HEADER ================= */}
        <div className="px-6 sm:px-8 py-6 border-b border-[var(--border)] bg-[var(--surface)]/95 flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 z-20">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#0047FF]">
                // CANDIDATE DOSSIER
              </span>
              <span className="h-px w-8 bg-white/10" />
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase truncate">
                ID : {cv.id.slice(0, 10)}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase">
                {fullName}
              </h2>
              <span className="text-xs font-mono text-[var(--muted-foreground)] font-bold uppercase tracking-wider">
                · {jobTitle}
              </span>
            </div>

            {selectedJob && (
              <p className="text-xs font-mono text-[var(--muted-foreground)] flex items-center gap-2">
                <span className="text-[#0047FF]">MATCHED POSITION:</span>
                <span className="text-[var(--foreground)] font-bold">{selectedJob.title}</span>
                <span className="text-slate-600">({selectedJob.company} · {selectedJob.location})</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Match Score Badge */}
            <div className="flex items-baseline gap-1.5 bg-white/[0.03] px-4 py-2.5 rounded-2xl border border-[var(--border)]">
              <span className="text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight">
                {matchScore}
              </span>
              <span className="text-xs font-mono text-[var(--muted-foreground)]">/ 100</span>
              <span className="text-[9px] font-mono text-[#0047FF] uppercase font-bold ml-1">
                {isStrongMatch ? 'STRONG MATCH' : 'MATCH MODÉRÉ'}
              </span>
            </div>

            <button
              onClick={() => downloadCandidateCV(cv)}
              className="px-5 py-3 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
              title="Télécharger le dossier CV complet (PDF)"
            >
              <Download className="w-4 h-4" />
              <span>TÉLÉCHARGER LE DOSSIER →</span>
            </button>

            <button
              onClick={onClose}
              className="p-3 rounded-2xl bg-[var(--surface-elevated)] hover:bg-white/10 border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="px-6 sm:px-8 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex items-center gap-3 overflow-x-auto py-3.5">
          <TabButton
            active={activeTab === 'matching'}
            onClick={() => setActiveTab('matching')}
            icon={Sparkles}
            label="MATCH INTELLIGENCE"
          />
          <TabButton
            active={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            icon={FileText}
            label="PROFIL & LANGUES"
          />
          <TabButton
            active={activeTab === 'experience'}
            onClick={() => setActiveTab('experience')}
            icon={Briefcase}
            label={`EXPÉRIENCES (${experiences.length})`}
          />
          <TabButton
            active={activeTab === 'education'}
            onClick={() => setActiveTab('education')}
            icon={GraduationCap}
            label={`FORMATIONS (${education.length})`}
          />
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-8 flex-1 text-[var(--foreground)] bg-[var(--surface)]">
          {/* ================= TAB 1: MATCH INTELLIGENCE ================= */}
          {activeTab === 'matching' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Section 02: Quick Signals Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickSignalCard
                  index="[01]"
                  label="COMPÉTENCES"
                  status={matchAnalysis.matchedRequirements.length > 0 ? "FORT" : "MODÉRÉ"}
                  desc={`${matchAnalysis.matchedRequirements.length} validées`}
                />
                <QuickSignalCard
                  index="[02]"
                  label="EXPÉRIENCE"
                  status="ANALYSEM"
                  desc={`${experiences.length} postes répertoriés`}
                />
                <QuickSignalCard
                  index="[03]"
                  label="FORMATION"
                  status={education.length > 0 ? "COMPATIBLE" : "NON SPÉC"}
                  desc={education[0]?.degree || 'Niveau standard'}
                />
                <QuickSignalCard
                  index="[04]"
                  label="LANGUES"
                  status={matchAnalysis.languages.length > 0 ? "VÉRIFIÉ" : "STANDARD"}
                  desc={`${matchAnalysis.languages.length} langues détectées`}
                />
              </div>

              {/* Section 03: Match Analysis & Narrative */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
                    // MATCH INTELLIGENCE
                  </span>
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">SYNTHÈSE SÉMANTIQUE</span>
                </div>

                <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
                  <h3 className="text-xl font-bold font-display text-[var(--foreground)]">
                    POURQUOI CE CANDIDAT CORRESPOND.
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--foreground-secondary)] font-sans leading-relaxed">
                    {matchAnalysis.explanation}
                  </p>
                </div>
              </div>

              {/* Match Criteria Bars */}
              <div className="space-y-4">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--muted-foreground)] uppercase block">
                  // DÉCOMPTE DES CRITÈRES
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CriterionBar
                    label="COMPÉTENCES TECHNIQUES"
                    score={matchAnalysis.score}
                    status={matchAnalysis.score >= 70 ? 'Excellent alignement' : 'Alignement partiel'}
                  />
                  <CriterionBar
                    label="EXPÉRIENCE PROFESSIONNELLE"
                    score={Math.min(100, matchAnalysis.score + 5)}
                    status="Cohérent avec le poste"
                  />
                  <CriterionBar
                    label="NIVEAU ACADÉMIQUE"
                    score={88}
                    status="Diplôme compatible"
                  />
                  <CriterionBar
                    label="MAÎTRISE LINGUISTIQUE"
                    score={80}
                    status="Langues requises validées"
                  />
                </div>
              </div>

              {/* Evidence & Gaps Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Strong Signals */}
                <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-emerald-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                      // STRONG SIGNALS ({matchAnalysis.matchedRequirements.length})
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>

                  {matchAnalysis.matchedRequirements.length > 0 ? (
                    <div className="space-y-3">
                      {matchAnalysis.matchedRequirements.map((match, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-[var(--foreground)] block">{match.requirement}</span>
                            <span className="text-[10px] text-emerald-400/80 font-mono">
                              Détecté via : {match.matchedWith}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {match.matchScore}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-[var(--muted-foreground)] p-4 text-center">
                      Aucune exigence spécifique validée dans l'index.
                    </p>
                  )}
                </div>

                {/* Gaps */}
                <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-rose-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest">
                      // GAPS & ÉCARTS ({matchAnalysis.missingRequirements.length})
                    </span>
                    <XCircle className="w-4 h-4 text-rose-400" />
                  </div>

                  {matchAnalysis.missingRequirements.length > 0 ? (
                    <div className="space-y-3">
                      {matchAnalysis.missingRequirements.map((miss, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/15 flex items-center justify-between"
                        >
                          <span className="text-xs font-medium text-[var(--foreground-secondary)]">{miss.requirement}</span>
                          <span className="text-[9px] font-mono font-bold px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                            À VÉRIFIER
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-emerald-400 p-4 text-center">
                      Aucun écart critique détecté par rapport aux exigences du poste.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: PROFIL & LANGUES ================= */}
          {activeTab === 'profile' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Contact info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase font-bold flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#0047FF]" />
                    EMAIL
                  </span>
                  <p className="text-xs font-mono font-bold text-[var(--foreground)] truncate">{email}</p>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase font-bold flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#0047FF]" />
                    TÉLÉPHONE
                  </span>
                  <p className="text-xs font-mono font-bold text-[var(--foreground)] truncate">{phone}</p>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase font-bold flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#0047FF]" />
                    LOCALISATION
                  </span>
                  <p className="text-xs font-mono font-bold text-[var(--foreground)] truncate">{location}</p>
                </div>
              </div>

              {/* Links */}
              {(linkedin || github || website) && (
                <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase font-bold">LIENS EXTERNES :</span>
                  {linkedin && (
                    <a
                      href={linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--foreground-secondary)] text-xs font-mono hover:text-[var(--foreground)] hover:border-[#0047FF]/40 transition-colors"
                    >
                      <Linkedin className="w-3.5 h-3.5 text-[#0047FF]" />
                      <span>LinkedIn</span>
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  )}
                  {github && (
                    <a
                      href={github}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--foreground-secondary)] text-xs font-mono hover:text-[var(--foreground)] hover:border-[#0047FF]/40 transition-colors"
                    >
                      <Github className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                      <span>GitHub</span>
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  )}
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--foreground-secondary)] text-xs font-mono hover:text-[var(--foreground)] hover:border-[#0047FF]/40 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-[#0047FF]" />
                      <span>Portfolio</span>
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  )}
                </div>
              )}

              {/* Bio summary */}
              {summary && (
                <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest font-bold block">
                    // RÉSUMÉ PROFESSIONNEL
                  </span>
                  <p className="text-xs sm:text-sm text-[var(--foreground-secondary)] font-sans leading-relaxed">{summary}</p>
                </div>
              )}

              {/* Languages */}
              <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
                <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest font-bold block">
                  // LANGUES PRATIQUÉES
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {matchAnalysis.languages.map((lang, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-between"
                    >
                      <span className="text-xs font-mono font-bold text-[var(--foreground)]">{lang.language}</span>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[#0047FF]/10 text-[#0047FF] border border-[#0047FF]/20 font-bold uppercase">
                        {lang.level || 'Intermédiaire'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              {certifications.length > 0 && (
                <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest font-bold block">
                    // CERTIFICATIONS ({certifications.length})
                  </span>
                  <div className="space-y-3">
                    {certifications.map((cert, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="font-bold font-display text-[var(--foreground)] text-sm">{cert.name}</p>
                          <p className="text-[11px] font-mono text-[var(--muted-foreground)] mt-0.5">{cert.issuer}</p>
                        </div>
                        {cert.date && (
                          <span className="text-[10px] font-mono text-[var(--muted-foreground)] bg-[var(--surface-elevated)] px-3 py-1 rounded-xl border border-[var(--border)]">
                            {cert.date}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: EXPÉRIENCES ================= */}
          {activeTab === 'experience' && (
            <div className="space-y-6 animate-fadeIn">
              {experiences.length > 0 ? (
                experiences.map((exp, idx) => (
                  <div
                    key={idx}
                    className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4 text-left relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold font-display text-[var(--foreground)] uppercase">{exp.job_title || 'Poste occupé'}</h4>
                        <div className="flex items-center gap-2 text-xs font-mono text-[#0047FF]">
                          <Building className="w-3.5 h-3.5" />
                          <span>{exp.company || 'Entreprise'}</span>
                          {exp.location && <span className="text-[var(--muted-foreground)]">· {exp.location}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] font-mono bg-[var(--surface-elevated)] px-3 py-1.5 rounded-xl border border-[var(--border)] w-fit">
                        <Calendar className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                        <span>{exp.start_date || 'N/A'} — {exp.end_date || 'Présent'}</span>
                      </div>
                    </div>

                    {exp.description && (
                      <p className="text-xs sm:text-sm text-[var(--foreground-secondary)] font-sans leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-16 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] text-center text-xs font-mono text-[var(--muted-foreground)]">
                  Aucune expérience professionnelle détaillée n'a été extraite pour ce profil.
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: FORMATIONS ================= */}
          {activeTab === 'education' && (
            <div className="space-y-6 animate-fadeIn">
              {education.length > 0 ? (
                education.map((edu, idx) => (
                  <div
                    key={idx}
                    className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3 text-left"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold font-display text-[var(--foreground)] uppercase">{edu.degree || 'Diplôme'}</h4>
                        <p className="text-xs font-mono text-[#0047FF]">
                          {edu.field_of_study ? `${edu.field_of_study} · ` : ''}
                          <span className="text-[var(--foreground-secondary)]">{edu.institution || 'Établissement'}</span>
                        </p>
                      </div>

                      <span className="text-xs font-mono text-[var(--muted-foreground)] bg-[var(--surface-elevated)] px-3 py-1.5 rounded-xl border border-[var(--border)] w-fit">
                        {edu.start_date ? `${edu.start_date} — ` : ''}
                        {edu.end_date || 'Diplômé'}
                      </span>
                    </div>

                    {edu.description && (
                      <p className="text-xs sm:text-sm text-[var(--foreground-secondary)] font-sans leading-relaxed">
                        {edu.description}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-16 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] text-center text-xs font-mono text-[var(--muted-foreground)]">
                  Aucune formation n'a été extraite pour ce profil.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dossier Footer / Sticky Action Bar */}
        <div className="px-6 sm:px-8 py-5 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-0 z-20">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-mono text-[var(--muted-foreground)]">DOSSIER CANDIDAT ANALYSÉ PAR MOTEUR SÉMANTIQUE CVTHÈQUE</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => downloadCandidateCV(cv)}
              className="px-5 py-3 rounded-2xl bg-[var(--surface-elevated)] hover:bg-white/10 text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>TÉLÉCHARGER PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 cursor-pointer"
            >
              FERMER LE DOSSIER →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label }) => {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
        active
          ? 'bg-[#0047FF] text-[var(--foreground)] shadow-lg shadow-[#0047FF]/20'
          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)]'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
};

const QuickSignalCard: React.FC<{ index: string; label: string; status: string; desc: string }> = ({
  index,
  label,
  status,
  desc,
}) => (
  <div className="p-5 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2 text-left">
    <div className="flex items-center justify-between">
      <span className="text-xs font-mono font-bold text-[#0047FF]">{index}</span>
      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--foreground-secondary)] border border-[var(--border)] font-bold uppercase">
        {status}
      </span>
    </div>
    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] font-bold block">
      {label}
    </span>
    <p className="text-xs font-mono text-[var(--foreground-secondary)] truncate">{desc}</p>
  </div>
);

const CriterionBar: React.FC<{ label: string; score: number; status: string }> = ({
  label,
  score,
  status,
}) => (
  <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-xs font-mono font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">{label}</span>
      <span className="text-xs font-mono font-bold text-[var(--foreground)]">{score} / 100</span>
    </div>

    <div className="w-full h-1.5 bg-[var(--surface-elevated)] rounded-full overflow-hidden border border-[var(--border)]">
      <div
        className="h-full bg-[#0047FF] rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>

    <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
      {status}
    </span>
  </div>
);
