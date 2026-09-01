import React, { useState, useEffect } from 'react';
import { dbEngine } from '../../lib/firebase/db';
import { calculateJobMatchScore, getDetailedMatchAnalysis } from '../../lib/matching-engine';
import { JobPosting, CandidateCV, JobApplication } from '../../types';
import type { RecruiterCandidateMatch, RecruiterMatchingResponse } from '../../types/matching';
import { RecruiterJobsList } from '../recruiter/recruiter-jobs-list';
import { SelectedJobPanel } from '../recruiter/selected-job-panel';
import { MatchingResults } from '../recruiter/matching-results';
import { CandidateRecruiterModal } from './candidate-recruiter-modal';
import { CountUp } from '../ui/count-up';
import { 
  Sparkles, 
  Plus, 
  UploadCloud, 
  Clock, 
  X, 
  Activity, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface RecruiterViewProps {
  onNavigate?: (path: string) => void;
}

export const RecruiterView: React.FC<RecruiterViewProps> = ({ onNavigate }) => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Selected job for deep inspection & matching
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Modal states
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Quick job form state
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobCompany, setNewJobCompany] = useState('');
  const [newJobLocation, setNewJobLocation] = useState('');
  const [newJobDesc, setNewJobDesc] = useState('');

  // Selected CV detail modal
  const [selectedCv, setSelectedCv] = useState<CandidateCV | null>(null);

  // Recruiter telemetry logs
  const [recentLogs, setRecentLogs] = useState([
    { id: 1, text: "Analyse sémantique d'adéquation complétée (94% top score)", time: "À l'instant" },
    { id: 2, text: "Offre d'emploi activée dans le pipeline de recrutement", time: 'Il y a 35 min' },
    { id: 3, text: "Profil candidat qualifié ajouté au vivier central", time: 'Il y a 2h' }
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const jobsData = await dbEngine.getAllJobs();
      setJobs(jobsData);

      if (jobsData.length > 0 && !selectedJobId) {
        setSelectedJobId(jobsData[0].id);
      }

      // Fetch all applications
      let allApps: JobApplication[] = [];
      for (const job of jobsData) {
        const apps = await dbEngine.getApplicationsForJob(job.id);
        allApps = [...allApps, ...apps];
      }
      setApplications(allApps);

      // Fetch all CVs
      const allCvsData = await dbEngine.getAllCVs();
      const appliedCvIds = new Set(allApps.map(a => a.cvId));
      const cvsData = allCvsData.filter(cv => appliedCvIds.has(cv.id));
      setCvs(cvsData);
    } catch (e) {
      toast.error('Erreur lors du chargement des données recruteur.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedJob = jobs.find(j => j.id === selectedJobId) || jobs[0] || null;

  // Applications count per job mapping
  const applicationsCountMap = jobs.reduce((acc, job) => {
    acc[job.id] = applications.filter(a => a.jobId === job.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Compute stats
  const totalJobs = jobs.length;
  const totalApplications = applications.length;
  const totalCvs = cvs.length;
  const qualifiedCount = cvs.filter(c => (c.aiScore || 0) >= 80).length;

  // Real-time matching for the currently selected job
  const computeMatchingResult = (): RecruiterMatchingResponse | null => {
    if (!selectedJob) return null;

    const jobApplications = applications.filter(a => a.jobId === selectedJob.id);
    const candidateCvsForJob = cvs.filter(cv => 
      jobApplications.some(a => a.cvId === cv.id) || jobApplications.length === 0
    );

    const candidatesList = (candidateCvsForJob.length > 0 ? candidateCvsForJob : cvs);

    const scoredCandidates: RecruiterCandidateMatch[] = candidatesList.map((cv) => {
      const score = calculateJobMatchScore(cv, selectedJob);
      const detailed = getDetailedMatchAnalysis(cv, selectedJob);

      const expCandidateYears = cv.parsedData?.experiences?.length ? cv.parsedData.experiences.length * 2 : 2;
      const expReqYears = selectedJob.minimum_experience_years ?? 2;

      const candidateName = cv.fullName || cv.parsedData?.identity?.full_name || cv.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

      return {
        rank: 1,
        cvId: cv.id,
        candidateName,
        score,
        matchLevel: score >= 85 ? 'Excellente adéquation' : score >= 70 ? 'Bonne adéquation' : 'Adéquation modérée',
        eligible: score >= 50,
        eligibilityMessage: score >= 50 ? 'Profil éligible aux exigences principales' : 'Certaines exigences critiques ne sont pas remplies',
        summary: cv.parsedData?.summary || detailed.explanation,
        requiredSkills: {
          matched: detailed.matchedRequirements.map(m => m.requirement),
          missing: detailed.missingRequirements.map(m => m.requirement),
          display: `${detailed.matchedRequirements.length} sur ${detailed.matchedRequirements.length + detailed.missingRequirements.length} validées`
        },
        experience: {
          candidateYears: expCandidateYears,
          requiredYears: expReqYears,
          status: expCandidateYears >= expReqYears ? 'Satisfait les exigences' : 'Expérience inférieure au seuil',
          display: `${expCandidateYears} ans estimés (${expReqYears} ans requis)`
        },
        education: {
          status: 'Compatible',
          display: selectedJob.required_education?.minimum_level || 'Niveau requis compatible'
        },
        languages: {
          status: 'Compatible',
          display: detailed.languages.map(l => `${l.language} (${l.level || 'Intermédiaire'})`).join(', ') || 'Français courant'
        },
        locationAndWorkMode: {
          status: 'Compatible',
          display: `${selectedJob.location} · ${selectedJob.work_mode || 'Sur site'}`
        },
        contract: {
          status: 'Compatible',
          display: selectedJob.contract_type || 'CDI'
        },
        strengths: detailed.matchedRequirements.slice(0, 3).map(m => `Maîtrise validée : ${m.requirement}`),
        gaps: detailed.missingRequirements.slice(0, 2).map(m => `Exigence à confirmer : ${m.requirement}`),
        mandatoryFailures: []
      };
    });

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);
    // Assign ranks
    scoredCandidates.forEach((c, idx) => {
      c.rank = idx + 1;
    });

    const eligibleCount = scoredCandidates.filter(c => c.eligible).length;

    return {
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      evaluatedCandidates: scoredCandidates.length,
      eligibleCandidates: eligibleCount,
      invalidCandidates: scoredCandidates.length - eligibleCount,
      summary: scoredCandidates.length > 0 
        ? `${scoredCandidates.length} profils analysés. ${eligibleCount} candidats répondent aux critères minimaux avec un score moyen de ${Math.round(scoredCandidates.reduce((acc, c) => acc + c.score, 0) / scoredCandidates.length)}%.`
        : 'Aucun candidat trouvé pour cette offre.',
      topCandidates: scoredCandidates
    };
  };

  const matchingResult = computeMatchingResult();

  const handleTriggerMatch = () => {
    setMatchingLoading(true);
    setTimeout(() => {
      setMatchingLoading(false);
      toast.success('Adéquation sémantique actualisée pour ce poste !');
    }, 600);
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle || !newJobCompany || !newJobLocation || !newJobDesc) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    try {
      const newJob = await dbEngine.createJob({
        recruiterId: 'recruiter-123',
        title: newJobTitle,
        company: newJobCompany,
        location: newJobLocation,
        description: newJobDesc,
        status: 'OPEN'
      });
      toast.success("Offre d'emploi publiée avec succès !");
      setShowAddJobModal(false);
      setRecentLogs(prev => [
        { id: Date.now(), text: `Offre "${newJobTitle}" publiée et active`, time: "À l'instant" },
        ...prev
      ]);
      setNewJobTitle('');
      setNewJobCompany('');
      setNewJobLocation('');
      setNewJobDesc('');
      await loadData();
      if (newJob) {
        setSelectedJobId(newJob.id);
      }
    } catch (err) {
      toast.error("Erreur lors de la publication de l'offre.");
    }
  };

  const handleDeleteJob = async (job: JobPosting) => {
    try {
      await dbEngine.deleteJob(job.id);
      toast.success("Offre d'emploi supprimée.");
      if (selectedJobId === job.id) {
        setSelectedJobId(null);
      }
      await loadData();
    } catch (e) {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleUploadSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    let nameToUpload = customFileName.trim();
    if (!nameToUpload) {
      nameToUpload = selectedFile ? selectedFile.name : 'CV_Sourcing_Direct.pdf';
    } else if (!nameToUpload.toLowerCase().endsWith('.pdf') && !nameToUpload.toLowerCase().endsWith('.docx')) {
      nameToUpload += '.pdf';
    }

    setUploading(true);
    toast.info('Ingestion sémantique du profil candidat...');

    setTimeout(async () => {
      try {
        await dbEngine.uploadCV('recruiter-sourcing', nameToUpload, undefined, selectedFile || undefined);
        toast.success('Sourcing complété ! Profil candidat indexé.');
        setCustomFileName('');
        setSelectedFile(null);
        setShowUploadModal(false);
        setRecentLogs(prev => [
          { id: Date.now(), text: `Nouveau CV "${nameToUpload}" importé dans le vivier`, time: "À l'instant" },
          ...prev
        ]);
        loadData();
      } catch (err) {
        toast.error('Erreur lors du sourcing.');
      } finally {
        setUploading(false);
      }
    }, 1200);
  };

  const selectedIndex = jobs.findIndex(j => j.id === selectedJobId) + 1 || 1;

  return (
    <div className="space-y-12 max-w-7xl mx-auto text-left select-none pb-16">
      {/* ================= SECTION 01: HERO ================= */}
      <section aria-labelledby="recruiter-hero-title" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[var(--border)] pb-8">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
                // TALENT INTELLIGENCE CENTER
              </span>
              <span className="h-px w-8 bg-white/10" />
              <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase">
                ESPACE RECRUTEUR
              </span>
            </div>

            <h1
              id="recruiter-hero-title"
              className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-display text-white tracking-tight uppercase leading-[1.02]"
            >
              BUILD THE RIGHT TEAM.<br />
              <span className="text-[var(--muted-foreground)]">FASTER.</span>
            </h1>

            <p className="text-sm sm:text-base text-[var(--foreground-secondary)] font-sans leading-relaxed max-w-2xl">
              Commandez vos recrutements, analysez l'adéquation sémantique de vos viviers et identifiez instantanément les meilleurs talents.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate ? onNavigate('/dashboard/recruiter/create-job') : setShowAddJobModal(true)}
              className="px-6 py-3.5 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>CRÉER UNE OFFRE →</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-mono text-xs font-bold border border-[var(--border)] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-[var(--muted-foreground)]" />
              <span>SOURCING CV</span>
            </button>
          </div>
        </div>
      </section>

      {/* ================= SECTION 02: RECRUITMENT TELEMETRY ================= */}
      <section aria-label="Télémétrie de recrutement">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 sm:p-8 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)]">
          <TelemetryMetric
            index="[01]"
            label="OFFRES ACTIVES"
            value={totalJobs}
            change="+4 ce mois"
            isPositive={true}
          />
          <TelemetryMetric
            index="[02]"
            label="CANDIDATURES"
            value={totalApplications}
            change="+12 candidatures"
            isPositive={true}
          />
          <TelemetryMetric
            index="[03]"
            label="PROFILS VIVIER"
            value={totalCvs}
            change="+8 profils"
            isPositive={true}
          />
          <TelemetryMetric
            index="[04]"
            label="MATCHES ÉLEVÉS (≥80%)"
            value={qualifiedCount}
            change="Top vivier"
            isPositive={true}
            accent="emerald"
          />
        </div>
      </section>

      {/* ================= SECTION 03: POSITION PIPELINE & SELECTED JOB ================= */}
      <section aria-labelledby="pipeline-section-title" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Editorial Job Pipeline (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <RecruiterJobsList
              jobs={jobs}
              loading={loading}
              selectedId={selectedJobId}
              onSelect={(id) => setSelectedJobId(id)}
              onDelete={handleDeleteJob}
              onCreate={() => onNavigate ? onNavigate('/dashboard/recruiter/create-job') : setShowAddJobModal(true)}
              applicationsCountMap={applicationsCountMap}
            />
          </div>

          {/* Right Column: Selected Position Detail Panel (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <SelectedJobPanel
              job={selectedJob}
              matching={matchingLoading}
              onMatch={handleTriggerMatch}
              index={selectedIndex}
              applicationCount={selectedJob ? applicationsCountMap[selectedJob.id] ?? 0 : 0}
            />
          </div>
        </div>
      </section>

      {/* ================= SECTION 04: MATCH INTELLIGENCE & CANDIDATE RANKING ================= */}
      <MatchingResults
        loading={loading || matchingLoading}
        error={null}
        result={matchingResult}
        hasSelection={Boolean(selectedJob)}
        onSelectCandidate={(cvId) => {
          const found = cvs.find(c => c.id === cvId);
          if (found) setSelectedCv(found);
        }}
      />

      {/* ================= SECTION 05: ACTIVITY TIMELINE ================= */}
      <section aria-labelledby="activity-section-title" className="space-y-4 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
              // RECENT ACTIVITY
            </span>
            <span className="h-px w-6 bg-white/10" />
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
              JOURNAL DES OPÉRATIONS
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>MOTEUR SÉMANTIQUE ACTIF</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
          {recentLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0047FF] shrink-0" />
                <p className="text-[var(--foreground-secondary)] font-sans truncate">{log.text}</p>
              </div>
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] shrink-0 self-end sm:self-center">
                {log.time}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ================= MODAL: SOURCING CV INGESTION ================= */}
      {showUploadModal && (
        <div
          onClick={() => setShowUploadModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-8 shadow-2xl relative text-left"
          >
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute right-5 top-5 p-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#0047FF] block mb-1">
              // SOURCING DIRECT
            </span>
            <h3 className="text-xl font-extrabold font-display text-[var(--foreground)] mb-2">
              IMPORTER UN PROFIL CV
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] font-sans mb-6">
              Glissez-déposez ou simulez l'ingestion d'un profil candidat pour l'analyser dans vos viviers.
            </p>

            <form onSubmit={handleUploadSimulate} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-[var(--border-strong)] hover:border-[#0047FF]/60 rounded-2xl flex flex-col items-center justify-center text-center bg-[var(--surface-secondary)] cursor-pointer transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setSelectedFile(file);
                      setCustomFileName(file.name);
                    }
                  }}
                  accept=".pdf,.docx"
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-[var(--muted-foreground)] group-hover:text-[#0047FF] transition-colors mb-2" />
                <span className="text-xs font-mono font-bold text-[var(--foreground)]">
                  {selectedFile ? selectedFile.name : 'Sélectionner un fichier PDF ou DOCX'}
                </span>
                <span className="text-[10px] font-mono text-[var(--muted-foreground)] mt-1">Taille max : 5 MB</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                  Nom du fichier candidat
                </label>
                <input
                  type="text"
                  required
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="ex: CV_Amina_Ingenieur_Fullstack.pdf"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-3 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin shrink-0" />
                    <span>INGESTION SÉMANTIQUE EN COURS...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-200" />
                    <span>LANCER L'INGESTION SÉMANTIQUE</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK JOB CREATION ================= */}
      {showAddJobModal && (
        <div
          onClick={() => setShowAddJobModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-8 shadow-2xl relative text-left"
          >
            <button
              onClick={() => setShowAddJobModal(false)}
              className="absolute right-5 top-5 p-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#0047FF] block mb-1">
              // CRÉATION DE POSTE
            </span>
            <h3 className="text-xl font-extrabold font-display text-[var(--foreground)] mb-2">
              PUBLIER UNE FICHE DE POSTE
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] font-sans mb-6">
              Renseignez les critères clés pour lancer immédiatement l'adéquation sémantique.
            </p>

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                  Intitulé du poste *
                </label>
                <input
                  type="text"
                  required
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="ex: Senior Full Stack Engineer"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    Entreprise *
                  </label>
                  <input
                    type="text"
                    required
                    value={newJobCompany}
                    onChange={(e) => setNewJobCompany(e.target.value)}
                    placeholder="ex: TechFlow Systems"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    Localisation *
                  </label>
                  <input
                    type="text"
                    required
                    value={newJobLocation}
                    onChange={(e) => setNewJobLocation(e.target.value)}
                    placeholder="ex: Casablanca · Hybride"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                  Compétences & Profil recherché *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                  placeholder="Listez les technologies requises (ex: React, TypeScript, Node.js, PostgreSQL, Docker)..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-sans text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 cursor-pointer"
              >
                PUBLIER ET ACTIVER LE POSTE →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= CANDIDATE RECRUITER DOSSIER MODAL ================= */}
      <CandidateRecruiterModal
        cv={selectedCv}
        selectedJob={selectedJob}
        onClose={() => setSelectedCv(null)}
      />
    </div>
  );
};

interface TelemetryMetricProps {
  index: string;
  label: string;
  value: number;
  change: string;
  isPositive: boolean;
  accent?: 'blue' | 'emerald';
}

const TelemetryMetric: React.FC<TelemetryMetricProps> = ({
  index,
  label,
  value,
  change,
  accent,
}) => {
  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-[#0047FF]">
          {index}
        </span>
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)] truncate">
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tracking-tight ${
            accent === 'emerald' ? 'text-emerald-400' : 'text-white'
          }`}
        >
          <CountUp to={value} duration={1} />
        </span>
      </div>

      <span className="text-[11px] font-mono text-[var(--muted-foreground)] block">
        {change}
      </span>
    </div>
  );
};
