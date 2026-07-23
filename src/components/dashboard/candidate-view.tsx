import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { CandidateCV, JobPosting } from '../../types';
import { StatCard } from '../ui/stat-card';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { EmptyState } from '../ui/empty-state';
import { BentoCardGrid, GlobalSpotlight } from '../ui/magic-bento';
import { 
  FileText, 
  Sparkles, 
  TrendingUp, 
  UploadCloud, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Trash2, 
  ArrowRight,
  Zap,
  Activity,
  Award,
  X,
  Target,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

export const CandidateView: React.FC = () => {
  const bentoGridRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [customFileName, setCustomFileName] = useState('');

  // Modals / Overlays state
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showImproveModal, setShowImproveModal] = useState(false);
  const [simulatedMatches, setSimulatedMatches] = useState<any[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const loadCvsAndJobs = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [cvsData, jobsData] = await Promise.all([
        dbEngine.getCVsByCandidate(profile.uid),
        dbEngine.getAllJobs()
      ]);
      setCvs(cvsData);
      setJobs(jobsData);
    } catch (e) {
      toast.error('Erreur de récupération des CVs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCvsAndJobs();
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
      toast.success(`Fichier "${file.name}" chargé !`);
    }
  };

  const handleFileSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setCustomFileName(file.name);
      toast.success(`Fichier "${file.name}" chargé !`);
    }
  };

  const handleUploadSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    let nameToUpload = customFileName.trim();
    if (!nameToUpload) {
      nameToUpload = selectedFile ? selectedFile.name : 'CV_Developpeur_FrontEnd.pdf';
    } else if (!nameToUpload.toLowerCase().endsWith('.pdf') && !nameToUpload.toLowerCase().endsWith('.docx') && !nameToUpload.toLowerCase().endsWith('.doc')) {
      nameToUpload += '.pdf';
    }

    setUploading(true);
    toast.info('Analyse sémantique cognitive en cours...');

    // Simulate short delay for "AI extracting and calculating matching factors"
    setTimeout(async () => {
      try {
        await dbEngine.uploadCV(profile.uid, nameToUpload, undefined, selectedFile || undefined);
        toast.success('Analyse IA terminée avec succès ! Profil extrait.');
        setCustomFileName('');
        setSelectedFile(null);
        loadCvsAndJobs();
      } catch (err) {
        toast.error('Erreur d\'extraction cognitive.');
      } finally {
        setUploading(false);
      }
    }, 1500);
  };

  const handleDeleteCv = async (id: string) => {
    try {
      await dbEngine.deleteCV(id);
      toast.success('CV retiré de votre espace.');
      loadCvsAndJobs();
    } catch (e) {
      toast.error('Erreur lors du retrait.');
    }
  };

  // Match Jobs simulator
  const handleMatchSimulation = () => {
    if (cvs.length === 0) {
      toast.warning('Veuillez d\'abord déposer au moins un CV pour effectuer l\'appariement.');
      return;
    }
    toast.info('Appariement sémantique en cours...');
    setTimeout(() => {
      // Pick top job matches
      const list = jobs.map(job => {
        const score = Math.round(75 + Math.random() * 21); // 75% to 96%
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          score
        };
      }).sort((a, b) => b.score - a.score);
      setSimulatedMatches(list.slice(0, 3));
      setShowMatchModal(true);
      toast.success('Appariement sémantique terminé !');
    }, 1000);
  };

  if (!profile) return null;

  const totalCvs = cvs.length;
  const bestScore = cvs.length > 0 ? Math.max(...cvs.map(c => c.aiScore || 0)) : 0;
  const processedCount = cvs.filter(c => c.status === 'PROCESSED').length;

  // Static items for Interview History Widget
  const interviewHistory = [
    { id: 1, company: 'TechFlow Inc.', role: 'Dev React Senior', date: '22 Juil 2026', type: 'Simulé', status: 'CONFIRMED' },
    { id: 2, company: 'Vercel France', role: 'Solutions Engineer', date: '12 Juil 2026', type: 'Réel', status: 'COMPLETED' }
  ];

  // Static Profile checklist items
  const checklist = [
    { label: 'Informations de profil complétées', checked: true },
    { label: 'CV principal déposé & indexé', checked: totalCvs > 0 },
    { label: 'Compétences clés extraites', checked: totalCvs > 0 },
    { label: 'Abonnement actif', checked: profile.subscription === 'PREMIUM' }
  ];
  const completionPercentage = Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100);

  return (
    <div className="space-y-8 select-none">
      {/* Metrics Row (4 explicit widgets) */}
      <GlobalSpotlight gridRef={bentoGridRef} spotlightRadius={300} glowColor="124, 58, 237" />
      <BentoCardGrid gridRef={bentoGridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-0 max-w-full">
        <StatCard
          title="CVs déposés"
          value={totalCvs}
          icon={FileText}
          change="+1"
          isPositive={true}
          colorClass="text-blue-400"
        />
        <StatCard
          title="Complétion Profil"
          value={`${completionPercentage}%`}
          icon={Target}
          change={profile.subscription === 'PREMIUM' ? 'PREMIUM' : 'FREE'}
          isPositive={true}
          colorClass="text-purple-400"
        />
        <StatCard
          title="Analyses IA complétées"
          value={processedCount}
          icon={CheckCircle}
          change="100%"
          isPositive={true}
          colorClass="text-emerald-400"
        />
        <StatCard
          title="Historique Entretiens"
          value={interviewHistory.length}
          icon={Calendar}
          change="+2"
          isPositive={true}
          colorClass="text-cyan-400"
        />
      </BentoCardGrid>

      {/* Bento Grid: Quick Actions, Profile Completion, Interview History & AI Report */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions Panel */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/60 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-28 h-28 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl shadow-lg shadow-blue-500/10">
                <Zap className="w-4 h-4 animate-pulse" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Actions Rapides</h4>
            </div>
            <p className="text-[11px] text-slate-500 mb-5 font-sans">
              Optimisez votre visibilité auprès des recruteurs inscrits.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const input = document.querySelector('input[placeholder="ex: CV_Sophie_Dev_Sénior.pdf"]') as HTMLInputElement;
                  input?.focus();
                  toast.info('Utilisez le panneau d\'import de CV à gauche.');
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/60 hover:border-slate-800 text-left cursor-pointer transition-all text-xs text-white"
              >
                <span>Uploader mon CV principal</span>
                <UploadCloud className="w-4 h-4 text-slate-500" />
              </button>

              <button
                onClick={handleMatchSimulation}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/30 text-left cursor-pointer transition-all text-xs text-blue-400 font-semibold"
              >
                <span>Trouver des Offres d'emploi</span>
                <Target className="w-4 h-4 text-blue-400" />
              </button>

              <button
                onClick={() => {
                  if (cvs.length === 0) {
                    toast.warning('Uploadez d\'abord un CV pour analyser comment l\'améliorer !');
                    return;
                  }
                  setShowImproveModal(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/60 hover:border-slate-800 text-left cursor-pointer transition-all text-xs text-white"
              >
                <span>Conseils d'amélioration CV</span>
                <Sparkles className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3.5 mt-5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Visibilité : PUBLIQUE</span>
            <span>Accès premium</span>
          </div>
        </div>

        {/* Profile Completion Checklist Widget */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/60 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-lg shadow-emerald-500/10">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Complétion Profil</h4>
                <p className="text-[10px] text-slate-500">Mettez à jour vos infos pour l'IA</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/20 border border-slate-900">
                  <span className={`font-medium ${item.checked ? 'text-slate-300' : 'text-slate-500'}`}>{item.label}</span>
                  {item.checked ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3.5 mt-5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Complété : {completionPercentage}%</span>
            <span>Niveau requis : 100%</span>
          </div>
        </div>

        {/* Interview History Widget */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/60 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shadow-lg shadow-amber-500/10">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Entretiens Planifiés</h4>
                <p className="text-[10px] text-slate-500">Suivi des entretiens IA & réels</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {interviewHistory.map((it) => (
                <div key={it.id} className="p-2.5 rounded-xl bg-slate-950/20 border border-slate-900 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-white">{it.company}</h5>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{it.role} ({it.type})</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono text-slate-400 block">{it.date}</span>
                    <span className={`text-[8px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                      it.status === 'CONFIRMED' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                    }`}>
                      {it.status === 'CONFIRMED' ? 'À venir' : 'Passé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3.5 mt-5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Dernière mise à jour : À l'instant</span>
            <span>Mode simulation</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: CV Upload Area (1/3 of space) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-slate-800/60">
            <h3 className="text-sm font-bold font-display text-white mb-1">Déposer un nouveau CV</h3>
            <p className="text-[11px] text-slate-500 mb-5 font-sans">Glissez-déposez ou tapez le nom de votre fichier pour simuler l'analyse sémantique IA.</p>

            <form onSubmit={handleUploadSimulate} className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleFileSelectClick}
                className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center bg-slate-950/40 relative group transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-600/10 scale-[1.02]'
                    : 'border-slate-800 hover:border-blue-500'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                />
                <UploadCloud className={`w-8 h-8 mb-2.5 transition-colors ${
                  selectedFile ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'
                }`} />
                <span className="text-[11px] font-semibold text-slate-400">
                  {selectedFile ? 'Fichier sélectionné !' : 'Glisser-déposer votre fichier ici'}
                </span>
                <span className="text-[9px] text-slate-600 mt-0.5">
                  {selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)` : 'PDF ou DOCX (max 5MB)'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Nom du fichier à simuler
                </label>
                <input
                  type="text"
                  disabled={uploading}
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="ex: CV_Sophie_Dev_Sénior.pdf"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-500/10"
              >
                {uploading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin shrink-0" />
                    <span>Traitement IA cognitif...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
                    <span>Lancer l'analyse cognitive</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: CVs List & Cognitive Feedback Reports (2/3 of space) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-slate-800/60">
            <h3 className="text-sm font-bold font-display text-white mb-1.5">Historique des analyses de vos CVs</h3>
            <p className="text-[11px] text-slate-500 mb-6 font-sans">Visualisez les feedbacks cognitifs et scores d'adéquation générés par nos algorithmes.</p>

            {loading ? (
              <LoadingSkeleton variant="list" />
            ) : cvs.length > 0 ? (
              <div className="space-y-4">
                {cvs.map((cv) => (
                  <div
                    key={cv.id}
                    className="p-4 rounded-xl border border-slate-900 bg-slate-950/30 flex flex-col md:flex-row md:items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Title row */}
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 shrink-0 shadow-md shadow-blue-500/5">
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {cv.fileURL && cv.fileURL !== '#' ? (
                            <a
                              href={cv.fileURL}
                              download={cv.fileName}
                              className="text-xs font-bold text-white hover:text-blue-400 hover:underline transition-colors inline-flex items-center gap-1"
                              title="Télécharger ou ouvrir le fichier"
                            >
                              {cv.fileName}
                            </a>
                          ) : (
                            <h4 className="text-xs font-bold text-white truncate">{cv.fileName}</h4>
                          )}
                          <span className="text-[9px] font-mono text-slate-500 block">
                            Analysé le {new Date(cv.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>

                      {/* AI cognitive feedback bubble */}
                      {cv.feedback && (
                        <div className="p-3 bg-slate-900/60 border border-slate-900 rounded-xl relative overflow-hidden">
                          <div className="absolute right-2 top-2 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                          <span className="text-[9px] font-mono font-bold text-blue-400 block mb-1 uppercase tracking-widest">
                            Rapport d'analyse cognitive :
                          </span>
                          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{cv.feedback}</p>
                        </div>
                      )}

                      {/* Extracted keywords list */}
                      {cv.skills && cv.skills.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-mono text-slate-600 font-bold uppercase shrink-0">Compétences:</span>
                          <div className="flex flex-wrap gap-1">
                            {cv.skills.map((skill) => (
                              <span
                                key={skill}
                                className="text-[9px] font-mono font-medium px-1.5 py-0.5 bg-slate-900 text-slate-500 rounded-md border border-slate-800"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Score and actions Column */}
                    <div className="flex flex-row md:flex-col items-center justify-between md:justify-start gap-4 shrink-0">
                      {/* Score Badge */}
                      <div className="flex flex-col items-center px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
                        <span className="text-xl font-bold font-mono tracking-tighter leading-none mb-0.5">{cv.aiScore}%</span>
                        <span className="text-[8px] font-mono text-slate-500 tracking-wider">SCORE IA</span>
                      </div>

                      <button
                        onClick={() => handleDeleteCv(cv.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                        title="Retirer ce CV de votre espace"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Aucun document analysé"
                description="Uploadez votre CV à gauche pour lancer l'extracteur cognitif."
                icon={FileText}
              />
            )}
          </div>
        </div>
      </div>

      {/* MATCH TO JOBS POPUP MODAL */}
      {showMatchModal && (
        <div
          onClick={() => setShowMatchModal(false)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-slate-950/95 border border-slate-800 p-6 shadow-2xl relative text-left"
          >
            <button
              onClick={() => setShowMatchModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold font-display bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1">
              Résultats d'appariement sémantique
            </h3>
            <p className="text-xs text-slate-500 mb-5 font-sans">Voici les offres d'emploi avec le meilleur score d'adéquation.</p>

            <div className="space-y-3.5">
              {simulatedMatches.map((m, idx) => (
                <div key={idx} className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">{m.title}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{m.company} • {m.location}</p>
                  </div>

                  <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono font-bold text-xs shrink-0">
                    {m.score}% Match
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowMatchModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs cursor-pointer text-center block transition-all shadow-lg shadow-blue-500/10"
            >
              Fermer les résultats
            </button>
          </div>
        </div>
      )}

      {/* IMPROVE RESUME POPUP MODAL */}
      {showImproveModal && (
        <div
          onClick={() => setShowImproveModal(false)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-slate-950/95 border border-slate-800 p-6 shadow-2xl relative text-left"
          >
            <button
              onClick={() => setShowImproveModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-3">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl shadow-lg shadow-blue-500/5">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Rapport de corrections IA
                </h3>
                <p className="text-[10px] text-slate-500 font-sans">Améliorez le score d'appariement sémantique</p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2 relative overflow-hidden">
                <div className="absolute right-2 top-2 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                <h4 className="font-bold text-white text-xs font-display">1. Densité des mots-clés sémantiques</h4>
                <p className="text-[11px] text-slate-400 font-sans">
                  Votre CV présente une excellente maitrise technique de base, mais manque de précisions sur les environnements modernes comme <strong>TypeScript</strong> ou <strong>Docker</strong>. Intégrez-les dans vos fiches de projet.
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2 relative overflow-hidden">
                <div className="absolute right-2 top-2 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                <h4 className="font-bold text-white text-xs font-display">2. Résultats chiffrés</h4>
                <p className="text-[11px] text-slate-400 font-sans">
                  Les recruteurs apprécient les métriques d'impact. Remplacez "Développement de l'interface" par "Amélioration de 35% de la vitesse de chargement de l'interface en React".
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2 relative overflow-hidden">
                <div className="absolute right-2 top-2 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                <h4 className="font-bold text-white text-xs font-display">3. Format structurel</h4>
                <p className="text-[11px] text-slate-400 font-sans">
                  Assurez-vous que votre PDF n'utilise pas de colonnes complexes ou de boites de texte non extractibles. Utilisez un format linéaire standard pour l'appariement automatique.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowImproveModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs cursor-pointer text-center block transition-all shadow-lg shadow-blue-500/10"
            >
              Compris, j'optimise mon CV
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
