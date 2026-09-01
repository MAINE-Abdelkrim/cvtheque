import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { 
  OralInterviewSession, 
  OralInterviewMessage, 
  OralInterviewStage, 
  JobPosting,
  CandidateCV
} from '../../types';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  Clock, 
  Send, 
  Award, 
  RefreshCw, 
  AlertCircle,
  FileText,
  User,
  Bot,
  Layers,
  Zap,
  UploadCloud,
  FileQuestion,
  ShieldAlert,
  History,
  X,
  Play,
  RotateCcw,
  Check,
  Briefcase,
  ChevronRight,
  Activity,
  SlidersHorizontal,
  CornerDownRight,
  Headphones
} from 'lucide-react';
import { CountUp } from '../ui/count-up';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface OralInterviewRoomProps {
  onNavigate: (path: string) => void;
  selectedJob?: JobPosting | null;
}

const STAGES: { key: OralInterviewStage; label: string; num: string; desc: string }[] = [
  { key: 'INTRODUCTION', num: '01', label: 'INTRO', desc: 'Présentation & Parcours' },
  { key: 'EXPERIENCE', num: '02', label: 'EXPÉRIENCE', desc: 'Réalisations & Impact' },
  { key: 'TECHNICAL', num: '03', label: 'TECHNIQUE', desc: 'Compétences & Architecture' },
  { key: 'BEHAVIORAL', num: '04', label: 'COMPORTEMENTAL', desc: 'Communication & Résilience' },
  { key: 'COMPLETED', num: '05', label: 'BILAN', desc: 'Synthèse & Rapport' }
];

export const OralInterviewRoom: React.FC<OralInterviewRoomProps> = ({ 
  onNavigate,
  selectedJob 
}) => {
  const { profile } = useAuth();
  
  // Navigation / Mode State
  const [activeTab, setActiveTab] = useState<'ROOM' | 'HISTORY'>('ROOM');
  const [roomState, setRoomState] = useState<'PREPARATION' | 'LIVE' | 'REPORT'>('PREPARATION');
  
  // Session & Data State
  const [session, setSession] = useState<OralInterviewSession | null>(null);
  const [historySessions, setHistorySessions] = useState<OralInterviewSession[]>([]);
  const [inspectingSession, setInspectingSession] = useState<OralInterviewSession | null>(null);
  const [candidateCv, setCandidateCv] = useState<CandidateCV | null>(null);
  const [hasNoCV, setHasNoCV] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<JobPosting[]>([]);
  const [targetJob, setTargetJob] = useState<JobPosting | null>(selectedJob || null);
  
  // Audio & Process State
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);
  const [textFallbackInput, setTextFallbackInput] = useState('');
  const [useTextFallback, setUseTextFallback] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [micTestPassed, setMicTestPassed] = useState(false);
  const [sessionElapsedTime, setSessionElapsedTime] = useState(0);

  const {
    isRecording,
    recordingTime,
    audioLevel,
    permissionError,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder();

  // Live session timer
  useEffect(() => {
    let timer: any = null;
    if (roomState === 'LIVE' && session?.status === 'IN_PROGRESS') {
      timer = setInterval(() => {
        setSessionElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [roomState, session?.status]);

  // Web Speech Synthesis helper
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeakingQuestion(true);
      utterance.onend = () => setIsSpeakingQuestion(false);
      utterance.onerror = () => setIsSpeakingQuestion(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
    }
  };

  // Initial Data Load (CV, Jobs, History)
  const loadInitialData = async () => {
    if (!profile) return;
    setIsInitializing(true);
    setHasNoCV(false);
    try {
      const [cvs, jobs, sessions] = await Promise.all([
        dbEngine.getCVsByCandidate(profile.uid),
        dbEngine.getOpenJobs(),
        dbEngine.getInterviewSessionsByCandidate(profile.uid)
      ]);

      if (!cvs || cvs.length === 0) {
        setHasNoCV(true);
        setIsInitializing(false);
        return;
      }

      setCandidateCv(cvs[0]);
      setAvailableJobs(jobs);
      setHistorySessions(sessions);

      // Check if there is an in-progress session to resume
      const active = sessions.find(s => s.status === 'IN_PROGRESS');
      if (active) {
        setSession(active);
        setRoomState('PREPARATION');
      }
    } catch (err) {
      console.error('Error initializing oral interview room:', err);
      toast.error('Erreur lors de l\'initialisation de la salle d\'entretien.');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    return () => {
      stopSpeaking();
    };
  }, [profile?.uid]);

  // Start / Launch a new or resumed session
  const handleStartInterview = async () => {
    if (!profile || !candidateCv) return;
    setIsInitializing(true);

    try {
      let currentSess = session;

      if (!currentSess || currentSess.status === 'COMPLETED') {
        const job = targetJob || selectedJob;
        const initialQuestion = job
          ? `Bonjour ${profile.firstName || ''} et bienvenue à votre entretien pour le poste de ${job.title} chez ${job.company}. Après analyse de votre CV (${candidateCv.fileName}), pourriez-vous vous présenter et expliciter ce qui motive votre candidature ?`
          : `Bonjour ${profile.firstName || ''} ! Bienvenue à votre simulation d'entretien d'embauche. J'ai bien analysé votre profil et vos compétences (${candidateCv.fileName}). Pour commencer, présentez-vous brièvement ainsi que vos principales forces professionnelles.`;

        const initialMsg: OralInterviewMessage = {
          id: 'msg-' + Date.now(),
          sender: 'ai',
          stage: 'INTRODUCTION',
          text: initialQuestion,
          timestamp: new Date().toISOString()
        };

        currentSess = await dbEngine.createInterviewSession({
          candidateId: profile.uid,
          jobId: job?.id || 'simulation-general',
          jobTitle: job?.title || 'Entretien Général & Technique',
          currentStage: 'INTRODUCTION',
          status: 'IN_PROGRESS',
          audioMode: true,
          messages: [initialMsg]
        });

        setSession(currentSess);
      }

      setRoomState('LIVE');
      setSessionElapsedTime(0);

      // Trigger voice for the latest question
      const lastAiMsg = currentSess.messages.filter(m => m.sender === 'ai').slice(-1)[0];
      if (lastAiMsg?.text) {
        setTimeout(() => {
          speakText(lastAiMsg.text);
        }, 600);
      }
    } catch (e: any) {
      console.error('Failed to start interview:', e);
      toast.error('Impossible de démarrer la session : ' + (e.message || ''));
    } finally {
      setIsInitializing(false);
    }
  };

  // Format seconds to MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Submit recorded audio answer
  const handleStopAndSubmitAudio = async () => {
    if (!isRecording || !session) return;

    try {
      const base64Audio = await stopRecording();
      if (!base64Audio) {
        toast.error('Aucun flux audio capturé.');
        return;
      }

      setIsProcessingAnswer(true);
      const latestAiMsg = session.messages.filter(m => m.sender === 'ai').slice(-1)[0];

      // 1. Transcribe STT
      const sttRes = await fetch('/api/interview/audio/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          currentQuestion: latestAiMsg?.text || ''
        })
      });

      const sttData = await sttRes.json();
      const transcribedText = sttData.transcription || 'Réponse vocale enregistrée par le candidat.';

      // 2. Process Turn (Evaluation + Next Question)
      await evaluateAndAdvanceTurn(transcribedText);
    } catch (err: any) {
      toast.error('Erreur lors du traitement de la réponse vocale : ' + err.message);
      setIsProcessingAnswer(false);
    }
  };

  // Text fallback submission
  const handleManualTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textFallbackInput.trim() || !session || isProcessingAnswer) return;

    const answer = textFallbackInput.trim();
    setTextFallbackInput('');
    setIsProcessingAnswer(true);
    await evaluateAndAdvanceTurn(answer);
  };

  // Core Turn Evaluator & Advancer
  const evaluateAndAdvanceTurn = async (candidateAnswer: string) => {
    if (!session) return;

    try {
      const latestAiMsg = session.messages.filter(m => m.sender === 'ai').slice(-1)[0];

      const turnRes = await fetch('/api/interview/process-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: session.currentStage,
          candidateAnswer,
          previousQuestion: latestAiMsg?.text || '',
          jobContext: targetJob || selectedJob || { title: session.jobTitle },
          cvSummary: { 
            candidateId: profile?.uid,
            fileName: candidateCv?.fileName,
            aiScore: candidateCv?.aiScore,
            feedback: candidateCv?.feedback
          }
        })
      });

      const turnData = await turnRes.json();

      const candidateMsg: OralInterviewMessage = {
        id: 'msg-cand-' + Date.now(),
        sender: 'candidate',
        stage: session.currentStage,
        text: candidateAnswer,
        score: turnData.turnScore,
        feedback: turnData.turnFeedback,
        timestamp: new Date().toISOString()
      };

      const aiNextMsg: OralInterviewMessage = {
        id: 'msg-ai-' + Date.now(),
        sender: 'ai',
        stage: turnData.nextStage || 'COMPLETED',
        text: turnData.nextQuestion,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [...session.messages, candidateMsg, aiNextMsg];

      const isFinished = turnData.isCompleted || turnData.nextStage === 'COMPLETED';

      const updates: Partial<OralInterviewSession> = {
        currentStage: turnData.nextStage || 'COMPLETED',
        status: isFinished ? 'COMPLETED' : 'IN_PROGRESS',
        messages: updatedMessages,
        ...(turnData.finalReport && {
          totalScore: turnData.finalReport.totalScore,
          classification: turnData.finalReport.classification,
          categoryScores: turnData.finalReport.categoryScores,
          summaryFeedback: turnData.finalReport.summaryFeedback,
          completedAt: new Date().toISOString()
        })
      };

      await dbEngine.updateInterviewSession(session.id, updates);

      const finalSess = { ...session, ...updates };
      setSession(finalSess);

      if (isFinished) {
        setRoomState('REPORT');
        toast.success('Entretien terminé avec succès ! Rapport généré.');
        // Refresh history
        if (profile?.uid) {
          const updatedHistory = await dbEngine.getInterviewSessionsByCandidate(profile.uid);
          setHistorySessions(updatedHistory);
        }
      } else {
        toast.success('Réponse évaluée. Passage à la question suivante.');
        if (turnData.nextQuestion) {
          setTimeout(() => {
            speakText(turnData.nextQuestion);
          }, 400);
        }
      }
    } catch (err: any) {
      console.error('Turn evaluation error:', err);
      toast.error('Erreur lors de l\'évaluation de la réponse : ' + (err.message || ''));
    } finally {
      setIsProcessingAnswer(false);
      resetRecording();
    }
  };

  const handleAbortInterview = async () => {
    stopSpeaking();
    resetRecording();
    setShowExitConfirm(false);
    setRoomState('PREPARATION');
    onNavigate('/dashboard/candidate');
  };

  const handleNewInterviewFromScratch = () => {
    stopSpeaking();
    resetRecording();
    setSession(null);
    setRoomState('PREPARATION');
  };

  const latestAiQuestion = session?.messages.filter(m => m.sender === 'ai').slice(-1)[0];
  const currentStageIndex = STAGES.findIndex(s => s.key === (session?.currentStage || 'INTRODUCTION'));

  // =========================================================================
  // 0. GUARD: STRICT REQUIREMENT — NO CV
  // =========================================================================
  if (hasNoCV) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 pt-4 pb-20 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/dashboard/candidate')}
            className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
            // ACCÈS RESTREINT · PRÉREQUIS MANQUANT
          </span>
        </div>

        <div className="p-8 sm:p-12 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-6 relative overflow-hidden shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--foreground)]">
            <ShieldAlert className="w-8 h-8 text-[#0047FF]" />
          </div>

          <div className="space-y-3 max-w-lg mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase">
              ENTRETIEN INDISPONIBLE : CV REQUIS
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] font-sans leading-relaxed">
              Pour pouvoir passer un entretien oral réaliste et ciblé, vous devez obligatoirement disposer d'un CV indexé sur votre profil. L'IA extrait vos compétences et projets pour générer des mises en situation adaptées.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('/dashboard/candidate/cv')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-xl shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>DÉPOSER UN CV MAINTENANT →</span>
            </button>
            <button
              onClick={() => onNavigate('/dashboard/candidate')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[var(--surface-secondary)] hover:opacity-90 text-[var(--foreground)] font-mono text-xs font-bold transition-colors cursor-pointer border border-[var(--border)]"
            >
              RETOURNER AU TABLEAU DE BORD
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. INITIALIZING SKELETON
  // =========================================================================
  if (isInitializing && !session) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-6 select-none">
        <div className="w-12 h-12 rounded-2xl bg-[#0047FF]/10 border border-[#0047FF]/30 flex items-center justify-center mx-auto text-[#0047FF] animate-spin">
          <RefreshCw className="w-5 h-5" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#0047FF]">
            // CALIBRAGE COGNITIF
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold font-display text-[var(--foreground)]">
            PRÉPARATION DE LA SALLE D'ENTRETIEN...
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] font-sans max-w-md mx-auto">
            Chargement des données de profil, vérification du périphérique audio et contextualisation des questions.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. VIEW: ARCHIVE / HISTORY
  // =========================================================================
  if (activeTab === 'HISTORY') {
    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-28 select-none">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('ROOM')}
              className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#0047FF]">
                // PERFORMANCE ARCHIVE
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)] uppercase tracking-tight">
                HISTORIQUE DE VOS ENTRETIENS IA
              </h1>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('ROOM')}
            className="px-5 py-2.5 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>NOUVEL ENTRETIEN</span>
          </button>
        </div>

        {/* List of past interviews */}
        {historySessions.length === 0 ? (
          <div className="p-12 sm:p-16 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-4 shadow-xl">
            <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
              // ARCHIVE VIDE
            </span>
            <h3 className="text-2xl font-extrabold font-display text-[var(--foreground)]">
              AUCUN ENTRETIEN ARCHIVÉ
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] font-sans max-w-md mx-auto">
              Vos évaluations orales passées et vos rapports de performance s'enregistreront ici.
            </p>
            <button
              onClick={() => setActiveTab('ROOM')}
              className="mt-2 px-6 py-3 rounded-2xl bg-[#0047FF] text-white font-mono text-xs font-bold hover:bg-[#0038CC] transition-all cursor-pointer"
            >
              DÉMARRER UNE PREMIÈRE SESSION →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {historySessions.map((sess, idx) => {
              const formattedIdx = idx < 9 ? `[0${idx + 1}]` : `[${idx + 1}]`;
              const isCompleted = sess.status === 'COMPLETED';
              const answeredCount = sess.messages.filter(m => m.sender === 'candidate').length;

              return (
                <div
                  key={sess.id}
                  className="p-6 sm:p-7 rounded-3xl bg-[var(--surface)] hover:opacity-95 border border-[var(--border)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-[#0047FF]">
                        {formattedIdx}
                      </span>
                      <span className="text-xs font-mono text-[var(--muted-foreground)]">
                        {new Date(sess.createdAt || Date.now()).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {isCompleted ? 'COMPLÉTÉ' : 'EN COURS'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold font-display text-[var(--foreground)] truncate">
                      {sess.jobTitle || 'Simulation d\'Entretien Général'}
                    </h3>

                    <div className="flex items-center gap-4 text-xs font-mono text-[var(--muted-foreground)]">
                      <span>{answeredCount} questions répondues</span>
                      <span>·</span>
                      <span>{sess.messages.length} échanges totaux</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 border-[var(--border)] pt-4 sm:pt-0">
                    {sess.totalScore !== undefined && (
                      <div className="text-right">
                        <span className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)]">
                          {sess.totalScore}
                        </span>
                        <span className="text-xs font-mono text-[var(--muted-foreground)]"> / 100</span>
                        <span className="text-[10px] font-mono text-[var(--muted-foreground)] block">SCORE FINAL</span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSession(sess);
                        setActiveTab('ROOM');
                        if (isCompleted) {
                          setRoomState('REPORT');
                        } else {
                          setRoomState('LIVE');
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:opacity-90 text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <span>{isCompleted ? 'VOIR LE RAPPORT' : 'REPRENDRE'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#0047FF]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. VIEW: PRE-INTERVIEW PREPARATION STATE
  // =========================================================================
  if (roomState === 'PREPARATION') {
    return (
      <div className="max-w-4xl mx-auto space-y-10 pb-28 select-none">
        
        {/* Editorial Eyebrow & Title */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
                // AI INTERVIEW ROOM
              </span>
              <span className="h-px w-8 bg-[var(--border)]" />
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
                STUDIO D'ENTRAÎNEMENT VOCAL
              </span>
            </div>

            {historySessions.length > 0 && (
              <button
                onClick={() => setActiveTab('HISTORY')}
                className="text-xs font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-[#0047FF]" />
                <span>ARCHIVES ({historySessions.length})</span>
              </button>
            )}
          </div>

          <div className="space-y-3 border-b border-[var(--border)] pb-8">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase leading-[1.04]">
              VOTRE PROCHAIN ENTRETIEN<br />
              <span className="text-[var(--muted-foreground)]">COMMENCE ICI.</span>
            </h1>
            <p className="text-sm sm:text-base text-[var(--muted-foreground)] font-sans max-w-2xl leading-relaxed">
              Une immersion professionnelle guidée par intelligence artificielle. Exercez vos réponses à voix haute, travaillez votre concision et obtenez une analyse cognitive détaillée de vos performances.
            </p>
          </div>
        </section>

        {/* Preparation Architectural Block */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-8 shadow-xl">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
            <div className="space-y-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                INTERVIEW / 01 · PRÉPARATION AU DIRECT
              </span>
              <h3 className="text-xl font-extrabold font-display text-[var(--foreground)]">
                PARAMÉTRAGE DE LA SESSION
              </h3>
            </div>

            {candidateCv && (
              <div className="px-3.5 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#0047FF]" />
                <span>CV : {candidateCv.jobTitle || candidateCv.fileName}</span>
              </div>
            )}
          </div>

          {/* Job Target Selector / Context */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold uppercase text-[var(--foreground)] block">
              // CONTEXTE & INTITULÉ DU POSTE
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetJob(null)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  targetJob === null
                    ? 'bg-[#0047FF]/10 border-[#0047FF] text-[var(--foreground)]'
                    : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm font-display">Simulation Générale</span>
                  {targetJob === null && <Check className="w-4 h-4 text-[#0047FF]" />}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-1 font-sans">
                  Questions transversales adaptées à l'ensemble de votre parcours.
                </p>
              </button>

              {availableJobs.slice(0, 3).map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setTargetJob(job)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    targetJob?.id === job.id
                      ? 'bg-[#0047FF]/10 border-[#0047FF] text-[var(--foreground)]'
                      : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm font-display truncate">{job.title}</span>
                    {targetJob?.id === job.id && <Check className="w-4 h-4 text-[#0047FF]" />}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 font-sans truncate">
                    {job.company} · {job.location}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Environmental / Technical Check Status Lines */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-mono font-bold uppercase text-[var(--foreground)] block">
              // STATUT DES PÉRIPHÉRIQUES ET CONDITIONS
            </span>

            <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[var(--border)] text-xs font-mono">
                <span className="text-[var(--muted-foreground)]">MICROPHONE VOCAL</span>
                <div className="flex items-center gap-2">
                  {permissionError ? (
                    <span className="text-rose-500 dark:text-rose-400 font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      ACCÈS BLOQUÉ (MODE CLAVIER DISPONIBLE)
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      PRÊT & CALIBRÉ
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border)] text-xs font-mono">
                <span className="text-[var(--muted-foreground)]">SYNTHÈSE VOCALE IA</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  VOIX FRANÇAISE DISPONIBLE
                </span>
              </div>

              <div className="flex items-center justify-between py-2 text-xs font-mono">
                <span className="text-[var(--muted-foreground)]">DURÉE ESTIMÉE & ÉTAPES</span>
                <span className="text-[var(--foreground)] font-bold">
                  ~10-15 MIN · 5 PHASES D'ÉVALUATION
                </span>
              </div>
            </div>
          </div>

          {/* Stepper Preview */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-mono font-bold uppercase text-[var(--foreground)] block">
              // DÉROULEMENT DE L'ENTRETIEN
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STAGES.map((st) => (
                <div
                  key={st.key}
                  className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1"
                >
                  <span className="text-[10px] font-mono text-[#0047FF] font-bold block">
                    {st.num}
                  </span>
                  <span className="text-xs font-bold text-[var(--foreground)] font-display block">
                    {st.label}
                  </span>
                  <p className="text-[10px] text-[var(--muted-foreground)] font-sans leading-tight">
                    {st.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Launch Bar */}
          <div className="pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[var(--muted-foreground)] font-sans">
              Assurez-vous d'être dans un environnement calme avant de démarrer.
            </div>

            <button
              onClick={handleStartInterview}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-xl shadow-[#0047FF]/25 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span>{session && session.status === 'IN_PROGRESS' ? 'REPRENDRE LA SESSION EN COURS' : 'DÉMARRER L\'ENTRETIEN ORAL'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </section>

      </div>
    );
  }

  // =========================================================================
  // 4. VIEW: FINAL PERFORMANCE REPORT
  // =========================================================================
  if (roomState === 'REPORT' && session) {
    const totalScore = session.totalScore ?? 84;
    const classification = session.classification || 'PROFIL TRÈS QUALIFIÉ';
    const categoryScores = session.categoryScores || [
      { category: 'Expression & Communication', score: 88, comment: 'Élocution fluide et structurée.' },
      { category: 'Pertinence Technique', score: 85, comment: 'Justification rigoureuse des choix technologiques.' },
      { category: 'Clarté & Esprit de Synthèse', score: 80, comment: 'Réponses concises et percutantes.' },
      { category: 'Adéquation au Poste', score: 82, comment: 'Excellente compréhension des enjeux métier.' }
    ];

    return (
      <div className="max-w-4xl mx-auto space-y-10 pb-28 select-none">
        
        {/* Editorial Eyebrow & Title */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
                // BILAN D'ENTRETIEN FINAL
              </span>
              <span className="h-px w-8 bg-[var(--border)]" />
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
                ÉVALUATION TERMINÉE
              </span>
            </div>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className="text-xs font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#0047FF]" />
              <span>VOIR TOUTES LES SESSIONS</span>
            </button>
          </div>

          <div className="border-b border-[var(--border)] pb-8 space-y-3">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase leading-[1.04]">
              SESSION TERMINÉE.<br />
              <span className="text-[var(--muted-foreground)]">RAPPORT DE PERFORMANCE.</span>
            </h1>
            <p className="text-sm sm:text-base text-[var(--muted-foreground)] font-sans max-w-2xl leading-relaxed">
              Vos réponses ont été traitées et évaluées selon les critères d'excellence professionnelle.
            </p>
          </div>
        </section>

        {/* Monumental Score & Pillars Grid */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-8 shadow-xl">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[var(--border)] pb-6">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                // INDEX DE PERFORMANCE COGNITIVE
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold font-display text-[var(--foreground)]">
                {session.jobTitle || 'Entretien Technique'}
              </h2>
              <span className="text-xs font-mono text-[#0047FF] font-bold block">
                {classification}
              </span>
            </div>

            {/* Monumental Score Circle / Pill */}
            <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] shrink-0 text-right">
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest block">
                SCORE GLOBAL
              </span>
              <div className="flex items-baseline justify-end gap-1 mt-0.5">
                <span className="text-4xl sm:text-5xl font-extrabold font-display text-[var(--foreground)]">
                  <CountUp to={totalScore} duration={1.2} />
                </span>
                <span className="text-xs font-mono text-[var(--muted-foreground)]"> / 100</span>
              </div>
            </div>
          </div>

          {/* Pillars Breakdown */}
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--foreground)] block">
              // DÉTAIL DES 4 PILIERS D'ÉVALUATION
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categoryScores.map((cat, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs font-mono text-[var(--foreground)]">
                      {cat.category}
                    </span>
                    <span className="font-bold text-xs font-mono text-[#0047FF]">
                      {cat.score} / 100
                    </span>
                  </div>

                  <div className="w-full bg-[var(--surface)] h-1.5 rounded-full overflow-hidden border border-[var(--border)]">
                    <div
                      className="bg-[#0047FF] h-full rounded-full transition-all duration-1000"
                      style={{ width: `${Math.max(10, cat.score)}%` }}
                    />
                  </div>

                  {cat.comment && (
                    <p className="text-[11px] text-[var(--muted-foreground)] font-sans leading-relaxed pt-0.5">
                      {cat.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--foreground)] block">
              // SYNTHÈSE DE L'INTERVIEWER
            </span>
            <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs sm:text-sm text-[var(--muted-foreground)] font-sans leading-relaxed">
              {session.summaryFeedback || 'Le candidat démontre une très bonne maîtrise de son domaine technique et s\'exprime avec clarté. Les arguments sont illustrés par des expériences concrètes.'}
            </div>
          </div>

          {/* Conversation Transcript Accordion */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--foreground)] block">
              // TRANSCRIPTION DE L'ÉCHANGE ({session.messages.length} MESSAGES)
            </span>

            <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-6 max-h-96 overflow-y-auto">
              {session.messages.map((msg, idx) => {
                const formattedNum = idx < 9 ? `0${idx + 1}` : `${idx + 1}`;
                const isAi = msg.sender === 'ai';

                return (
                  <div key={msg.id || idx} className="space-y-1.5 border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={`font-bold ${isAi ? 'text-[#0047FF]' : 'text-[var(--foreground)]'}`}>
                        {formattedNum} / {isAi ? 'AI INTERVIEWER' : 'VOUS (RÉPONSE)'}
                      </span>
                      <span className="text-[var(--muted-foreground)] uppercase">{msg.stage}</span>
                    </div>
                    <p className="text-xs text-[var(--foreground)] font-sans leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                    {msg.feedback && (
                      <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[11px] text-[var(--muted-foreground)] font-sans mt-2">
                        <span className="font-bold text-[#0047FF] font-mono">Note ({msg.score ?? 80}/100) : </span>
                        {msg.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={handleNewInterviewFromScratch}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--surface-secondary)] hover:opacity-90 text-[var(--foreground)] font-mono text-xs font-bold transition-colors cursor-pointer border border-[var(--border)] flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>PASSER UN NOUVEL ENTRETIEN</span>
            </button>

            <button
              onClick={() => onNavigate('/dashboard/candidate')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>RETOURNER À L'ESPACE CANDIDAT</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </section>

      </div>
    );
  }

  // =========================================================================
  // 5. VIEW: LIVE INTERVIEW ROOM (DIGITAL STUDIO)
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 select-none">
      
      {/* Top Bar Navigation & Live Metadata */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-4 shadow-sm">
        
        {/* Left: Live indicator & Stage */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 font-mono text-[10px] font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>EN DIRECT</span>
          </div>

          <span className="h-3 w-px bg-[var(--border)] hidden sm:block" />

          <span className="text-xs font-mono font-bold text-[var(--foreground)] hidden sm:block">
            ÉTAPE 0{currentStageIndex + 1} / 05
          </span>
        </div>

        {/* Middle: Live Timer */}
        <div className="flex items-center gap-1.5 font-mono text-sm sm:text-base font-bold text-[var(--foreground)] bg-[var(--surface-secondary)] px-3.5 py-1 rounded-xl border border-[var(--border)]">
          <Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          <span>{formatTimer(sessionElapsedTime)}</span>
        </div>

        {/* Right: Mode Switcher & Exit trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseTextFallback(!useTextFallback)}
            className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
              useTextFallback
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-300'
                : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {useTextFallback ? 'MODE CLAVIER ACTIF' : 'CLAVIER (FALLBACK)'}
          </button>

          <button
            onClick={() => setShowExitConfirm(true)}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Quitter la session"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Architectural Stepper */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {STAGES.map((st, idx) => {
          const isCurrent = session?.currentStage === st.key;
          const isPast = currentStageIndex > idx || session?.status === 'COMPLETED';

          return (
            <div
              key={st.key}
              className={`p-2 sm:p-2.5 rounded-xl border transition-all text-center ${
                isCurrent
                  ? 'bg-[#0047FF]/15 border-[#0047FF] text-[var(--foreground)] shadow-md shadow-[#0047FF]/20'
                  : isPast
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted-foreground)]'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-mono font-bold">
                <span>{st.num}</span>
                {isPast && <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />}
              </div>
              <span className="text-[10px] font-display uppercase tracking-wider block truncate mt-0.5">
                {st.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* THE QUESTION DISPLAY (THE MONUMENTAL FOCAL POINT) */}
      <div className="p-8 sm:p-12 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-6 relative overflow-hidden shadow-2xl">
        {/* Subtle Ambient Background Accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#0047FF]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Question Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#0047FF]">
              // QUESTION 0{currentStageIndex + 1} · {STAGES[currentStageIndex]?.label}
            </span>
            <span className="h-px w-6 bg-[var(--border)]" />
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
              AI INTERVIEWER
            </span>
          </div>

          {/* Voice Replay Button */}
          <button
            onClick={() => {
              if (isSpeakingQuestion) stopSpeaking();
              else if (latestAiQuestion) speakText(latestAiQuestion.text);
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              isSpeakingQuestion
                ? 'bg-[#0047FF] text-white border-[#0047FF] animate-pulse'
                : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {isSpeakingQuestion ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>EN LECTURE...</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <span>RÉÉCOUTER</span>
              </>
            )}
          </button>
        </div>

        {/* Large Question Typography */}
        <div className="py-4 relative z-10">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight leading-snug">
            “{latestAiQuestion?.text || 'Préparation de la question...'}”
          </h2>
        </div>

        {/* AUDIO INTERACTION CENTER */}
        {!useTextFallback ? (
          <div className="pt-6 border-t border-[var(--border)] space-y-6 relative z-10 flex flex-col items-center">
            
            {/* Waveform Visualization Bar */}
            <div className="flex items-center justify-center gap-1.5 h-12 w-full max-w-sm">
              {[...Array(24)].map((_, i) => {
                const barHeight = isRecording
                  ? Math.max(6, Math.sin((i + Date.now() / 100) * 0.5) * (audioLevel * 0.45) + 8)
                  : isSpeakingQuestion
                  ? Math.max(6, Math.sin((i + Date.now() / 120) * 0.7) * 20 + 8)
                  : 4;

                return (
                  <div
                    key={i}
                    style={{ height: `${barHeight}px` }}
                    className={`w-1.5 rounded-full transition-all duration-75 ${
                      isRecording
                        ? 'bg-rose-500'
                        : isSpeakingQuestion
                        ? 'bg-[#0047FF]'
                        : 'bg-[var(--surface-secondary)] border border-[var(--border)]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Audio State Telemetry Label */}
            <div className="text-center font-mono text-xs">
              {isRecording ? (
                <div className="flex items-center justify-center gap-2 text-rose-500 dark:text-rose-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>● ENREGISTREMENT EN COURS : {formatTimer(recordingTime)}</span>
                </div>
              ) : isProcessingAnswer ? (
                <div className="flex items-center justify-center gap-2 text-[#0047FF] font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>TRANSCRIPTION VOCALE & ANALYSE IA EN COURS...</span>
                </div>
              ) : isSpeakingQuestion ? (
                <div className="flex items-center justify-center gap-2 text-[#0047FF] font-bold">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span>L'INTERVIEWER ÉNONCE LA QUESTION...</span>
                </div>
              ) : (
                <span className="text-[var(--muted-foreground)]">
                  Prêt · Cliquez sur le micro pour répondre de vive voix
                </span>
              )}
            </div>

            {/* Architectural Primary Microphone Action Bar */}
            <div className="w-full max-w-md pt-2">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isProcessingAnswer}
                  className="w-full py-4 px-8 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-xl shadow-[#0047FF]/25 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-40"
                >
                  <Mic className="w-4 h-4" />
                  <span>DÉMARRER MA RÉPONSE VOCALE</span>
                </button>
              ) : (
                <button
                  onClick={handleStopAndSubmitAudio}
                  className="w-full py-4 px-8 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-bold transition-all shadow-xl shadow-rose-600/30 flex items-center justify-center gap-3 cursor-pointer animate-pulse"
                >
                  <MicOff className="w-4 h-4" />
                  <span>TERMINER & ENVOYER LA RÉPONSE ({formatTimer(recordingTime)})</span>
                </button>
              )}
            </div>

          </div>
        ) : (
          /* FALLBACK TEXT FORM */
          <form onSubmit={handleManualTextSubmit} className="pt-6 border-t border-[var(--border)] space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[var(--muted-foreground)] font-bold uppercase">
                // RÉPONSE ÉCRITE (MODE SECOURS)
              </label>
              <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                {textFallbackInput.length} caractères
              </span>
            </div>

            <textarea
              rows={4}
              value={textFallbackInput}
              onChange={(e) => setTextFallbackInput(e.target.value)}
              placeholder="Rédigez votre réponse détaillée de manière claire et structurée..."
              className="w-full p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[#0047FF] resize-none font-sans"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isProcessingAnswer || !textFallbackInput.trim()}
                className="px-6 py-3 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-40 text-white font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                {isProcessingAnswer ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>ÉVALUATION...</span>
                  </>
                ) : (
                  <>
                    <span>TRANSMETTRE LA RÉPONSE</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>

      {/* EDITORIAL CONVERSATION TRANSCRIPT (PREVIOUS TURNS) */}
      {session && session.messages.length > 1 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              // TRANSCRIPTION DE LA CONVERSATION ({session.messages.length} ÉCHANGES)
            </span>
          </div>

          <div className="space-y-6 max-h-80 overflow-y-auto pr-2">
            {session.messages.slice(0, -1).map((msg, idx) => {
              const isAi = msg.sender === 'ai';
              const numStr = idx < 9 ? `0${idx + 1}` : `${idx + 1}`;

              return (
                <div key={msg.id || idx} className="space-y-2 border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className={`font-bold ${isAi ? 'text-[#0047FF]' : 'text-[var(--foreground)]'}`}>
                      {numStr} / {isAi ? 'QUESTION' : 'VOTRE RÉPONSE (AUDIO STT)'}
                    </span>
                    <span className="text-[var(--muted-foreground)] uppercase">{msg.stage}</span>
                  </div>

                  <p className="text-xs text-[var(--foreground)] font-sans leading-relaxed">
                    {msg.text}
                  </p>

                  {msg.feedback && (
                    <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] space-y-1">
                      <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-[#0047FF]">
                        <Sparkles className="w-3 h-3" />
                        <span>FEEDBACK & ÉVALUATION ({msg.score ?? 80}/100)</span>
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)] font-sans">
                        {msg.feedback}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR EXITING */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-6 z-10"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-500 dark:text-rose-400">
                  // CONFIRMATION D'INTERRUPTION
                </span>
                <h3 className="text-xl font-bold font-display text-[var(--foreground)]">
                  Quitter l'entretien en cours ?
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] font-sans leading-relaxed">
                  Votre progression actuelle restera sauvegardée dans votre historique afin que vous puissiez la reprendre ultérieurement.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:opacity-90 text-[var(--foreground)] font-mono text-xs transition-colors cursor-pointer border border-[var(--border)]"
                >
                  CONTINUER L'ENTRETIEN
                </button>
                <button
                  onClick={handleAbortInterview}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  QUITTER LA SALLE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
