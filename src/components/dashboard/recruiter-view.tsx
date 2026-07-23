import React, { useState, useEffect, useRef } from 'react';
import { dbEngine } from '../../lib/firebase/db';
import { JobPosting, CandidateCV } from '../../types';
import { StatCard } from '../ui/stat-card';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { EmptyState } from '../ui/empty-state';
import { BentoCardGrid, GlobalSpotlight } from '../ui/magic-bento';
import { 
  Briefcase, 
  FileText, 
  Sparkles, 
  TrendingUp, 
  Search, 
  Plus, 
  MapPin, 
Building, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  X,
  Zap,
  Activity,
  UploadCloud,
  Clock,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export const RecruiterView: React.FC = () => {
  const bentoGridRef = useRef<HTMLDivElement>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [loading, setLoading] = useState(true);

  // Job creation form states
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobCompany, setNewJobCompany] = useState('');
  const [newJobLocation, setNewJobLocation] = useState('');
  const [newJobDesc, setNewJobDesc] = useState('');

  // CV ingestion state (Headhunting simulator)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customFileName, setCustomFileName] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Selected CV detail modal states
  const [selectedCv, setSelectedCv] = useState<CandidateCV | null>(null);

  // Active filter for matching
  const [selectedJobForMatch, setSelectedJobForMatch] = useState<string>('all');

  // Recruiter mock logs
  const [recentLogs, setRecentLogs] = useState([
    { id: 1, text: 'CV de Sophie Martin analysé (92% de match)', time: 'À l\'instant' },
    { id: 2, text: 'Offre "Développeur React Senior" publiée', time: 'Il y a 30 min' },
    { id: 3, text: 'CV de Thomas Bernard importé avec succès', time: 'Il y a 2h' }
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, cvsData] = await Promise.all([
        dbEngine.getAllJobs(),
        dbEngine.getAllCVs()
      ]);
      setJobs(jobsData);
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

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle || !newJobCompany || !newJobLocation || !newJobDesc) {
      toast.error('Veuillez remplir tous les champs.');
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
      toast.success('Offre d\'emploi publiée avec succès !');
      setShowAddJobModal(false);
      // Log event
      setRecentLogs(prev => [
        { id: Date.now(), text: `Offre "${newJobTitle}" publiée`, time: 'À l\'instant' },
        ...prev
      ]);
      // Reset form
      setNewJobTitle('');
      setNewJobCompany('');
      setNewJobLocation('');
      setNewJobDesc('');
      loadData();
    } catch (err) {
      toast.error('Erreur lors de la création de l\'offre.');
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await dbEngine.deleteJob(id);
      toast.success('Offre d\'emploi supprimée.');
      loadData();
    } catch (e) {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleDeleteCv = async (id: string) => {
    try {
      await dbEngine.deleteCV(id);
      toast.success('CV supprimé de la base.');
      loadData();
    } catch (e) {
      toast.error('Erreur lors de la suppression du CV.');
    }
  };

  // Recruiter direct upload simulator
  const handleUploadSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    let nameToUpload = customFileName.trim();
    if (!nameToUpload) {
      nameToUpload = selectedFile ? selectedFile.name : 'CV_Sourcing_Direct.pdf';
    } else if (!nameToUpload.toLowerCase().endsWith('.pdf') && !nameToUpload.toLowerCase().endsWith('.docx')) {
      nameToUpload += '.pdf';
    }

    setUploading(true);
    toast.info('Sourcing IA sémantique en cours...');

    setTimeout(async () => {
      try {
        await dbEngine.uploadCV('recruiter-sourcing', nameToUpload, undefined, selectedFile || undefined);
        toast.success('Sourcing complété ! Profil importé et analysé.');
        setCustomFileName('');
        setSelectedFile(null);
        setShowUploadModal(false);
        // Log event
        setRecentLogs(prev => [
          { id: Date.now(), text: `Nouveau CV "${nameToUpload}" importé de l'espace Sourcing`, time: 'À l\'instant' },
          ...prev
        ]);
        loadData();
      } catch (err) {
        toast.error('Erreur sémantique.');
      } finally {
        setUploading(false);
      }
    }, 1500);
  };

  // Real-time keyword matching calculation
  const getMatchScore = (cv: CandidateCV, jobId: string) => {
    if (jobId === 'all') return cv.aiScore || 70;
    const job = jobs.find(j => j.id === jobId);
    if (!job) return cv.aiScore || 70;

    const cvSkills = cv.skills || [];
    const jobText = (job.title + ' ' + job.description).toLowerCase();
    
    // Count matching keywords
    let matchCount = 0;
    cvSkills.forEach(skill => {
      if (jobText.includes(skill.toLowerCase())) {
        matchCount++;
      }
    });

    const skillFactor = cvSkills.length > 0 ? (matchCount / cvSkills.length) * 40 : 0;
    const baseScore = cv.aiScore ? cv.aiScore * 0.6 : 50;
    const finalScore = Math.round(baseScore + skillFactor);
    return Math.min(Math.max(finalScore, 45), 98); // constraint between 45 and 98
  };

  // Stats calculation
  const totalJobs = jobs.length;
  const totalCvs = cvs.length;
  const qualifiedCount = cvs.filter(c => (c.aiScore || 0) >= 80).length;
  const avgScore = cvs.length > 0
    ? Math.round(cvs.reduce((sum, c) => sum + (c.aiScore || 0), 0) / cvs.length)
    : 0;

  // Sorting cvs by match score
  const matchedAndSortedCvs = [...cvs].sort((a, b) => {
    return getMatchScore(b, selectedJobForMatch) - getMatchScore(a, selectedJobForMatch);
  });

  return (
    <div className="space-y-8 select-none">
      {/* Upper Metrics Grid */}
      <GlobalSpotlight gridRef={bentoGridRef} spotlightRadius={300} glowColor="124, 58, 237" />
      <BentoCardGrid gridRef={bentoGridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-0 max-w-full">
        <StatCard
          title="Fiches de Poste"
          value={totalJobs}
          icon={Briefcase}
          change="+4"
          isPositive={true}
          colorClass="text-cyan-400"
        />
        <StatCard
          title="CVs de la Base"
          value={totalCvs}
          icon={FileText}
          change="+12"
          isPositive={true}
          colorClass="text-blue-400"
        />
        <StatCard
          title="Candidats Qualifiés"
          value={qualifiedCount}
          icon={Sparkles}
          change="+18.2%"
          isPositive={true}
          colorClass="text-emerald-400"
        />
        <StatCard
          title="Adéquation Globale"
          value={`${avgScore}%`}
          icon={TrendingUp}
          change="+2.4%"
          isPositive={true}
          colorClass="text-purple-400"
        />
      </BentoCardGrid>

      {/* Bento Row: Quick Actions & Recent Activity (Recruiter) */}
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
              Pilotez vos recrutements et enrichissez la base de CVs.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setShowAddJobModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-blue-500/20 bg-blue-600/5 hover:bg-blue-600/10 hover:border-blue-500/30 text-left cursor-pointer transition-all text-xs text-blue-400 font-semibold"
              >
                <span className="font-bold">Créer une fiche de poste</span>
                <Plus className="w-4 h-4 text-blue-400" />
              </button>

              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/60 hover:border-slate-800 text-left cursor-pointer transition-all text-xs text-white"
              >
                <span>Importer des CVs (Sourcing)</span>
                <UploadCloud className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3.5 mt-5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Sourcing IA : ACTIF</span>
            <span>Appariement intelligent</span>
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-slate-800/60 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shadow-lg shadow-amber-500/10">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Activité Récente</h4>
                <p className="text-[10px] text-slate-500">Mises à jour et flux d'adéquation en temps réel</p>
              </div>
            </div>

            <div className="space-y-3.5 max-h-40 overflow-y-auto pr-1">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 animate-ping" />
                    <p className="text-slate-300 truncate leading-relaxed font-sans">{log.text}</p>
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono shrink-0 whitespace-nowrap">{log.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3.5 mt-5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Flux d'adéquation sémantique : ACTIF</span>
            <span>Mises à jour instantanées</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Job Management (1/3 of space) */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-card rounded-2xl p-6 border border-slate-800/60">
            <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-4">
              <div>
                <h3 className="text-sm font-bold font-display text-white">Vos fiches de poste</h3>
                <p className="text-[11px] text-slate-500">Postez et éditez vos positions</p>
              </div>
              <button
                onClick={() => setShowAddJobModal(true)}
                className="p-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white cursor-pointer transition-all shadow-md shadow-blue-500/10"
                title="Ajouter une offre"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <LoadingSkeleton variant="list" />
            ) : jobs.length > 0 ? (
              <div className="space-y-3 max-h-120 overflow-y-auto pr-1">
                {/* General Base Filter */}
                <div
                  onClick={() => setSelectedJobForMatch('all')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left relative ${
                    selectedJobForMatch === 'all'
                      ? 'bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20 shadow-md shadow-blue-500/5'
                      : 'bg-slate-950/80 border-slate-900 hover:border-slate-800'
                  }`}
                >
                  <h4 className="text-xs font-bold text-white">Base générale</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-sans">Tous les CVs ordonnés par score IA intrinsèque</p>
                </div>

                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJobForMatch(job.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left relative ${
                      selectedJobForMatch === job.id
                        ? 'bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20 shadow-md shadow-blue-500/5'
                        : 'bg-slate-950/80 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="text-xs font-bold text-white truncate">{job.title}</h4>
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-1">
                          <Building className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{job.company}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{job.location}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0"
                        title="Supprimer l'offre"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Aucune offre publiée"
                description="Publiez votre premier descriptif de poste pour débuter l'appariement IA."
                icon={Briefcase}
                actionText="Créer une offre"
                onAction={() => setShowAddJobModal(true)}
              />
            )}
          </div>
        </div>

        {/* Right Column: Candidates & AI Score Match (2/3 of space) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-slate-800/60">
            {/* Header filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900 pb-4 mb-6">
              <div>
                <h3 className="text-sm font-bold font-display text-white">Résultats d'adéquation sémantique (CVs)</h3>
                <p className="text-[11px] text-slate-500 font-sans">
                  {selectedJobForMatch === 'all'
                    ? 'Affichage de la base générale ordonnée par score IA'
                    : `Scores d'adéquation ajustés pour: ${jobs.find(j => j.id === selectedJobForMatch)?.title}`}
                </p>
              </div>

              {selectedJobForMatch !== 'all' && (
                <button
                  onClick={() => setSelectedJobForMatch('all')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs text-slate-400 cursor-pointer transition-colors"
                >
                  Effacer filtre
                </button>
              )}
            </div>

            {loading ? (
              <LoadingSkeleton variant="list" />
            ) : matchedAndSortedCvs.length > 0 ? (
              <div className="space-y-4">
                {matchedAndSortedCvs.map((cv) => {
                  const fitScore = getMatchScore(cv, selectedJobForMatch);
                  // Dynamic color indicator based on fitScore
                  const scoreColor = fitScore >= 85
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : fitScore >= 70
                    ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

                  return (
                    <div
                      key={cv.id}
                      onClick={() => setSelectedCv(cv)}
                      className="p-4 rounded-xl border border-slate-900/80 bg-slate-950/40 hover:bg-slate-900/40 hover:border-slate-800 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4 min-w-0 flex-1 mr-4">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center text-blue-400 shadow-md shadow-blue-500/5">
                          <FileText className="w-5.5 h-5.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate">{cv.fileName}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {cv.skills?.slice(0, 4).map((s) => (
                              <span
                                key={s}
                                className="text-[9px] font-mono font-medium px-1.5 py-0.5 bg-slate-900 border border-slate-800/80 text-slate-400 rounded-md"
                              >
                                {s}
                              </span>
                            ))}
                            {(cv.skills || []).length > 4 && (
                              <span className="text-[9px] font-mono text-slate-600">
                                +{(cv.skills || []).length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right actions/badge */}
                      <div className="flex items-center space-x-4 shrink-0">
                        {/* Score Indicator */}
                        <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl border ${scoreColor}`}>
                          <span className="text-base font-bold font-mono tracking-tighter">{fitScore}%</span>
                          <span className="text-[8px] font-mono text-slate-500 tracking-wider">MATCH</span>
                        </div>

                        {/* Delete CV icon */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCv(cv.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Supprimer de la CVthèque"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Aucun CV importé"
                description="Les candidats doivent d'abord uploader leurs CVs ou vous devez en sourcer."
                icon={FileText}
              />
            )}
          </div>
        </div>
      </div>

      {/* SOURCING RESUME UPLOAD MODAL */}
      {showUploadModal && (
        <div
          onClick={() => setShowUploadModal(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-slate-950/95 border border-slate-800 p-6 shadow-2xl relative text-left"
          >
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold font-display bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1.5">Importer un CV (Sourcing Direct)</h3>
            <p className="text-xs text-slate-400 mb-5 font-sans">Glissez-déposez ou simulez l'ingestion d'un profil de candidat.</p>

            <form onSubmit={handleUploadSimulate} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-slate-800 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center text-center bg-slate-900/20 cursor-pointer transition-all"
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
                <UploadCloud className="w-8 h-8 text-slate-500 mb-2" />
                <span className="text-xs font-semibold text-slate-400">
                  {selectedFile ? 'Fichier prêt !' : 'Cliquez pour sélectionner un CV'}
                </span>
                <span className="text-[10px] text-slate-600 mt-1">PDF ou DOCX (max 5MB)</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Nommer le fichier candidat
                </label>
                <input
                  type="text"
                  required
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="ex: CV_Camille_Dev_React.pdf"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin shrink-0" />
                    <span>Sourcing en cours...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
                    <span>Lancer l'ingestion IA</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PUBLISH JOB MODAL */}
      {showAddJobModal && (
        <div
          onClick={() => setShowAddJobModal(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-slate-950/95 border border-slate-800 p-6 shadow-2xl relative text-left"
          >
            <button
              onClick={() => setShowAddJobModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold font-display bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1.5">Publier une offre de poste</h3>
            <p className="text-xs text-slate-400 mb-6 font-sans">Créez un descriptif d'emploi pour y lier des CVs.</p>

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 font-sans">Intitulé du poste</label>
                <input
                  type="text"
                  required
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="ex: Développeur React Sénior"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 font-sans">Entreprise</label>
                  <input
                    type="text"
                    required
                    value={newJobCompany}
                    onChange={(e) => setNewJobCompany(e.target.value)}
                    placeholder="ex: TechFlow"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 font-sans">Localisation</label>
                  <input
                    type="text"
                    required
                    value={newJobLocation}
                    onChange={(e) => setNewJobLocation(e.target.value)}
                    placeholder="ex: Paris (Hybride)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 font-sans">Description / Profil recherché</label>
                <textarea
                  required
                  rows={4}
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                  placeholder="Listez les compétences requises (ex: React, TypeScript, Node.js...)"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-lg shadow-blue-500/10"
              >
                Publier l'offre
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CV REVIEW DETAILS MODAL */}
      {selectedCv && (
        <div
          onClick={() => setSelectedCv(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl bg-slate-950/95 border border-slate-800 p-6 shadow-2xl relative text-left animate-fadeIn"
          >
            <button
              onClick={() => setSelectedCv(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start space-x-4 mb-6">
              <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl text-blue-400 shrink-0 shadow-md shadow-blue-500/5">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-white">{selectedCv.fileName}</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedCv.id}</p>
              </div>
            </div>

            {/* Grid content */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Score panel */}
              <div className="md:col-span-1 p-5 rounded-2xl border border-slate-900 bg-slate-950 flex flex-col items-center justify-center text-center">
                <div className="text-4xl font-black font-mono text-blue-400 mb-1">
                  {getMatchScore(selectedCv, selectedJobForMatch)}%
                </div>
                <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase font-bold">
                  Adéquation d'Offre
                </div>

                <div className="w-full border-t border-slate-900 my-4" />

                <div className="space-y-1.5 text-left w-full">
                  <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">Compétences clés:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCv.skills?.map(s => (
                      <span key={s} className="text-[9px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20 font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI feedback panel */}
              <div className="md:col-span-2 space-y-4">
                <div className="p-5 rounded-2xl border border-slate-900/60 bg-slate-900/10 relative overflow-hidden">
                  <div className="absolute right-2 top-2 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center space-x-1.5 text-xs text-blue-400 font-bold font-sans mb-2.5">
                    <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
                    <span>Rapport d'analyse cognitive</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {selectedCv.feedback || "Aucun rapport d'analyse sémantique disponible pour ce profil."}
                  </p>
                </div>

                <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Conforme aux normes RGPD.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
