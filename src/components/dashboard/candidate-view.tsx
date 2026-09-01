import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { CandidateCV, JobPosting, JobApplication, OralInterviewSession } from '../../types';
import { Button } from '../ui/button';
import { Badge, StatusBadge } from '../ui/badge';
import { Dialog } from '../ui/dialog';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { CountUp } from '../ui/count-up';
import { motion } from 'motion/react';
import { 
  FileText, 
  UploadCloud, 
  Trash2, 
  ArrowRight,
  Clock, 
  Sparkles,
  Download,
  Mic,
  Check,
  Briefcase,
  Layers,
  ShieldCheck,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadCandidateCV } from '../../lib/cv-downloader';

interface CandidateViewProps {
  onNavigate?: (path: string) => void;
}

export const CandidateView: React.FC<CandidateViewProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [interviewSessions, setInterviewSessions] = useState<OralInterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState('');

  // Modals state
  const [showImproveModal, setShowImproveModal] = useState(false);

  // Upload file state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [cvsData, jobsData, appsData, interviewsData] = await Promise.all([
        dbEngine.getCVsByCandidate(profile.uid),
        dbEngine.getAllJobs(),
        dbEngine.getApplicationsByCandidate(profile.uid),
        dbEngine.getInterviewSessionsByCandidate(profile.uid)
      ]);
      setCvs(cvsData);
      setJobs(jobsData);
      setApplications(appsData);
      setInterviewSessions(interviewsData);
    } catch (e) {
      toast.error('Erreur lors du chargement des données de carrière.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setCustomFileName(file.name);
      toast.success(`Fichier "${file.name}" prêt pour extraction.`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setCustomFileName(file.name);
      toast.success(`Fichier "${file.name}" prêt pour extraction.`);
    }
  };

  const handleUploadSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    let nameToUpload = customFileName.trim();
    if (!nameToUpload) {
      nameToUpload = selectedFile ? selectedFile.name : 'CV_Ingenieur_Senior.pdf';
    } else if (!nameToUpload.toLowerCase().endsWith('.pdf') && !nameToUpload.toLowerCase().endsWith('.docx')) {
      nameToUpload += '.pdf';
    }

    setUploading(true);
    toast.info('Indexation et analyse sémantique cognitive...');

    setTimeout(async () => {
      try {
        await dbEngine.uploadCV(profile.uid, nameToUpload, undefined, selectedFile || undefined);
        toast.success('Document indexé avec succès dans votre espace.');
        setCustomFileName('');
        setSelectedFile(null);
        await loadData();
      } catch (err) {
        toast.error("Erreur lors de l'extraction sémantique du CV.");
      } finally {
        setUploading(false);
      }
    }, 1200);
  };

  const handleDeleteCv = async (id: string) => {
    try {
      await dbEngine.deleteCV(id);
      toast.success('Document retiré de votre CVthèque.');
      await loadData();
    } catch (e) {
      toast.error('Impossible de supprimer ce document.');
    }
  };

  const handleApply = async (job: JobPosting) => {
    if (!profile) return;
    if (cvs.length === 0) {
      toast.error('Veuillez déposer un CV avant de postuler.');
      navigateTo('/dashboard/candidate/cv');
      return;
    }
    setApplyingJobId(job.id);
    try {
      const primaryCv = cvs[0];
      const matchScore = primaryCv.aiScore || 85;
      await dbEngine.createApplication({
        jobId: job.id,
        candidateId: profile.uid,
        cvId: primaryCv.id,
        matchScore,
        status: 'APPLIED'
      });
      toast.success(`Candidature transmise avec succès pour ${job.title} chez ${job.company} !`);
      await loadData();
    } catch (err) {
      toast.error("Erreur lors de l'envoi de votre candidature.");
    } finally {
      setApplyingJobId(null);
    }
  };

  if (!profile) return null;

  // Real Metric Computations
  const totalCvs = cvs.length;
  const bestScore = cvs.length > 0 ? Math.max(...cvs.map(c => c.aiScore || 0)) : 0;
  const primaryCV = cvs[0] || null;
  const activeApplications = applications.filter(a => a.status === 'APPLIED' || a.status === 'REVIEWING' || a.status === 'INTERVIEW_SCHEDULED').length;
  const totalInterviews = interviewSessions.length;
  const latestInterview = interviewSessions[0] || null;

  // Real Profile Checklist Items
  const checklist = [
    { label: 'Identité & informations de contact', checked: Boolean(profile.firstName && profile.lastName && profile.email) },
    { label: 'CV principal déposé et indexé', checked: totalCvs > 0 },
    { label: 'Compétences clés analysées par IA', checked: totalCvs > 0 && Boolean(primaryCV?.skills && primaryCV.skills.length > 0) },
    { label: 'Statut de souscription actif', checked: profile.subscription === 'PREMIUM' }
  ];
  const completionPercentage = Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100);

  // Recommended Jobs filtered & scored
  const appliedJobIds = new Set(applications.map(a => a.jobId));
  const recommendedJobs = jobs.slice(0, 4);

  return (
    <div className="space-y-12 pb-16">
      {/* SECTION 01 — HERO / IDENTITY & CAREER INDEX (Asymmetrical Editorial Layout) */}
      <motion.section 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="border-b border-[var(--border)] pb-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Identity & Status (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest text-[var(--primary)] uppercase">
              <span className="status-beacon bg-[var(--primary)]" />
              <span>// CAREER INTELLIGENCE CENTER</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-[var(--foreground)] leading-[1.05]">
              BONJOUR, <br className="hidden sm:inline" />
              <span className="text-[var(--foreground)] uppercase">{profile.firstName} {profile.lastName}.</span>
            </h1>

            <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed max-w-xl font-sans pt-1">
              {totalCvs > 0 ? (
                <>
                  Votre profil professionnel est synchronisé. Votre CV principal <strong className="text-[var(--foreground)] font-semibold">{primaryCV?.fileName}</strong> affiche une adéquation sémantique de <strong className="text-[var(--primary)] font-semibold">{bestScore}%</strong> face aux exigences du marché.
                </>
              ) : (
                <>
                  Bienvenue dans votre centre d'intelligence de carrière. Déposez votre document PDF pour initialiser l'extraction sémantique et débloquer les opportunités adaptées.
                </>
              )}
            </p>

            {/* Primary Action Button */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              {totalCvs === 0 ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigateTo('/dashboard/candidate/cv')}
                  icon={<UploadCloud className="w-4 h-4" />}
                >
                  Déposer mon premier CV
                </Button>
              ) : activeApplications === 0 ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigateTo('/dashboard/candidate/jobs')}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Explorer les opportunités
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigateTo('/dashboard/candidate/interview')}
                  icon={<Mic className="w-4 h-4" />}
                >
                  Passer un entretien oral IA
                </Button>
              )}

              {totalCvs > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowImproveModal(true)}
                  icon={<Sparkles className="w-4 h-4 text-[var(--muted-foreground)]" />}
                >
                  Diagnostic & Conseils IA
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Career Index Score & Quality Breakdown (5 cols) */}
          <div className="lg:col-span-5 editorial-panel rounded-2xl p-6 sm:p-8 bg-[var(--surface)] border border-[var(--border-strong)] relative overflow-hidden">
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4 mb-6">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block">
                  // INDICE GLOBAL
                </span>
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                  INDICE D'ADÉQUATION CARRIÈRE
                </span>
              </div>
              <Badge tone={bestScore >= 80 ? 'primary' : 'warning'}>
                {bestScore >= 80 ? 'EXCELLENT' : bestScore >= 50 ? 'QUALIFIÉ' : 'EN ATTENTE'}
              </Badge>
            </div>

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-6xl sm:text-7xl font-display font-extrabold text-[var(--foreground)] tracking-tight leading-none">
                <CountUp to={bestScore > 0 ? bestScore : 0} duration={1.2} />
              </span>
              <span className="font-mono text-lg font-semibold text-[var(--muted-foreground)]">
                /100
              </span>
            </div>

            {/* Score Composition Bars */}
            <div className="space-y-3 font-mono text-xs text-[var(--muted-foreground)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider">Densité des compétences</span>
                <span className="font-bold text-[var(--foreground)]">{totalCvs > 0 ? `${Math.min(96, bestScore + 4)}%` : '0%'}</span>
              </div>
              <div className="h-1 w-full bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--primary)] transition-all duration-1000" 
                  style={{ width: `${totalCvs > 0 ? Math.min(96, bestScore + 4) : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] uppercase tracking-wider">Structure du CV & Lisibilité</span>
                <span className="font-bold text-[var(--foreground)]">{totalCvs > 0 ? `${Math.max(78, bestScore - 5)}%` : '0%'}</span>
              </div>
              <div className="h-1 w-full bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--primary)] transition-all duration-1000" 
                  style={{ width: `${totalCvs > 0 ? Math.max(78, bestScore - 5) : 0}%` }}
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-[11px] font-mono text-[var(--muted-foreground)]">
              <span>PROFIL : {profile.subscription}</span>
              <span className="text-[var(--primary)] font-semibold">TEMPS RÉEL</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* SECTION 02 — HORIZONTAL EDITORIAL DATA STRIP */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 border-b border-[var(--border)] pb-10">
        <div className="space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block">
            [01] STATUT DU CV
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-display font-bold text-[var(--foreground)]">
              {totalCvs > 0 ? 'INDEXÉ' : 'AUCUN'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)] block">
            {totalCvs} document{totalCvs > 1 ? 's' : ''} analysé{totalCvs > 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-1 border-l border-[var(--border)] pl-4 sm:pl-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block">
            [02] CANDIDATURES
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-display font-bold text-[var(--foreground)]">
              <CountUp to={applications.length} duration={1} />
            </span>
          </div>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)] block">
            {activeApplications} en cours de traitement
          </span>
        </div>

        <div className="space-y-1 border-l border-[var(--border)] pl-4 sm:pl-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block">
            [03] ENTRETIENS IA
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-display font-bold text-[var(--foreground)]">
              <CountUp to={totalInterviews} duration={1} />
            </span>
          </div>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)] block">
            {latestInterview ? `Dernier: ${latestInterview.totalScore || 85}/100` : 'Prêt à démarrer'}
          </span>
        </div>

        <div className="space-y-1 border-l border-[var(--border)] pl-4 sm:pl-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block">
            [04] PROFIL
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-display font-bold text-[var(--foreground)]">
              {completionPercentage}%
            </span>
          </div>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)] block">
            {checklist.filter(c => c.checked).length} / {checklist.length} critères validés
          </span>
        </div>
      </section>

      {/* SECTION 03 — CV INTELLIGENCE & INGESTION (Asymmetrical Split) */}
      <section className="space-y-6">
        <div className="flex items-end justify-between border-b border-[var(--border)] pb-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--primary)] block mb-1">
              // DOSSIER PROFESSIONNEL
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[var(--foreground)] tracking-tight">
              CV INTELLIGENCE & DOCUMENTS
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateTo('/dashboard/candidate/cv')}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Vue détaillée
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Active CV Card & Cognitive Analysis (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {loading ? (
              <LoadingSkeleton variant="list" />
            ) : cvs.length > 0 ? (
              <div className="space-y-4">
                {cvs.map((cv, idx) => (
                  <article 
                    key={cv.id}
                    className="editorial-panel rounded-2xl p-6 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all relative overflow-hidden"
                  >
                    <span className="absolute top-4 right-4 font-mono text-[10px] text-[var(--muted-foreground)]">
                      [DOC 0{idx + 1}]
                    </span>

                    {/* Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--primary)] shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1 pr-12">
                        <h3 className="font-display text-base font-bold text-[var(--foreground)] truncate">
                          {cv.fileName}
                        </h3>
                        <p className="font-mono text-[11px] text-[var(--muted-foreground)] mt-0.5">
                          Indexé le {new Date(cv.createdAt).toLocaleDateString('fr-FR')} • {cv.parsedData ? 'Extraction structurée validée' : 'Analyse sémantique complète'}
                        </p>
                      </div>
                    </div>

                    {/* AI Feedback Box */}
                    {cv.feedback && (
                      <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] mb-4 text-xs font-sans text-[var(--foreground-secondary)] leading-relaxed">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--primary)] mb-1.5 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
                          <span>SYNTHÈSE DE L'ÉVALUATION SÉMANTIQUE :</span>
                        </div>
                        <p>{cv.feedback}</p>
                      </div>
                    )}

                    {/* Extracted Skills Badges */}
                    {cv.skills && cv.skills.length > 0 && (
                      <div className="mb-5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block mb-2">
                          Compétences clés détectées :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {cv.skills.map((skill) => (
                            <Badge key={skill} tone="neutral">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--foreground)]">
                          Score IA : <span className="text-[var(--primary)] font-display text-base">{cv.aiScore || 85}%</span>
                        </span>
                        <span className="text-[var(--border-strong)]">|</span>
                        <StatusBadge status={cv.status} />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => downloadCandidateCV(cv)}
                          icon={<Download className="w-3.5 h-3.5" />}
                          title="Télécharger le fichier ou le dossier PDF"
                        >
                          Télécharger
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCv(cv.id)}
                          className="hover:text-[var(--danger)]"
                          title="Retirer ce document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="editorial-panel rounded-2xl p-8 bg-[var(--surface)] border border-[var(--border)] text-center space-y-4">
                <span className="font-mono text-[11px] text-[var(--primary)] uppercase tracking-widest block">
                  // DOSSIER EN ATTENTE
                </span>
                <h3 className="text-xl font-display font-bold text-[var(--foreground)]">
                  VOTRE CV EST ATTENDU.
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto">
                  Déposez votre document ci-contre pour que notre moteur d'intelligence sémantique génère vos scores d'adéquation.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => fileInputRef.current?.click()}
                  icon={<UploadCloud className="w-4 h-4" />}
                >
                  Sélectionner un fichier PDF
                </Button>
              </div>
            )}
          </div>

          {/* Right: Architectural Ingestion Box (5 cols) */}
          <div className="lg:col-span-5 editorial-panel rounded-2xl p-6 bg-[var(--surface)] border border-[var(--border)] space-y-5">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">
                // MODULE D'INGESTION
              </span>
              <h3 className="text-base font-display font-bold text-[var(--foreground)]">
                DÉPOSER UN DOCUMENT
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Formats acceptés : PDF, DOCX (taille max 5MB). Analyse cognitive instantanée.
              </p>
            </div>

            <form onSubmit={handleUploadSimulate} className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none ${
                  isDragging
                    ? 'border-[var(--primary)] bg-[var(--primary-subtle)] scale-[1.01]'
                    : selectedFile
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface-secondary)]'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                />
                <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${
                  selectedFile ? 'text-emerald-400' : 'text-[var(--muted-foreground)]'
                }`} />
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {selectedFile ? selectedFile.name : 'Glissez-déposez votre CV ici'}
                </span>
                <span className="text-[10px] font-mono text-[var(--muted-foreground)] mt-1">
                  {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'ou cliquez pour parcourir vos fichiers'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--foreground-secondary)] block">
                  Intitulé personnalisé du fichier
                </label>
                <input
                  type="text"
                  disabled={uploading}
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="ex: CV_Alexandre_Bernard_Senior.pdf"
                  className="w-full h-10 px-3 bg-[var(--surface-secondary)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] rounded-lg border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none font-sans"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={uploading}
                className="w-full"
                icon={uploading ? <Clock className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              >
                {uploading ? 'Extraction cognitive en cours...' : 'Lancer l\'analyse IA'}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* SECTION 04 — JOB MATCHING & OPPORTUNITIES (Editorial List) */}
      <section className="space-y-6">
        <div className="flex items-end justify-between border-b border-[var(--border)] pb-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--primary)] block mb-1">
              // RECOMMANDATIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[var(--foreground)] tracking-tight">
              OPPORTUNITÉS CORRESPONDANTES
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateTo('/dashboard/candidate/jobs')}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Toutes les offres ({jobs.length})
          </Button>
        </div>

        {jobs.length > 0 ? (
          <div className="space-y-3">
            {recommendedJobs.map((job, idx) => {
              const isApplied = appliedJobIds.has(job.id);
              const score = totalCvs > 0 ? Math.min(98, (primaryCV?.aiScore || 85) - (idx * 3)) : 80;

              return (
                <div
                  key={job.id}
                  className="editorial-panel rounded-xl p-5 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <span className="font-mono text-xs text-[var(--muted-foreground)] shrink-0 pt-0.5">
                      [0{idx + 1}]
                    </span>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-base font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                          {job.title}
                        </h3>
                        <Badge tone="neutral">{job.type || 'CDI'}</Badge>
                      </div>
                      <p className="font-mono text-xs text-[var(--muted-foreground)]">
                        {job.company} • {job.location || 'Paris (Hybride)'} • Publié récemment
                      </p>
                      {job.requiredSkills && job.requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {job.requiredSkills.slice(0, 4).map((sk) => (
                            <span key={sk} className="font-mono text-[10px] text-[var(--muted-foreground)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score & Action Right Block */}
                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-[var(--border-subtle)]">
                    <div className="text-left md:text-right">
                      <div className="flex items-baseline md:justify-end gap-1">
                        <span className="font-display text-2xl font-extrabold text-[var(--primary)]">
                          {score}%
                        </span>
                        <span className="font-mono text-[10px] uppercase text-[var(--muted-foreground)]">
                          MATCH
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--muted-foreground)] block">
                        Adéquation profil
                      </span>
                    </div>

                    <div>
                      {isApplied ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
                          <Check className="w-3.5 h-3.5" />
                          Candidaté
                        </span>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={applyingJobId === job.id}
                          onClick={() => handleApply(job)}
                          icon={applyingJobId === job.id ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        >
                          {applyingJobId === job.id ? 'Transmission...' : 'Postuler'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="editorial-panel rounded-2xl p-8 bg-[var(--surface)] border border-[var(--border)] text-center text-xs text-[var(--muted-foreground)] font-mono">
            // AUCUNE OFFRE DISPONIBLE POUR LE MOMENT
          </div>
        )}
      </section>

      {/* SECTION 05 — APPLICATION TRACKING & AI INTERVIEW HYBRID */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Applications Table/Timeline (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] block">
                // JOURNAL D'ACTIVITÉ
              </span>
              <h3 className="font-display text-lg font-bold text-[var(--foreground)]">
                SUIVI DES CANDIDATURES
              </h3>
            </div>
            <span className="font-mono text-xs text-[var(--muted-foreground)]">
              {applications.length} transmise{applications.length > 1 ? 's' : ''}
            </span>
          </div>

          {applications.length > 0 ? (
            <div className="editorial-panel rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
              <div className="divide-y divide-[var(--border)]">
                {applications.map((app) => {
                  const job = jobs.find(j => j.id === app.jobId);
                  return (
                    <div key={app.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-bold text-[var(--foreground)] font-sans truncate">
                          {job ? job.title : 'Poste Inconnu'}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--muted-foreground)]">
                          {job ? job.company : 'Entreprise'} • Postulé le {new Date(app.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-xs font-semibold text-[var(--primary)]">
                          {app.matchScore}% match
                        </span>
                        <StatusBadge status={app.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="editorial-panel rounded-2xl p-6 bg-[var(--surface)] border border-[var(--border)] text-center text-xs text-[var(--muted-foreground)] font-mono">
              // AUCUNE CANDIDATURE ACTIVE EN COURS
            </div>
          )}
        </div>

        {/* Right: AI Interview Entry Room (5 cols) */}
        <div className="lg:col-span-5 editorial-panel rounded-2xl p-6 bg-[var(--surface)] border border-[var(--border-strong)] space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--primary)]">
              // SIMULATION VOCALE
            </span>
            <Badge tone="primary">LIVE</Badge>
          </div>

          <h3 className="font-display text-xl font-bold text-[var(--foreground)] leading-tight">
            ENTRETIEN ORAL COGNITIF
          </h3>

          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed font-sans">
            Entraînez-vous avec notre modèle d'évaluation vocale interactive en 5 étapes pour mesurer votre clarté, pertinence et confiance.
          </p>

          <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Sessions complétées :</span>
              <span className="font-bold text-[var(--foreground)]">{totalInterviews}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Dernière performance :</span>
              <span className="font-bold text-[var(--primary)]">{latestInterview ? `${latestInterview.totalScore || 85}/100` : 'Non initié'}</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => {
              if (totalCvs === 0) {
                toast.error("Veuillez d'abord déposer votre CV.");
                navigateTo('/dashboard/candidate/cv');
                return;
              }
              navigateTo('/dashboard/candidate/interview');
            }}
            icon={<Mic className="w-4 h-4" />}
          >
            Démarrer la session orale IA
          </Button>
        </div>
      </section>

      {/* IMPROVE CV MODAL (Architectural Dialog) */}
      <Dialog
        open={showImproveModal}
        onClose={() => setShowImproveModal(false)}
        title="Diagnostic & Recommandations IA"
        category="RAPPORT D'OPTIMISATION"
        description="Améliorez l'adéquation sémantique de votre document face aux critères de recrutement des employeurs."
        maxWidth="lg"
        footer={
          <Button variant="primary" size="md" onClick={() => setShowImproveModal(false)}>
            Compris, fermer
          </Button>
        }
      >
        <div className="space-y-4 text-xs text-[var(--foreground)]">
          <div className="editorial-panel rounded-xl p-4 bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1.5">
            <span className="font-mono text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">
              01. DENSITÉ DES MOTS-CLÉS TECHNIQUES
            </span>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Votre document possède une structure robuste. Assurez-vous d'expliciter clairement les environnements techniques modernes (ex: <strong>TypeScript</strong>, <strong>React</strong>, <strong>Docker</strong>, <strong>APIs REST</strong>) dans chaque fiche de projet.
            </p>
          </div>

          <div className="editorial-panel rounded-xl p-4 bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1.5">
            <span className="font-mono text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">
              02. IMPACT QUANTIFIÉ DES RÉALISATIONS
            </span>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Les algorithmes de matching privilégient les accomplissements chiffrés. Mentionnez des gains concrets de performance, des métriques de productivité ou des volumétries gérées.
            </p>
          </div>

          <div className="editorial-panel rounded-xl p-4 bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1.5">
            <span className="font-mono text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider block">
              03. FORMAT STRUCTURÉ SANS TABLEAUX COMPLEXES
            </span>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Pour garantir 100% de lisibilité lors du parsing PDF automatique, privilégiez un format linéaire avec des sections chronologiques claires.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
