import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, MessageSquareText, RotateCcw, XCircle } from 'lucide-react';
import { getCurrentCandidateCV } from '../../lib/api/cv-parser-client';
import { getOpenCandidateJobs } from '../../lib/api/candidate-jobs';
import {
  cancelInterview,
  getInterview,
  getInterviewErrorMessage,
  getInterviewReport,
  InterviewApiError,
  startInterview,
  submitInterviewAnswer,
} from '../../lib/api/interview-client';
import type { CVParserSafeResponse } from '../../types/cv-parser';
import type { CandidateOpenJob } from '../../types/candidate-job';
import type { InterviewAnswerResponse, InterviewEvaluation, InterviewFinalReport, InterviewQuestion, InterviewSession } from '../../types/interview-frontend';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Dialog } from '../ui/dialog';
import { EmptyState } from '../ui/empty-state';
import { FormField, Textarea } from '../ui/form-controls';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { PageHeader, SectionHeader } from '../ui/page-header';

export const INTERVIEW_SESSION_STORAGE_KEY = 'candidateInterviewSessionId';
export type InterviewViewPhase = 'IDLE' | 'STARTING' | 'IN_PROGRESS' | 'SUBMITTING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';

export interface RecoveredInterviewState {
  phase: InterviewViewPhase;
  question: InterviewQuestion | null;
  questionIndex: number;
  evaluation: InterviewEvaluation | null;
  report: InterviewFinalReport | null;
}

export function canSubmitInterviewAnswer(answer: string, busy: boolean): boolean {
  return answer.trim().length > 0 && answer.length <= 20_000 && !busy;
}

export function recoverInterviewState(session: InterviewSession): RecoveredInterviewState {
  if (session.status === 'COMPLETED') return { phase: 'COMPLETED', question: null, questionIndex: session.currentQuestionIndex + 1, evaluation: null, report: session.finalReport };
  if (session.status === 'CANCELLED') return { phase: 'CANCELLED', question: null, questionIndex: session.currentQuestionIndex + 1, evaluation: null, report: null };
  if (session.status !== 'IN_PROGRESS') return { phase: 'ERROR', question: null, questionIndex: 0, evaluation: null, report: null };
  const unansweredIndex = session.turns.findIndex(turn => !turn.answered);
  const index = unansweredIndex >= 0 ? unansweredIndex : session.currentQuestionIndex;
  return { phase: 'IN_PROGRESS', question: session.turns[index]?.question ?? null, questionIndex: index + 1, evaluation: null, report: null };
}

export function applyInterviewAnswer(response: InterviewAnswerResponse): Pick<RecoveredInterviewState, 'phase' | 'evaluation' | 'report'> & { nextQuestion: InterviewQuestion | null } {
  return response.status === 'COMPLETED'
    ? { phase: 'COMPLETED', evaluation: response.evaluation, nextQuestion: null, report: response.finalReport }
    : { phase: 'IN_PROGRESS', evaluation: response.evaluation, nextQuestion: response.nextQuestion, report: null };
}

const categoryLabels: Record<string, string> = { introduction: 'Introduction', experience: 'Expérience', skills: 'Compétences', technical: 'Technique', behavioral: 'Comportemental', motivation: 'Motivation', problem_solving: 'Résolution de problème', education: 'Formation', job_fit: 'Adéquation au poste' };
const difficultyLabels: Record<string, string> = { easy: 'Facile', medium: 'Intermédiaire', hard: 'Difficile' };

export const InterviewView: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [phase, setPhase] = useState<InterviewViewPhase>('IDLE');
  const [cv, setCv] = useState<CVParserSafeResponse | null>(null);
  const [cvLoading, setCvLoading] = useState(true);
  const [jobs, setJobs] = useState<CandidateOpenJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsWarning, setJobsWarning] = useState('');
  const [selectedCvId, setSelectedCvId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(1);
  const [latestEvaluation, setLatestEvaluation] = useState<InterviewEvaluation | null>(null);
  const [nextQuestion, setNextQuestion] = useState<InterviewQuestion | null>(null);
  const [finalReport, setFinalReport] = useState<InterviewFinalReport | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [error, setError] = useState('');
  const [loadingLabel, setLoadingLabel] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadCv = async () => {
    setCvLoading(true);
    setError('');
    try {
      const result = await getCurrentCandidateCV();
      setCv(result);
      setSelectedCvId(result?.id ?? '');
    } catch (cause) {
      setError(getInterviewErrorMessage(cause));
      setPhase('ERROR');
    } finally { setCvLoading(false); }
  };

  const loadJobs = async () => {
    setJobsLoading(true); setJobsWarning('');
    try { setJobs(await getOpenCandidateJobs()); }
    catch { setJobs([]); setJobsWarning("Les offres ne peuvent pas être chargées actuellement. L'entretien général reste disponible."); }
    finally { setJobsLoading(false); }
  };

  useEffect(() => {
    let active = true;
    const recover = async () => {
      const storedId = sessionStorage.getItem(INTERVIEW_SESSION_STORAGE_KEY);
      if (!storedId) { if (active) { void loadJobs(); await loadCv(); } return; }
      setLoadingLabel("Chargement de l'entretien…");
      try {
        const recovered = await getInterview(storedId);
        if (!active) return;
        const state = recoverInterviewState(recovered);
        setSessionId(recovered.sessionId); setMaxQuestions(recovered.maxQuestions); setPhase(state.phase);
        setCurrentQuestion(state.question); setQuestionIndex(state.questionIndex); setLatestEvaluation(state.evaluation); setFinalReport(state.report);
        if (state.phase === 'ERROR') {
          sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY); setSessionId('');
          setError("Cet entretien ne peut pas être repris dans son état actuel.");
          void loadJobs(); void loadCv();
        } else if (state.phase === 'COMPLETED') {
          try { setFinalReport(await getInterviewReport(storedId)); }
          catch (cause) { if (!(cause instanceof InterviewApiError && cause.code === 'INTERVIEW_REPORT_NOT_READY')) setError(getInterviewErrorMessage(cause)); }
          sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
        } else if (state.phase === 'CANCELLED') sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof InterviewApiError && cause.status === 404) sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
        setError(getInterviewErrorMessage(cause)); setPhase('ERROR');
      } finally { if (active) setLoadingLabel(''); }
    };
    void recover();
    return () => { active = false; };
  }, []);

  const begin = async () => {
    if (!selectedCvId || phase === 'STARTING') return;
    setPhase('STARTING'); setError('');
    try {
      const result = await startInterview(selectedCvId, selectedJobId || undefined);
      setSessionId(result.session.sessionId); setCurrentQuestion(result.firstQuestion); setQuestionIndex(result.session.currentQuestionIndex + 1);
      setMaxQuestions(result.session.maxQuestions); setLatestEvaluation(null); setNextQuestion(null); setFinalReport(null); setAnswerDraft('');
      sessionStorage.setItem(INTERVIEW_SESSION_STORAGE_KEY, result.session.sessionId);
      setPhase('IN_PROGRESS');
    } catch (cause) { setError(getInterviewErrorMessage(cause)); setPhase('ERROR'); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionId || !currentQuestion || !canSubmitInterviewAnswer(answerDraft, phase === 'SUBMITTING')) return;
    setPhase('SUBMITTING'); setError('');
    try {
      const result = await submitInterviewAnswer(sessionId, currentQuestion.questionId, answerDraft.trim());
      const next = applyInterviewAnswer(result);
      setLatestEvaluation(next.evaluation); setNextQuestion(next.nextQuestion); setFinalReport(next.report); setPhase(next.phase);
      if (next.phase === 'COMPLETED') sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
    } catch (cause) { setError(getInterviewErrorMessage(cause)); setPhase('IN_PROGRESS'); }
  };

  const continueInterview = () => {
    if (!nextQuestion) return;
    setCurrentQuestion(nextQuestion); setNextQuestion(null); setLatestEvaluation(null); setAnswerDraft(''); setQuestionIndex(value => Math.min(value + 1, maxQuestions));
  };

  const confirmCancel = async () => {
    if (!sessionId || cancelling) return;
    setCancelling(true); setError('');
    try {
      await cancelInterview(sessionId);
      sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
      setAnswerDraft(''); setCurrentQuestion(null); setNextQuestion(null); setLatestEvaluation(null); setPhase('CANCELLED'); setCancelOpen(false);
    } catch (cause) { setError(getInterviewErrorMessage(cause)); setCancelOpen(false); }
    finally { setCancelling(false); }
  };

  const restart = () => {
    sessionStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
    setSessionId(''); setSelectedJobId(''); setCurrentQuestion(null); setLatestEvaluation(null); setNextQuestion(null); setFinalReport(null); setAnswerDraft(''); setError(''); setQuestionIndex(1); setPhase('IDLE');
    if (!cv) void loadCv();
  };

  if (loadingLabel) return <div className="space-y-6"><PageHeader title="AI Interview" description="Préparation de votre espace d'entretien." /><LoadingSkeleton variant="card" /><p className="text-center text-sm text-[var(--muted-foreground)]">{loadingLabel}</p></div>;

  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader title="AI Interview" description="Les questions s'adaptent à votre CV actuel. Le contexte d'une offre spécifique sera disponible dans une prochaine version." actions={(phase === 'IN_PROGRESS' || phase === 'SUBMITTING') && <Button variant="danger" onClick={() => setCancelOpen(true)} disabled={phase === 'SUBMITTING'}><XCircle className="h-4 w-4" />Annuler l'entretien</Button>} />

    {error && <div role="alert" className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-4 text-sm text-[var(--danger)]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

    {(phase === 'IDLE' || phase === 'STARTING' || (phase === 'ERROR' && !sessionId)) && <StartScreen cv={cv} loading={cvLoading} selected={selectedCvId} jobs={jobs} jobsLoading={jobsLoading} jobsWarning={jobsWarning} selectedJobId={selectedJobId} starting={phase === 'STARTING'} onSelect={setSelectedCvId} onSelectJob={setSelectedJobId} onStart={begin} onManageCv={() => onNavigate('/dashboard/candidate')} onRetry={loadCv} hasError={phase === 'ERROR'} />}

    {(phase === 'IN_PROGRESS' || phase === 'SUBMITTING') && currentQuestion && <>
      <Card>
        <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><SectionHeader title={`Question ${questionIndex} sur ${maxQuestions}`} /><div className="flex flex-wrap gap-2"><Badge tone="primary">{categoryLabels[currentQuestion.category] ?? currentQuestion.category}</Badge><Badge>{difficultyLabels[currentQuestion.difficulty] ?? currentQuestion.difficulty}</Badge></div></div></CardHeader>
        <CardContent><p className="text-base font-medium leading-7 text-[var(--foreground)] sm:text-lg">{currentQuestion.text}</p></CardContent>
      </Card>
      {latestEvaluation ? <EvaluationCard evaluation={latestEvaluation} onContinue={continueInterview} canContinue={Boolean(nextQuestion)} /> : <Card><form onSubmit={submit}><CardContent><FormField label="Votre réponse" htmlFor="interview-answer" helperText={`${answerDraft.length.toLocaleString('fr-FR')} / 20 000 caractères`} required><Textarea id="interview-answer" value={answerDraft} onChange={event => setAnswerDraft(event.target.value)} maxLength={20_000} rows={8} placeholder="Écrivez votre réponse…" disabled={phase === 'SUBMITTING'} /></FormField><p className="mt-3 text-xs text-[var(--muted-foreground)]">Votre réponse est conservée dans ce champ si l'envoi échoue.</p></CardContent><CardFooter className="flex justify-end"><Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canSubmitInterviewAnswer(answerDraft, phase === 'SUBMITTING')}>{phase === 'SUBMITTING' && <Loader2 className="h-4 w-4 animate-spin" />}Envoyer ma réponse</Button></CardFooter></form></Card>}
      <p className="text-center text-xs text-[var(--muted-foreground)]">Un entretien est actif. Utilisez « Annuler l'entretien » avant de quitter si vous ne souhaitez pas le reprendre.</p>
    </>}

    {phase === 'COMPLETED' && <FinalReport report={finalReport} evaluation={latestEvaluation} onDashboard={() => onNavigate('/dashboard/candidate')} onRestart={restart} />}
    {phase === 'CANCELLED' && <EmptyState title="Entretien annulé" description="L'entretien a été annulé. Vous pouvez revenir à votre espace candidat ou en commencer un nouveau." icon={XCircle} actionText="Retour à l'espace candidat" onAction={() => onNavigate('/dashboard/candidate')} />}
    {phase === 'CANCELLED' && <div className="flex justify-center"><Button variant="outline" onClick={restart}><RotateCcw className="h-4 w-4" />Commencer un nouvel entretien</Button></div>}

    <Dialog open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} title="Annuler l'entretien ?" description="Cette action mettra fin à la session en cours." footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>Continuer l'entretien</Button><Button variant="danger" onClick={confirmCancel} disabled={cancelling}>{cancelling && <Loader2 className="h-4 w-4 animate-spin" />}Confirmer l'annulation</Button></div>}><p className="text-sm text-[var(--muted-foreground)]">Les réponses déjà envoyées resteront associées à cette session, mais elle ne pourra plus être poursuivie.</p></Dialog>
  </div>;
};

const StartScreen: React.FC<{ cv: CVParserSafeResponse | null; loading: boolean; selected: string; jobs: CandidateOpenJob[]; jobsLoading: boolean; jobsWarning: string; selectedJobId: string; starting: boolean; hasError: boolean; onSelect: (id: string) => void; onSelectJob: (id: string) => void; onStart: () => void; onManageCv: () => void; onRetry: () => void }> = ({ cv, loading, selected, jobs, jobsLoading, jobsWarning, selectedJobId, starting, hasError, onSelect, onSelectJob, onStart, onManageCv, onRetry }) => {
  if (loading) return <LoadingSkeleton variant="list" />;
  if (hasError && !cv) return <EmptyState title="Impossible de charger votre CV" description="Réessayez ou revenez à votre espace candidat." icon={AlertCircle} actionText="Réessayer" onAction={onRetry} />;
  if (!cv?.id) return <EmptyState title="Aucun CV exploitable" description="Ajoutez et faites analyser un CV avant de commencer un entretien." icon={FileText} actionText="Gérer mon CV" onAction={onManageCv} />;
  return <Card><CardHeader><SectionHeader title="Choisissez votre CV" description="Seul votre CV actuel, traité et enregistré, peut être utilisé." /></CardHeader><CardContent className="space-y-5"><button type="button" onClick={() => onSelect(cv.id!)} aria-pressed={selected === cv.id} className={`w-full rounded-xl border p-4 text-left transition-colors ${selected === cv.id ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]"><FileText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">CV actuel</p><Badge tone="success">Traité</Badge></div><p className="mt-1 text-sm text-[var(--muted-foreground)]">{cv.cv.identity.job_title || 'Profil professionnel'}</p>{cv.createdAt && <p className="mt-1 text-xs text-[var(--muted-foreground)]">Traité le {new Date(cv.createdAt).toLocaleDateString('fr-FR')}</p>}</div><span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-4 ${selected === cv.id ? 'border-[var(--primary)]' : 'border-[var(--border-strong)]'}`} /></div></button><OptionalJobSelector jobs={jobs} loading={jobsLoading} warning={jobsWarning} selectedJobId={selectedJobId} onSelect={onSelectJob} /><div className="rounded-lg bg-[var(--surface-secondary)] p-4 text-sm text-[var(--muted-foreground)]"><p className="font-medium text-[var(--foreground)]">Comment fonctionne l'entretien ?</p><p className="mt-1">Les questions sont adaptées à votre parcours. Vous répondrez à une question à la fois et pourrez lire une évaluation avant de continuer.</p></div></CardContent><CardFooter className="flex justify-end"><Button size="lg" className="w-full sm:w-auto" disabled={!selected || starting} onClick={onStart}>{starting && <Loader2 className="h-4 w-4 animate-spin" />}Commencer l'entretien</Button></CardFooter></Card>;
};

const workModeLabels: Record<string, string> = { onsite: 'Sur site', hybrid: 'Hybride', remote: 'À distance' };

export const OptionalJobSelector: React.FC<{ jobs: CandidateOpenJob[]; loading: boolean; warning: string; selectedJobId: string; onSelect: (id: string) => void }> = ({ jobs, loading, warning, selectedJobId, onSelect }) => <section className="space-y-3" aria-labelledby="job-context-title"><div><h3 id="job-context-title" className="text-sm font-semibold">Contexte du poste (optionnel)</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Choisissez une offre pour adapter les questions à ce poste.</p></div>{warning && <p role="status" className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-3 text-sm text-[var(--warning)]">{warning}</p>}<button type="button" onClick={() => onSelect('')} aria-pressed={!selectedJobId} className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${!selectedJobId ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}><span className="font-medium">Entretien général basé sur mon CV</span><span className="mt-1 block text-xs text-[var(--muted-foreground)]">Aucune offre spécifique</span></button>{loading ? <LoadingSkeleton variant="list" /> : jobs.length === 0 ? <p className="rounded-lg bg-[var(--surface-secondary)] p-3 text-sm text-[var(--muted-foreground)]">Aucune offre ouverte n'est disponible actuellement. Vous pouvez tout de même commencer un entretien général basé sur votre CV.</p> : <div className="grid gap-3 sm:grid-cols-2">{jobs.map(job => { const details = [job.location, job.workMode ? workModeLabels[job.workMode] : null, job.contractType, `${job.minimumExperienceYears} an${job.minimumExperienceYears > 1 ? 's' : ''} minimum`].filter(Boolean); return <button key={job.jobId} type="button" onClick={() => onSelect(job.jobId)} aria-pressed={selectedJobId === job.jobId} className={`rounded-lg border p-4 text-left transition-colors ${selectedJobId === job.jobId ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}><p className="font-semibold text-[var(--foreground)]">{job.title}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{job.company}</p><p className="mt-2 text-xs text-[var(--muted-foreground)]">{details.join(' · ')}</p>{job.requiredSkills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{job.requiredSkills.slice(0, 4).map(skill => <Badge key={skill}>{skill}</Badge>)}</div>}</button>; })}</div>}</section>;

const EvaluationCard: React.FC<{ evaluation: InterviewEvaluation; canContinue: boolean; onContinue: () => void }> = ({ evaluation, canContinue, onContinue }) => <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><SectionHeader title="Évaluation de votre réponse" /><div className="flex items-center gap-2"><Badge tone="primary">Score : {evaluation.score}/100</Badge><Badge>{evaluation.classification}</Badge></div></div></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><FeedbackList title="Points forts" items={evaluation.strengths} tone="success" /><FeedbackList title="Points à améliorer" items={evaluation.weaknesses} tone="warning" /></div><div className="rounded-lg bg-[var(--surface-secondary)] p-4"><h3 className="text-sm font-semibold">Feedback</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted-foreground)]">{evaluation.feedback}</p></div></CardContent>{canContinue && <CardFooter className="flex justify-end"><Button size="lg" className="w-full sm:w-auto" onClick={onContinue}>Question suivante</Button></CardFooter>}</Card>;

const FeedbackList: React.FC<{ title: string; items: string[]; tone: 'success' | 'warning' }> = ({ title, items, tone }) => <div className="rounded-lg border border-[var(--border)] p-4"><h3 className={`text-sm font-semibold ${tone === 'success' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>{title}</h3>{items.length ? <ul className="mt-2 space-y-2 text-sm text-[var(--muted-foreground)]">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}</ul> : <p className="mt-2 text-sm text-[var(--muted-foreground)]">Aucun élément signalé.</p>}</div>;

const FinalReport: React.FC<{ report: InterviewFinalReport | null; evaluation: InterviewEvaluation | null; onDashboard: () => void; onRestart: () => void }> = ({ report, evaluation, onDashboard, onRestart }) => <div className="space-y-6"><div className="flex flex-col items-center rounded-xl border border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_7%,var(--surface))] px-5 py-8 text-center"><CheckCircle2 className="h-10 w-10 text-[var(--success)]" /><h2 className="mt-3 text-2xl font-semibold">Entretien terminé</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Merci d'avoir complété toutes les questions.</p></div>{evaluation && <EvaluationCard evaluation={evaluation} canContinue={false} onContinue={() => undefined} />}{report ? <Card><CardHeader><SectionHeader title="Rapport final" description="Synthèse informative de vos réponses, sans recommandation de recrutement." /></CardHeader><CardContent className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><Metric label="Score global" value={`${report.overallScore}/100`} /><Metric label="Classification" value={report.classification} /><Metric label="Questions répondues" value={String(report.questionsAnswered)} /></div><div><h3 className="mb-3 text-sm font-semibold">Scores par catégorie</h3><div className="space-y-3">{Object.entries(report.categoryScores).map(([name, score]) => <div key={name}><div className="mb-1 flex justify-between gap-4 text-sm"><span>{categoryLabels[name] ?? name}</span><span className="font-medium">{Number(score)}/100</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(0, Math.min(100, Number(score)))}%` }} /></div></div>)}</div></div><div className="grid gap-4 md:grid-cols-2"><FeedbackList title="Points forts" items={report.strengths} tone="success" /><FeedbackList title="Points à améliorer" items={report.areasForImprovement} tone="warning" /></div><div className="rounded-lg bg-[var(--surface-secondary)] p-4"><h3 className="text-sm font-semibold">Résumé</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted-foreground)]">{report.summary}</p></div></CardContent></Card> : <EmptyState title="Rapport en préparation" description="L'entretien est terminé, mais son rapport n'est pas encore disponible." icon={MessageSquareText} />}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onRestart}><RotateCcw className="h-4 w-4" />Nouvel entretien</Button><Button onClick={onDashboard}>Retour à l'espace candidat</Button></div></div>;

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-lg border border-[var(--border)] p-4"><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
