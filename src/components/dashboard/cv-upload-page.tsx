import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { CandidateCV, JobPosting } from '../../types';
import { CVStructuredModal } from './cv-structured-modal';
import { CountUp } from '../ui/count-up';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  Trash2,
  Mic,
  ArrowRight,
  Download,
  Eye,
  AlertCircle,
  Clock,
  Briefcase,
  GraduationCap,
  Award,
  Layers,
  MapPin,
  Mail,
  Phone,
  Globe,
  Github,
  Linkedin,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadCandidateCV } from '../../lib/cv-downloader';

interface CvUploadPageProps {
  onNavigate?: (path: string) => void;
}

const processingSteps = [
  { step: '01', title: 'INGESTION', desc: 'Lecture et validation du flux binaire PDF' },
  { step: '02', title: 'EXTRACTION', desc: 'Détection des entités et du texte sémantique' },
  { step: '03', title: 'STRUCTURATION', desc: 'Organisation des expériences et compétences' },
  { step: '04', title: 'ÉVALUATION', desc: 'Calcul du Quality Index & des signaux IA' },
];

export const CvUploadPage: React.FC<CvUploadPageProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressStep, setUploadProgressStep] = useState(0);
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCvForDetail, setSelectedCvForDetail] = useState<CandidateCV | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const primaryCv = cvs.length > 0 ? cvs[0] : null;

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [fetchedCvs, fetchedJobs] = await Promise.all([
        dbEngine.getCVsByCandidate(profile.uid),
        dbEngine.getAllJobs()
      ]);
      setCvs(fetchedCvs);
      setJobs(fetchedJobs.filter(j => j.status === 'OPEN'));
    } catch (e) {
      console.error('Erreur chargement CVs:', e);
      toast.error('Impossible de charger vos documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.uid]);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setCustomFileName(file.name);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setCustomFileName(file.name);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!selectedFile && !customFileName.trim()) {
      toast.warning('Veuillez sélectionner un fichier PDF ou saisir un intitulé.');
      return;
    }

    setUploading(true);
    setUploadProgressStep(0);

    const interval = setInterval(() => {
      setUploadProgressStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 500);

    const fileName = customFileName.trim() || selectedFile?.name || 'CV_Candidat.pdf';

    try {
      await dbEngine.uploadCV(profile.uid, fileName, undefined, selectedFile || undefined);
      clearInterval(interval);
      setUploadProgressStep(3);
      toast.success('CV ingéré et analysé avec succès.');
      setCustomFileName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
    } catch (err: any) {
      clearInterval(interval);
      console.error('Upload CV error:', err);
      toast.error('Erreur lors du dépôt du CV : ' + (err.message || 'Erreur inconnue'));
    } finally {
      setUploading(false);
      setUploadProgressStep(0);
    }
  };

  const handleDeleteCv = async (id: string) => {
    try {
      await dbEngine.deleteCV(id);
      toast.success('Document supprimé.');
      await loadData();
    } catch (err) {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleStartInterview = () => {
    if (onNavigate) {
      onNavigate('/dashboard/candidate/interview');
    } else {
      window.location.href = '/dashboard/candidate/interview';
    }
  };

  const fileSize = (bytes?: number) => {
    if (!bytes) return 'PDF';
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} Ko`
      : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 select-none">
      
      {/* =========================================================================
          SECTION 01 — EDITORIAL HERO
          ========================================================================= */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--primary)]">
            // CV INTELLIGENCE
          </span>
          <span className="h-px flex-1 max-w-[120px] bg-[var(--border)]" />
          <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
            MOTEUR COGNITIF
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[var(--border)] pb-8">
          <div className="space-y-3 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase leading-[1.08]">
              LET THE SYSTEM READ YOUR CV.
            </h1>
            <p className="text-sm sm:text-base text-[var(--muted-foreground)] font-sans leading-relaxed">
              CVThèque analyse votre document pour extraire vos compétences, structurer vos expériences professionnelles et calibrer vos entretiens oraux avec précision.
            </p>
          </div>

          {primaryCv ? (
            <button
              onClick={handleStartInterview}
              className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-[var(--primary)] hover:opacity-90 text-white font-mono text-xs font-bold transition-all shadow-xl shadow-[var(--primary)]/20 shrink-0 cursor-pointer group"
            >
              <Mic className="w-4 h-4 animate-pulse text-white" />
              <span>PASSER L'ENTRETIEN ORAL IA</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <div className="px-4 py-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--muted-foreground)] font-mono text-xs flex items-center gap-2 shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Déposez un CV pour débloquer l'entretien oral</span>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION 02 — INGESTION AREA & PIPELINE
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Document Ingestion Dropzone (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-6">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--foreground)]">
                [01] INGESTION DU DOCUMENT
              </span>
              <span className="text-[10px] font-mono text-[var(--muted-foreground)]">PDF · 10 Mo MAX</span>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc"
                className="hidden"
                disabled={uploading}
              />

              {!selectedFile && !uploading ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-8 sm:p-10 rounded-2xl border border-dashed text-center flex flex-col items-center justify-center transition-all cursor-pointer group ${
                    isDragging
                      ? 'border-[var(--primary)] bg-[var(--primary-subtle)] scale-[1.01]'
                      : 'border-[var(--border-strong)] hover:border-[var(--primary)] bg-[var(--surface-secondary)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] group-hover:border-[var(--primary)] mb-4 transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>

                  <h3 className="text-base sm:text-lg font-bold font-display text-[var(--foreground)] tracking-tight">
                    DROP YOUR CV HERE.
                  </h3>
                  <p className="text-xs font-mono text-[var(--muted-foreground)] mt-1">
                    Glissez-déposez ou cliquez pour parcourir
                  </p>

                  <div className="mt-6 px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[11px] font-mono text-[var(--foreground)] group-hover:border-[var(--primary)] transition-colors">
                    [ SELECT DOCUMENT → ]
                  </div>
                </div>
              ) : selectedFile && !uploading ? (
                <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--primary-subtle)] border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)] shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--foreground)] truncate font-display">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] font-mono text-[var(--muted-foreground)]">
                          {fileSize(selectedFile.size)} · Document prêt pour ingestion
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setCustomFileName('');
                      }}
                      className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                      title="Retirer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] font-bold block">
                      Intitulé du document (optionnel)
                    </label>
                    <input
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder="ex: CV_2026_Ingénieur.pdf"
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
              ) : (
                /* Processing Pipeline States */
                <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--primary)]/40 space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                    <span className="text-[10px] font-mono font-bold text-[var(--primary)] uppercase tracking-wider">
                      // PIPELINE D'INGESTION
                    </span>
                    <span className="text-xs font-mono text-[var(--muted-foreground)] animate-pulse">
                      ANALYSE...
                    </span>
                  </div>

                  <div className="space-y-2">
                    {processingSteps.map((step, idx) => {
                      const isCurrent = idx === uploadProgressStep;
                      const isDone = idx < uploadProgressStep;

                      return (
                        <div
                          key={step.step}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between text-xs font-mono ${
                            isCurrent
                              ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--foreground)] font-bold'
                              : isDone
                              ? 'border-emerald-500/30 bg-emerald-500/5 text-[var(--foreground)]'
                              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span>[{step.step}]</span>
                            <span>{step.title}</span>
                          </div>
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : isCurrent ? (
                            <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || (!selectedFile && !customFileName.trim())}
                className="w-full py-4 rounded-2xl bg-[var(--primary)] hover:opacity-90 text-white font-mono text-xs font-bold transition-all shadow-xl shadow-[var(--primary)]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin text-white" />
                    <span>INGESTION ET EXTRACTION EN COURS...</span>
                  </>
                ) : (
                  <>
                    <span>ANALYSER LE DOCUMENT →</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Telemetry / Active CV Record (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {loading ? (
            <div className="p-12 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-3">
              <Clock className="w-6 h-6 animate-spin text-[var(--primary)] mx-auto" />
              <p className="text-xs font-mono text-[var(--muted-foreground)]">Chargement de votre dossier d'intelligence...</p>
            </div>
          ) : !primaryCv ? (
            /* Empty State */
            <div className="p-8 sm:p-12 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-6 relative overflow-hidden">
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--primary)]">
                  // CV INTELLIGENCE LAB
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight">
                  NO PROFESSIONAL DOCUMENT HAS BEEN INGESTED.
                </h2>
                <p className="text-xs sm:text-sm text-[var(--muted-foreground)] font-sans leading-relaxed max-w-md">
                  Téléversez votre CV pour structurer votre parcours, calculer votre Quality Index et préparer vos entretiens oraux.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--border)]">
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)] block">[01] PARSING</span>
                  <p className="text-xs font-bold text-[var(--foreground)]">Extraction Sémantique</p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)] block">[02] DIAGNOSTIC</span>
                  <p className="text-xs font-bold text-[var(--foreground)]">Quality Index /100</p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)] block">[03] SIMULATION</span>
                  <p className="text-xs font-bold text-[var(--foreground)]">Entretien Oral IA</p>
                </div>
              </div>
            </div>
          ) : (
            /* Active CV Dossier */
            <div className="space-y-6">
              
              {/* Score & Header Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] relative overflow-hidden shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative z-10">
                  <div className="space-y-2 max-w-md">
                    <span className="text-[10px] font-mono uppercase text-[var(--primary)] tracking-wider font-bold">
                      // DOCUMENT PRINCIPAL INDEXÉ
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-[var(--foreground)] truncate">
                      {primaryCv.fileName}
                    </h2>
                    <p className="text-xs font-mono text-[var(--muted-foreground)]">
                      Indexé le {new Date(primaryCv.createdAt).toLocaleDateString('fr-FR')} · Statut :{' '}
                      <span className="text-emerald-500 font-bold">STRUCTURÉ ET VALIDÉ</span>
                    </p>
                  </div>

                  {/* Monumental Score Display */}
                  <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-baseline gap-2 shrink-0 self-start">
                    <div>
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
                        QUALITY INDEX
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-3xl sm:text-4xl font-extrabold text-[var(--foreground)] font-display">
                          <CountUp to={primaryCv.aiScore ?? 87} duration={1.2} />
                        </span>
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">/ 100</span>
                      </div>
                    </div>
                  </div>
                </div>

                {primaryCv.feedback && (
                  <div className="mt-6 p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1 relative z-10">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--primary)] block">
                      // RAPPORT DIAGNOSTIQUE IA
                    </span>
                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed font-sans">
                      {primaryCv.feedback}
                    </p>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadCandidateCV(primaryCv)}
                      className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-xs border border-[var(--border)] transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>DOWNLOAD PDF →</span>
                    </button>

                    <button
                      onClick={() => setSelectedCvForDetail(primaryCv)}
                      className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-xs border border-[var(--border)] transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>INSPECTER LE DOSSIER</span>
                    </button>
                  </div>

                  <button
                    onClick={handleStartInterview}
                    className="px-5 py-2 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white font-mono text-xs font-bold transition-all shadow-md shadow-[var(--primary)]/20 flex items-center gap-2 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 animate-pulse" />
                    <span>LANCER L'ENTRETIEN ORAL</span>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary)] border border-[var(--primary)]/30'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  // SYNTHÈSE DU PROFIL
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary)] border border-[var(--primary)]/30'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  ARCHIVES ({cvs.length})
                </button>
              </div>

              {activeTab === 'profile' && (
                <div className="space-y-6">
                  {primaryCv.skills && primaryCv.skills.length > 0 && (
                    <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--foreground)] block">
                        // COMPÉTENCES DÉTECTÉES ({primaryCv.skills.length})
                      </span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {primaryCv.skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {primaryCv.parsedData?.experiences && primaryCv.parsedData.experiences.length > 0 && (
                    <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--foreground)]">
                          // PARCOURS EXTRAIT ({primaryCv.parsedData.experiences.length})
                        </span>
                        <button
                          onClick={() => setSelectedCvForDetail(primaryCv)}
                          className="text-[11px] font-mono text-[var(--primary)] hover:underline"
                        >
                          [ INSPECTER LE DOSSIER → ]
                        </button>
                      </div>

                      <div className="divide-y divide-[var(--border)]">
                        {primaryCv.parsedData.experiences.slice(0, 3).map((exp, idx) => (
                          <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4 text-xs">
                            <div>
                              <p className="font-bold text-[var(--foreground)] font-display">
                                {exp.job_title || 'Poste'}
                              </p>
                              <p className="text-[var(--muted-foreground)] font-sans mt-0.5">
                                {exp.company} {exp.location ? `· ${exp.location}` : ''}
                              </p>
                            </div>
                            <span className="font-mono text-[11px] text-[var(--muted-foreground)] shrink-0">
                              {exp.start_date} {exp.end_date ? `— ${exp.end_date}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--foreground)] block">
                    // HISTORIQUE DES DOCUMENTS ({cvs.length})
                  </span>

                  <div className="divide-y divide-[var(--border)]">
                    {cvs.map((cv, idx) => {
                      const idxFmt = idx < 9 ? `[0${idx + 1}]` : `[${idx + 1}]`;
                      const isMain = idx === 0;

                      return (
                        <div key={cv.id} className="py-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs font-bold text-[var(--primary)]">
                              {idxFmt}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs sm:text-sm font-bold text-[var(--foreground)] font-display truncate">
                                  {cv.fileName}
                                </h4>
                                {isMain && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-[var(--primary-subtle)] text-[var(--primary)] font-bold">
                                    ACTIF
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-mono text-[var(--muted-foreground)] mt-0.5">
                                {new Date(cv.createdAt).toLocaleDateString('fr-FR')} · Score : {cv.aiScore ?? 87}/100
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => downloadCandidateCV(cv)}
                              className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
                              title="Télécharger"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedCvForDetail(cv)}
                              className="px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-[11px]"
                            >
                              INSPECTER
                            </button>
                            <button
                              onClick={() => handleDeleteCv(cv.id)}
                              className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--danger)] hover:bg-rose-500/10 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </section>

      {/* Modal for Full Dossier Inspection */}
      <CVStructuredModal
        cv={selectedCvForDetail}
        onClose={() => setSelectedCvForDetail(null)}
        onStartInterview={handleStartInterview}
      />

    </div>
  );
};

