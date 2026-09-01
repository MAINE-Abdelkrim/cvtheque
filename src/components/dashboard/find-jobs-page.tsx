import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { JobPosting, CandidateCV, JobApplication } from '../../types';
import { calculateJobMatchScore, getDetailedMatchAnalysis, DetailedMatchAnalysis } from '../../lib/matching-engine';
import { JobDetailDrawer } from './job-detail-drawer';
import { CountUp } from '../ui/count-up';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Building2,
  Briefcase,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Mic,
  RotateCcw,
  AlertCircle,
  Eye,
  FileText,
  Filter,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

interface FindJobsPageProps {
  onNavigate?: (path: string) => void;
}

export const FindJobsPage: React.FC<FindJobsPageProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedContract, setSelectedContract] = useState<string>('ALL');
  const [selectedExperience, setSelectedExperience] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'MATCH' | 'RECENT' | 'ALPHA'>('MATCH');
  const [selectedCvId, setSelectedCvId] = useState<string>('');

  // Detailed Modal & Inline Match Insight State
  const [inspectedJob, setInspectedJob] = useState<JobPosting | null>(null);
  const [expandedMatchJobId, setExpandedMatchJobId] = useState<string | null>(null);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [cvsData, jobsData, appsData] = await Promise.all([
        dbEngine.getCVsByCandidate(profile.uid),
        dbEngine.getAllJobs(),
        dbEngine.getApplicationsByCandidate(profile.uid)
      ]);
      setCvs(cvsData);
      setJobs(jobsData.filter(j => j.status === 'OPEN'));
      setApplications(appsData);

      if (cvsData.length > 0 && !selectedCvId) {
        setSelectedCvId(cvsData[0].id);
      }
    } catch (e) {
      console.error('Error fetching jobs data:', e);
      toast.error('Erreur lors de la récupération des opportunités.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.uid]);

  const activeCv = useMemo(() => {
    if (!cvs.length) return null;
    return cvs.find(c => c.id === selectedCvId) || cvs[0];
  }, [cvs, selectedCvId]);

  // Extract unique locations for the filter
  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => {
      if (j.location && j.location.trim()) set.add(j.location.trim());
    });
    return Array.from(set);
  }, [jobs]);

  // Extract unique contract types
  const availableContracts = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => {
      if (j.contract_type) set.add(j.contract_type);
    });
    return Array.from(set);
  }, [jobs]);

  // Compute match scores & detailed analyses for each job
  const jobAnalyses = useMemo(() => {
    const map = new Map<string, DetailedMatchAnalysis>();
    if (!activeCv) return map;

    jobs.forEach(job => {
      const analysis = getDetailedMatchAnalysis(activeCv, job);
      map.set(job.id, analysis);
    });
    return map;
  }, [jobs, activeCv]);

  // Filter and sort jobs
  const processedJobs = useMemo(() => {
    return jobs
      .filter(job => {
        // Query match
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = job.title.toLowerCase().includes(q);
          const matchCompany = job.company.toLowerCase().includes(q);
          const matchLocation = job.location.toLowerCase().includes(q);
          const matchSkills = (job.required_skills || []).some(s => s.toLowerCase().includes(q));
          const matchDesc = (job.description || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCompany && !matchLocation && !matchSkills && !matchDesc) {
            return false;
          }
        }

        // Location match
        if (selectedLocation !== 'ALL' && job.location !== selectedLocation) {
          return false;
        }

        // Contract match
        if (selectedContract !== 'ALL' && job.contract_type !== selectedContract) {
          return false;
        }

        // Experience match
        if (selectedExperience !== 'ALL') {
          const exp = job.minimum_experience_years ?? 0;
          if (selectedExperience === 'JUNIOR' && exp > 2) return false;
          if (selectedExperience === 'MID' && (exp < 2 || exp > 5)) return false;
          if (selectedExperience === 'SENIOR' && exp < 5) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'MATCH') {
          const scoreA = jobAnalyses.get(a.id)?.score ?? 0;
          const scoreB = jobAnalyses.get(b.id)?.score ?? 0;
          return scoreB - scoreA;
        }
        if (sortBy === 'RECENT') {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        }
        if (sortBy === 'ALPHA') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [jobs, searchQuery, selectedLocation, selectedContract, selectedExperience, sortBy, jobAnalyses]);

  // Matching Summary counts
  const matchSummaryStats = useMemo(() => {
    let strong = 0;
    let potential = 0;
    let low = 0;
    jobs.forEach(job => {
      const score = jobAnalyses.get(job.id)?.score ?? 0;
      if (score >= 80) strong++;
      else if (score >= 50) potential++;
      else low++;
    });
    return { strong, potential, low };
  }, [jobs, jobAnalyses]);

  const handleApplyToJob = async (jobId: string, cvIdToUse?: string) => {
    if (!profile) return;
    const targetCvId = cvIdToUse || selectedCvId || (cvs[0]?.id ?? '');

    if (!targetCvId) {
      toast.warning('Veuillez d\'abord téléverser un CV sur votre tableau de bord.');
      return;
    }

    setApplyingJobId(jobId);
    try {
      const cv = cvs.find(c => c.id === targetCvId);
      const job = jobs.find(j => j.id === jobId);
      const finalScore = cv && job ? calculateJobMatchScore(cv, job) : 10;

      await dbEngine.createApplication({
        jobId,
        candidateId: profile.uid,
        cvId: targetCvId,
        matchScore: finalScore,
        status: 'APPLIED'
      });

      await dbEngine.createInterviewSession({
        candidateId: profile.uid,
        jobId,
        jobTitle: job?.title || 'Entretien',
        currentStage: 'INTRODUCTION',
        status: 'IN_PROGRESS',
        audioMode: false,
        messages: []
      });

      toast.success('Candidature envoyée avec succès. Session d\'entraînement oral initialisée.');
      await loadData();
    } catch (e: any) {
      console.error('Application error:', e);
      toast.error('Erreur lors de la candidature : ' + (e.message || 'Erreur inconnue'));
    } finally {
      setApplyingJobId(null);
    }
  };

  const handleStartInterview = () => {
    if (onNavigate) {
      onNavigate('/dashboard/candidate/interview');
    } else {
      window.location.href = '/dashboard/candidate/interview';
    }
  };

  const hasActiveFilters = searchQuery !== '' || selectedLocation !== 'ALL' || selectedContract !== 'ALL' || selectedExperience !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedLocation('ALL');
    setSelectedContract('ALL');
    setSelectedExperience('ALL');
    setSortBy('MATCH');
  };

  const getWorkModeLabel = (mode?: string | null) => {
    if (!mode) return null;
    if (mode === 'remote') return 'À distance';
    if (mode === 'hybrid') return 'Hybride';
    if (mode === 'onsite') return 'Sur site';
    return mode;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-28 select-none">
      
      {/* =========================================================================
          SECTION 01 — EDITORIAL HERO
          ========================================================================= */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--primary)]">
            // OPPORTUNITY INDEX
          </span>
          <span className="h-px flex-1 max-w-[120px] bg-[var(--border)]" />
          <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
            MOTEUR COGNITIF D'APPARIEMENT
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[var(--border)] pb-8">
          <div className="space-y-3 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase leading-[1.04]">
              FIND WORK<br />
              THAT FITS.
            </h1>
            <p className="text-sm sm:text-base text-[var(--muted-foreground)] font-sans leading-relaxed">
              CVThèque ranks opportunities according to the candidate's professional profile and semantic skill affinities.
            </p>
          </div>

          {/* Active Matching CV Pill / Switcher */}
          {cvs.length > 0 ? (
            <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-2 shrink-0 max-w-xs w-full lg:w-auto shadow-sm">
              <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] tracking-wider font-bold block">
                // PROFIL CV ACTIF (MATCHING)
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedCvId}
                  onChange={(e) => setSelectedCvId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  {cvs.map(cv => (
                    <option key={cv.id} value={cv.id}>
                      {cv.jobTitle || cv.fileName || 'Mon CV'} ({cv.aiScore ?? 87}/100)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-xs flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-bold">PROFIL NON INDEXÉ</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] font-sans">
                Déposez votre CV pour activer le calcul dynamique d'affinité.
              </p>
              <button
                onClick={() => onNavigate ? onNavigate('/dashboard/candidate/cv') : window.location.href = '/dashboard/candidate/cv'}
                className="mt-1 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors text-[11px]"
              >
                DÉPOSER UN CV →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION 02 — SEARCH & FILTER INTERFACE
          ========================================================================= */}
      <section className="space-y-4">
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-6 shadow-sm">
          
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--foreground)]">
              // SEARCH OPPORTUNITIES
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-mono text-[var(--primary)] hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RÉINITIALISER LES FILTRES</span>
              </button>
            )}
          </div>

          {/* Primary Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, skill, company, location..."
              className="w-full pl-12 pr-12 py-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm sm:text-base font-sans text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs font-mono p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refined Dropdown Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            
            {/* Location Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] font-bold block">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="ALL">ALL LOCATIONS</option>
                {availableLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            {/* Contract Type Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] font-bold block">
                Contract
              </label>
              <select
                value={selectedContract}
                onChange={(e) => setSelectedContract(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="ALL">ALL CONTRACTS</option>
                {availableContracts.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Experience Level Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] font-bold block">
                Experience
              </label>
              <select
                value={selectedExperience}
                onChange={(e) => setSelectedExperience(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="ALL">ALL LEVELS</option>
                <option value="JUNIOR">Junior (0-2 yrs)</option>
                <option value="MID">Mid (3-5 yrs)</option>
                <option value="SENIOR">Senior (5+ yrs)</option>
              </select>
            </div>

            {/* Sorting Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] font-bold block">
                Match & Sort
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="MATCH">Highest Match (AI)</option>
                <option value="RECENT">Most Recent</option>
                <option value="ALPHA">Alphabetical (A-Z)</option>
              </select>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 03 — MATCHING SUMMARY STATEMENT
          ========================================================================= */}
      <section className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--primary)]">
            // MATCHING ENGINE
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold font-display text-[var(--foreground)]">
            {processedJobs.length} OPPORTUNITIES FOUND
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
            {matchSummaryStats.strong} STRONG MATCHES
          </div>
          <div className="px-4 py-2 rounded-xl bg-[var(--primary-subtle)] border border-[var(--primary)]/30 text-[var(--primary)] font-mono text-xs font-bold">
            {matchSummaryStats.potential} POTENTIAL MATCHES
          </div>
          <div className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--muted-foreground)] font-mono text-xs font-bold">
            {matchSummaryStats.low} LOW MATCHES
          </div>
        </div>
      </section>

      {/* =========================================================================
          JOB LIST SECTION
          ========================================================================= */}
      <section className="space-y-6">
        
        {loading ? (
          /* Editorial Loading Skeleton */
          <div className="space-y-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] animate-pulse flex flex-col sm:flex-row justify-between gap-6"
              >
                <div className="space-y-3 flex-1">
                  <div className="h-4 w-12 bg-[var(--surface-secondary)] rounded" />
                  <div className="h-7 w-2/3 bg-[var(--surface-secondary)] rounded-lg" />
                  <div className="h-4 w-1/3 bg-[var(--surface-secondary)] rounded" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-6 w-16 bg-[var(--surface-secondary)] rounded" />
                    <div className="h-6 w-20 bg-[var(--surface-secondary)] rounded" />
                  </div>
                </div>
                <div className="h-16 w-28 bg-[var(--surface-secondary)] rounded-2xl shrink-0" />
              </div>
            ))}
          </div>
        ) : processedJobs.length === 0 ? (
          /* Empty States */
          jobs.length === 0 ? (
            /* No jobs in system */
            <div className="p-12 sm:p-16 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-4 shadow-sm">
              <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
                // OPPORTUNITY INDEX
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)]">
                NO OPPORTUNITIES AVAILABLE.
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] font-sans max-w-md mx-auto leading-relaxed">
                Try adjusting your search or check again later.
              </p>
            </div>
          ) : (
            /* Search returned 0 matches */
            <div className="p-12 sm:p-16 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-4 shadow-sm">
              <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
                // NO MATCHES
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)]">
                NO OPPORTUNITIES MATCH THE CURRENT FILTERS.
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] font-sans max-w-md mx-auto leading-relaxed">
                Try clearing filters or search terms to see available postings.
              </p>
              <div className="pt-2">
                <button
                  onClick={resetFilters}
                  className="px-6 py-3 rounded-2xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-xs font-bold transition-all border border-[var(--border)] cursor-pointer"
                >
                  CLEAR FILTERS →
                </button>
              </div>
            </div>
          )
        ) : (
          /* Editorial Job List */
          <div className="space-y-4">
            {processedJobs.map((job, idx) => {
              const formattedIdx = idx < 9 ? `[0${idx + 1}]` : `[${idx + 1}]`;
              const analysis = jobAnalyses.get(job.id);
              const score = analysis?.score ?? 0;
              const hasApplied = applications.some(a => a.jobId === job.id);
              const isMatchExpanded = expandedMatchJobId === job.id;
              const isApplying = applyingJobId === job.id;
              const workMode = getWorkModeLabel(job.work_mode);

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.03 }}
                  className={`p-6 sm:p-8 rounded-3xl border transition-all relative overflow-hidden group shadow-sm ${
                    hasApplied
                      ? 'bg-[var(--surface)] border-emerald-500/30'
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border-[var(--border)] hover:border-[var(--primary)]'
                  }`}
                >
                  {/* Subtle Klein Blue Accent Indicator on Hover */}
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    
                    {/* Left: Job Core Typography */}
                    <div className="space-y-3.5 flex-1 min-w-0">
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-[var(--primary)]">
                          {formattedIdx}
                        </span>
                        {hasApplied && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            APPLICATION SUBMITTED
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                          {new Date(job.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>

                      {/* Job Title */}
                      <h3
                        onClick={() => setInspectedJob(job)}
                        className="text-xl sm:text-2xl font-extrabold font-display text-[var(--foreground)] tracking-tight hover:text-[var(--primary)] transition-colors cursor-pointer"
                      >
                        {job.title}
                      </h3>

                      {/* Company, Location & Contract Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted-foreground)] font-sans">
                        <span className="font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                          {job.company}
                        </span>
                        <span className="text-[var(--border)]">·</span>
                        <span className="text-[var(--muted-foreground)] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                          {job.location}
                        </span>
                        {job.contract_type && (
                          <>
                            <span className="text-[var(--border)]">·</span>
                            <span className="font-mono text-[var(--foreground)] font-bold">
                              {job.contract_type}
                            </span>
                          </>
                        )}
                        {workMode && (
                          <>
                            <span className="text-[var(--border)]">·</span>
                            <span className="font-mono text-[var(--muted-foreground)]">
                              {workMode}
                            </span>
                          </>
                        )}
                        {job.minimum_experience_years !== undefined && job.minimum_experience_years !== null && (
                          <>
                            <span className="text-[var(--border)]">·</span>
                            <span className="font-mono text-[var(--muted-foreground)]">
                              {job.minimum_experience_years === 0 ? 'Entry level' : `${job.minimum_experience_years} yrs exp.`}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Snippet / Description Preview */}
                      {job.description && (
                        <p className="text-xs sm:text-sm text-[var(--muted-foreground)] line-clamp-2 font-sans leading-relaxed pt-1">
                          {job.description}
                        </p>
                      )}

                      {/* Required Skills Inline Tags */}
                      {job.required_skills && job.required_skills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          {job.required_skills.slice(0, 5).map((skill, sIdx) => {
                            const isMatched = analysis?.matchedRequirements.some(
                              m => m.requirement.toLowerCase() === skill.toLowerCase()
                            );
                            return (
                              <span
                                key={sIdx}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                                  isMatched
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                                    : 'bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)]'
                                }`}
                              >
                                {isMatched ? `✓ ${skill}` : skill}
                              </span>
                            );
                          })}
                          {job.required_skills.length > 5 && (
                            <span className="px-2 py-1 rounded-md bg-[var(--surface-secondary)] text-[10px] font-mono text-[var(--muted-foreground)]">
                              +{job.required_skills.length - 5}
                            </span>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Right: Match Score & Action Suite */}
                    <div className="flex sm:flex-row lg:flex-col items-end sm:items-center lg:items-end justify-between lg:justify-start gap-4 shrink-0 border-t lg:border-t-0 border-[var(--border)] pt-4 lg:pt-0">
                      
                      {/* Syne Match Score Indicator */}
                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1.5">
                          <span className="text-3xl sm:text-4xl font-extrabold font-display text-[var(--foreground)] tracking-tight">
                            {score}
                          </span>
                          <span className="text-xs font-mono font-bold text-[var(--primary)] tracking-wider uppercase">
                            / 100 MATCH
                          </span>
                        </div>
                        
                        {/* Thin semantic indicator bar */}
                        <div className="w-28 h-1.5 bg-[var(--surface-secondary)] rounded-full mt-1.5 overflow-hidden border border-[var(--border)]">
                          <div
                            className={`h-full transition-all duration-700 ${
                              score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-[var(--primary)]' : 'bg-slate-400'
                            }`}
                            style={{ width: `${Math.max(8, score)}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Triggers */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        
                        {/* Trigger "Why this match?" */}
                        {analysis && activeCv && (
                          <button
                            onClick={() => setExpandedMatchJobId(isMatchExpanded ? null : job.id)}
                            className="px-3 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-[11px] border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Comprendre l'affinité IA"
                          >
                            <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                            <span>{isMatchExpanded ? 'MASQUER' : 'POURQUOI ?'}</span>
                            {isMatchExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}

                        {/* Inspect detail */}
                        <button
                          onClick={() => setInspectedJob(job)}
                          className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-[11px] border border-[var(--border)] transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-[var(--primary)]" />
                          <span>DÉTAIL</span>
                        </button>

                        {/* Apply or Interview Action */}
                        {!hasApplied ? (
                          <button
                            onClick={() => handleApplyToJob(job.id)}
                            disabled={isApplying || cvs.length === 0}
                            className="px-4 py-2 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white font-mono text-[11px] font-bold transition-all shadow-md shadow-[var(--primary)]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isApplying ? (
                              <>
                                <Clock className="w-3 h-3 animate-spin" />
                                <span>ENVOI...</span>
                              </>
                            ) : (
                              <>
                                <span>APPLY →</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={handleStartInterview}
                            className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5 border border-[var(--border)] cursor-pointer"
                          >
                            <Mic className="w-3 h-3 text-[var(--primary)] animate-pulse" />
                            <span>ENTRETIEN ORAL</span>
                          </button>
                        )}

                      </div>

                    </div>

                  </div>

                  {/* Expandable Match Explanation Drawer */}
                  <AnimatePresence>
                    {isMatchExpanded && analysis && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-6 pt-5 border-t border-[var(--border)] space-y-4"
                      >
                        <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--primary)]">
                              // WHY THIS MATCHES
                            </span>
                            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                              Active CV: {activeCv?.jobTitle || activeCv?.fileName}
                            </span>
                          </div>

                          <p className="text-xs text-[var(--muted-foreground)] font-sans leading-relaxed">
                            {analysis.explanation}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {/* Matched skills */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">
                                ✓ Validated Skills ({analysis.matchedRequirements.length})
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {analysis.matchedRequirements.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono"
                                  >
                                    {m.requirement}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Missing skills */}
                            {analysis.missingRequirements.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">
                                  △ Missing / To Develop ({analysis.missingRequirements.length})
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {analysis.missingRequirements.map((m, mIdx) => (
                                    <span
                                      key={mIdx}
                                      className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono"
                                    >
                                      {m.requirement}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              );
            })}
          </div>
        )}

      </section>

      {/* =========================================================================
          JOB DETAIL SLIDEOVER DRAWER
          ========================================================================= */}
      <JobDetailDrawer
        job={inspectedJob}
        activeCv={activeCv}
        allCvs={cvs}
        existingApplication={applications.find(a => a.jobId === inspectedJob?.id)}
        matchAnalysis={inspectedJob ? jobAnalyses.get(inspectedJob.id) : undefined}
        onClose={() => setInspectedJob(null)}
        onApply={async (jobId, cvId) => {
          await handleApplyToJob(jobId, cvId);
          setInspectedJob(null);
        }}
        onStartInterview={handleStartInterview}
        onSelectCv={(cvId) => setSelectedCvId(cvId)}
      />

    </div>
  );
};

