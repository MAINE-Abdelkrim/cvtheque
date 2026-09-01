import React, { useState } from 'react';
import type { CandidateCV } from '../../types';
import { downloadCandidateCV } from '../../lib/cv-downloader';
import { useAuth } from '../../providers/auth-provider';
import {
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Languages,
  Award,
  Globe,
  Github,
  Linkedin,
  Sparkles,
  CheckCircle2,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  Mic,
  ArrowRight,
  ShieldCheck,
  Wand2,
  Loader2
} from 'lucide-react';
import { CountUp } from '../ui/count-up';
import { motion } from 'motion/react';

interface CVStructuredModalProps {
  cv: CandidateCV | null;
  onClose: () => void;
  onStartInterview?: () => void;
}

export const CVStructuredModal: React.FC<CVStructuredModalProps> = ({ cv, onClose, onStartInterview }) => {
  if (!cv) return null;

  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const { profile } = useAuth();
  const isPremium = profile?.subscription === 'PREMIUM';
  const [loadingImprovements, setLoadingImprovements] = useState(false);
  const [improvements, setImprovements] = useState<Array<{category: string, advice: string}> | null>(null);

  const handleImproveCV = async () => {
    if (!isPremium) {
      alert("Cette fonctionnalité est réservée aux abonnés PREMIUM.");
      return;
    }
    
    setLoadingImprovements(true);
    try {
      const response = await fetch('/api/cv/improve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token') }`
        },
        body: JSON.stringify({ cvData: cv.parsedData, isPremium: true })
      });
      const data = await response.json();
      if (data.improvements) {
        setImprovements(data.improvements);
      }
    } catch (error) {
      console.error('Failed to get improvements:', error);
    } finally {
      setLoadingImprovements(false);
    }
  };

  const data = cv.parsedData;
  const identity = data?.identity;
  const experiences = data?.experiences || [];
  const education = data?.education || [];
  const skills = data?.skills || [];
  const languages = data?.languages || [];
  const certifications = data?.certifications || [];
  const summary = data?.summary;

  const fullName = identity?.full_name || cv.fullName || cv.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  const jobTitle = identity?.job_title || cv.jobTitle || 'Expert Métier & Profil Qualifié';
  const location = identity?.location || cv.location || 'France';
  const email = identity?.email || cv.email;
  const phone = identity?.phone || cv.phone;
  const score = cv.aiScore ?? 84;

  const dateRange = (start: string | null | undefined, end: string | null | undefined) =>
    [start?.trim(), end?.trim()].filter(Boolean).join(' — ');

  // Skills grouped by category
  const skillsByCategory = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    if (skills.length > 0) {
      skills.forEach(s => {
        const cat = s.category?.trim() || 'Expertises Clés';
        if (!map[cat]) map[cat] = [];
        if (s.name) map[cat].push(s.name);
      });
    } else if (cv.skills && cv.skills.length > 0) {
      map['Compétences Détectées'] = cv.skills;
    }
    return map;
  }, [skills, cv.skills]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cv-title"
    >
      <div className="relative w-full max-w-5xl max-h-[94vh] bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Architectural Header Bar */}
        <div className="px-6 sm:px-8 py-5 border-b border-[var(--border)] flex items-center justify-between bg-black/80 sticky top-0 z-20 backdrop-blur">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#0047FF]">
                // CV DOCUMENT INSPECTION
              </span>
              <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                · ID: {cv.id.substring(0, 8)}
              </span>
            </div>
            <h2 id="modal-cv-title" className="text-lg sm:text-xl font-bold font-display text-white truncate max-w-md">
              {fullName}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => downloadCandidateCV(cv)}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[var(--border)] text-xs font-mono text-white transition-all cursor-pointer"
              title="Exporter le document au format PDF"
            >
              <Download className="w-3.5 h-3.5 text-[#0047FF]" />
              <span>EXPORT PDF →</span>
            </button>

            {onStartInterview && (
              <button
                onClick={() => {
                  onClose();
                  onStartInterview();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">ENTRETIEN ORAL</span>
                <span className="sm:hidden">ENTRETIEN</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Fermer l'inspection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="p-6 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 text-[var(--foreground)] bg-[var(--surface)]">
          
          {/* Section 01: Profile Identity & Document Score Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#0047FF]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-3 relative z-10 max-w-xl">
              <div>
                <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] tracking-wider">
                  Dossier indexé le {new Date(cv.createdAt).toLocaleDateString('fr-FR')}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight mt-0.5">
                  {fullName}
                </h1>
                <p className="text-sm sm:text-base font-semibold text-[var(--foreground-secondary)] font-sans mt-1">
                  {jobTitle}
                </p>
              </div>

              {/* Contacts Row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-white/5 text-xs text-[var(--muted-foreground)] font-sans">
                {location && (
                  <span className="flex items-center gap-1.5 text-[var(--foreground-secondary)]">
                    <MapPin className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    {location}
                  </span>
                )}
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <Mail className="w-3.5 h-3.5 text-[#0047FF]" />
                    {email}
                  </a>
                )}
                {phone && (
                  <span className="flex items-center gap-1.5 text-[var(--foreground-secondary)]">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    {phone}
                  </span>
                )}
                {identity?.linkedin && (
                  <a href={identity.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-400 hover:underline">
                    <Linkedin className="w-3.5 h-3.5" />
                    <span>LinkedIn</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {identity?.github && (
                  <a href={identity.github} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-purple-400 hover:underline">
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {identity?.website && (
                  <a href={identity.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-400 hover:underline">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Portfolio</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Score & Telemetry Tile */}
            <div className="relative z-10 shrink-0 w-full md:w-auto p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex md:flex-col items-center justify-between md:justify-center gap-4 text-center">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] block">
                  CV QUALITY INDEX
                </span>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[var(--foreground)] font-display">
                    <CountUp to={score} duration={1.2} />
                  </span>
                  <span className="text-sm font-mono text-[var(--muted-foreground)]">/ 100</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-left border-l md:border-l-0 md:border-t border-[var(--border)] pl-4 md:pl-0 md:pt-3 text-[10px] font-mono">
                <div>
                  <span className="text-[var(--muted-foreground)] block">EXP</span>
                  <span className="font-bold text-[var(--foreground)] text-xs">{experiences.length}</span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block">SKILLS</span>
                  <span className="font-bold text-[var(--foreground)] text-xs">{skills.length || cv.skills?.length || 0}</span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block">DIP</span>
                  <span className="font-bold text-[var(--foreground)] text-xs">{education.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 02: AI Cognitive Evaluation */}
          {cv.feedback && (
            <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[#0047FF]/25 space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0047FF] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                // ÉVALUATION COGNITIVE & RECOMMANDATIONS
              </span>
              <p className="text-xs sm:text-sm text-[var(--foreground-secondary)] leading-relaxed font-sans">
                {cv.feedback}
              </p>
            </div>
          )}

          {/* AI CV Improvement Service (Premium) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-[var(--foreground)] flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-[#0047FF]" />
                  Amélioration de CV via IA
                </h3>
                <p className="text-xs text-[var(--foreground-secondary)] font-sans">
                  Recevez des conseils personnalisés pour optimiser votre profil (Service réservé aux membres Premium).
                </p>
              </div>
              <button
                onClick={handleImproveCV}
                disabled={!isPremium || loadingImprovements}
                className={`shrink-0 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${
                  isPremium 
                    ? 'bg-[#0047FF] hover:bg-[#0038CC] text-white shadow-[#0047FF]/20 cursor-pointer' 
                    : 'bg-[var(--surface-elevated)] text-[var(--muted-foreground)] border border-[var(--border)] cursor-not-allowed opacity-70'
                }`}
              >
                {loadingImprovements ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {isPremium ? 'Générer des conseils' : 'Débloquer avec Premium'}
              </button>
            </div>

            {improvements && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-4 border-t border-[var(--border)] space-y-3"
              >
                {improvements.map((imp, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] space-y-1.5 shadow-sm">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0047FF]">
                      {imp.category}
                    </span>
                    <p className="text-sm text-[var(--foreground)] font-sans leading-relaxed">
                      {imp.advice}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Section 03: Summary */}
          {summary && (
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#0047FF]" />
                <span>SYNTHÈSE DU PROFIL</span>
              </h3>
              <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs sm:text-sm text-[var(--foreground-secondary)] leading-relaxed">
                <p className={!summaryExpanded && summary.length > 320 ? 'line-clamp-3' : ''}>
                  {summary}
                </p>
                {summary.length > 320 && (
                  <button
                    onClick={() => setSummaryExpanded(!summaryExpanded)}
                    className="mt-2 text-xs font-mono font-bold text-[#0047FF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{summaryExpanded ? '[-] RÉDUIRE' : '[+] VOIR TOUT'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section 04: Experience Timeline */}
          {experiences.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-[#0047FF]" />
                  <span>EXPÉRIENCES PROFESSIONNELLES ({experiences.length})</span>
                </h3>
                <span className="text-[10px] font-mono text-[var(--muted-foreground)]">ORDRE ANTECHRONOLOGIQUE</span>
              </div>

              <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {experiences.map((exp, idx) => {
                  const idxNum = idx < 9 ? `[0${idx + 1}]` : `[${idx + 1}]`;
                  return (
                    <div key={idx} className="py-5 first:pt-4 last:pb-4 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-xs font-bold text-[#0047FF] shrink-0">
                            {idxNum}
                          </span>
                          <h4 className="text-base font-bold text-[var(--foreground)] font-display">
                            {exp.job_title || 'Poste'}
                          </h4>
                        </div>
                        <span className="text-xs font-mono text-[var(--muted-foreground)] shrink-0">
                          {dateRange(exp.start_date, exp.end_date) || 'Dates non précisées'}
                        </span>
                      </div>

                      <div className="pl-8 flex flex-wrap items-center gap-x-4 text-xs text-[var(--muted-foreground)] font-sans">
                        {exp.company && <span className="font-semibold text-[var(--foreground)]">{exp.company}</span>}
                        {exp.location && <span>· {exp.location}</span>}
                      </div>

                      {exp.description && (
                        <div className="pl-8 text-xs sm:text-sm text-[var(--foreground-secondary)] leading-relaxed font-sans whitespace-pre-wrap">
                          {exp.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 05: Skills Layer */}
          {Object.keys(skillsByCategory).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#0047FF]" />
                <span>COMPÉTENCES & EXPERTISES</span>
              </h3>

              <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-5">
                {(Object.entries(skillsByCategory) as [string, string[]][]).map(([category, skillList]) => (
                  <div key={category} className="space-y-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                      // {category}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {skillList.map((skill: string, sIdx: number) => (
                        <span
                          key={`${skill}-${sIdx}`}
                          className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 06: Education & Languages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Education */}
            {education.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-[#0047FF]" />
                  <span>FORMATIONS ({education.length})</span>
                </h3>

                <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] divide-y divide-[var(--border)]">
                  {education.map((edu, idx) => (
                    <div key={idx} className="py-3 first:pt-0 last:pb-0 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h5 className="text-xs font-bold text-[var(--foreground)] font-sans">{edu.degree || edu.field_of_study || 'Formation'}</h5>
                        <span className="text-[10px] font-mono text-[var(--muted-foreground)] shrink-0">
                          {dateRange(edu.start_date, edu.end_date)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {edu.institution} {edu.field_of_study && edu.degree ? `· ${edu.field_of_study}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {languages.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-2">
                  <Languages className="w-3.5 h-3.5 text-[#0047FF]" />
                  <span>LANGUES</span>
                </h3>

                <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] divide-y divide-[var(--border)]">
                  {languages.map((l, idx) => (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--foreground)] font-sans">{l.language}</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-[var(--surface-elevated)] border border-[var(--border)] font-mono text-[11px] text-[var(--foreground-secondary)]">
                        {l.level || l.original_level || 'Pratiquée'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Fixed Footer Actions */}
        <div className="px-6 sm:px-8 py-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)]">
          <span className="text-xs font-mono text-[var(--muted-foreground)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>Document analysé et synchronisé avec le matching de poste</span>
          </span>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => downloadCandidateCV(cv)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-mono text-xs border border-[var(--border)] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#0047FF]" />
              <span>EXPORT PDF</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs transition-colors cursor-pointer"
            >
              FERMER
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
