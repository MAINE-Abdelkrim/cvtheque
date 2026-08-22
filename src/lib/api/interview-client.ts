import type { User } from 'firebase/auth';
import { auth } from '../firebase/client';
import type {
  InterviewAnswerResponse,
  InterviewEvaluation,
  InterviewFinalReport,
  InterviewQuestion,
  InterviewSession,
  InterviewSessionStatus,
  InterviewStartResponse,
  CandidateInterviewHistoryItem,
  CandidateInterviewHistoryResponse,
} from '../../types/interview-frontend';

export interface InterviewApiDependencies {
  getCurrentUser?: () => Pick<User, 'getIdToken'> | null;
  fetch?: typeof fetch;
}

export class InterviewApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'InterviewApiError';
  }
}

const statuses = new Set<InterviewSessionStatus>(['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const object = (value: unknown): Record<string, any> | null => typeof value === 'object' && value !== null ? value as Record<string, any> : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];

function question(value: unknown): InterviewQuestion {
  const item = object(value);
  if (!item || typeof item.question_id !== 'string' || typeof item.question !== 'string') throw invalidResponse();
  return { questionId: item.question_id, text: item.question, category: String(item.category ?? ''), difficulty: String(item.difficulty ?? '') };
}

function evaluation(value: unknown): InterviewEvaluation {
  const item = object(value);
  if (!item || typeof item.score !== 'number' || typeof item.classification !== 'string' || typeof item.feedback !== 'string') throw invalidResponse();
  return { score: item.score, classification: item.classification, strengths: strings(item.strengths), weaknesses: strings(item.weaknesses), feedback: item.feedback };
}

function report(value: unknown): InterviewFinalReport {
  const item = object(value);
  if (!item || typeof item.overall_score !== 'number' || typeof item.classification !== 'string' || typeof item.questions_answered !== 'number' || typeof item.summary !== 'string') throw invalidResponse();
  const scores = object(item.category_scores) ?? {};
  return {
    overallScore: item.overall_score,
    classification: item.classification,
    questionsAnswered: item.questions_answered,
    categoryScores: Object.fromEntries(Object.entries(scores).filter((entry): entry is [string, number] => typeof entry[1] === 'number')),
    strengths: strings(item.strengths),
    areasForImprovement: strings(item.areas_for_improvement),
    summary: item.summary,
  };
}

function status(value: unknown): InterviewSessionStatus {
  if (typeof value !== 'string' || !statuses.has(value as InterviewSessionStatus)) throw invalidResponse();
  return value as InterviewSessionStatus;
}

function session(value: unknown): InterviewSession {
  const item = object(value);
  if (!item || typeof item.session_id !== 'string' || typeof item.current_question_index !== 'number' || typeof item.max_questions !== 'number' || !Array.isArray(item.turns)) throw invalidResponse();
  return {
    sessionId: item.session_id,
    status: status(item.status),
    currentQuestionIndex: item.current_question_index,
    maxQuestions: item.max_questions,
    turns: item.turns.map(turn => {
      const value = object(turn);
      if (!value) throw invalidResponse();
      return { question: question(value.question), answered: value.answer !== null, evaluation: value.evaluation === null ? null : evaluation(value.evaluation) };
    }),
    finalReport: item.final_report === null ? null : report(item.final_report),
  };
}

function historyItem(value: unknown): CandidateInterviewHistoryItem {
  const item = object(value);
  if (!item || typeof item.sessionId !== 'string' || typeof item.interviewType !== 'string'
    || typeof item.createdAt !== 'string' || typeof item.questionsAnswered !== 'number'
    || typeof item.maxQuestions !== 'number') throw invalidResponse();
  if (!['general', 'behavioral', 'technical', 'mixed'].includes(item.interviewType)) throw invalidResponse();
  return {
    sessionId: item.sessionId,
    interviewType: item.interviewType as CandidateInterviewHistoryItem['interviewType'],
    status: status(item.status),
    createdAt: item.createdAt,
    completedAt: typeof item.completedAt === 'string' ? item.completedAt : null,
    questionsAnswered: item.questionsAnswered,
    maxQuestions: item.maxQuestions,
    overallScore: typeof item.overallScore === 'number' ? item.overallScore : null,
    classification: typeof item.classification === 'string' ? item.classification : null,
  };
}

function invalidResponse() { return new InterviewApiError('INTERVIEW_RESPONSE_INVALID', 'Une réponse invalide a été reçue.', 502); }

export function getInterviewErrorMessage(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 0;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (status === 401) return 'Votre session a expiré. Veuillez vous reconnecter.';
  if (status === 404) return "Cet entretien est introuvable ou n'est plus disponible.";
  if (status === 400 || status === 422) return 'Les informations envoyées sont invalides.';
  if (status === 503) return "Le service d'entretien est temporairement indisponible.";
  if (status === 504) return "Le service d'entretien met trop de temps à répondre.";
  if (status === 409 && code === 'JOB_NOT_AVAILABLE') return "Cette offre n'est plus disponible. Vous pouvez choisir une autre offre ou commencer un entretien général.";
  if (status === 409) return "Cette action n'est pas disponible dans l'état actuel de l'entretien.";
  return 'Une erreur est survenue. Veuillez réessayer.';
}

async function request(path: string, init: RequestInit, dependencies: InterviewApiDependencies): Promise<unknown> {
  const user = (dependencies.getCurrentUser ?? (() => auth?.currentUser))();
  if (!user) throw new InterviewApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await (dependencies.fetch ?? fetch)(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  } catch {
    throw new InterviewApiError('NETWORK_ERROR', 'The request could not be completed.', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = object(object(payload)?.error);
    throw new InterviewApiError(typeof error?.code === 'string' ? error.code : 'INTERVIEW_REQUEST_FAILED', 'The Interview request failed.', response.status);
  }
  return payload;
}

export async function startInterview(cvId: string, jobId?: string, dependencies: InterviewApiDependencies = {}): Promise<InterviewStartResponse> {
  const body = jobId ? { cvId, jobId } : { cvId };
  const payload = object(await request('/api/interviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, dependencies));
  if (!payload) throw invalidResponse();
  return { session: session(payload.session), firstQuestion: question(payload.first_question) };
}

export async function getInterview(sessionId: string, dependencies: InterviewApiDependencies = {}): Promise<InterviewSession> {
  return session(await request(`/api/interviews/${encodeURIComponent(sessionId)}`, {}, dependencies));
}

export async function listInterviews(pageSize = 20, cursor?: string, dependencies: InterviewApiDependencies = {}): Promise<CandidateInterviewHistoryResponse> {
  const query = new URLSearchParams({ pageSize: String(pageSize) });
  if (cursor) query.set('cursor', cursor);
  const payload = object(await request(`/api/interviews?${query.toString()}`, {}, dependencies));
  if (!payload || !Array.isArray(payload.interviews)) throw invalidResponse();
  return {
    interviews: payload.interviews.map(historyItem),
    nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : null,
  };
}

export async function submitInterviewAnswer(sessionId: string, questionId: string, answer: string, dependencies: InterviewApiDependencies = {}): Promise<InterviewAnswerResponse> {
  const payload = object(await request(`/api/interviews/${encodeURIComponent(sessionId)}/answers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId, answer }) }, dependencies));
  if (!payload || typeof payload.session_id !== 'string') throw invalidResponse();
  return { sessionId: payload.session_id, status: status(payload.status), evaluation: evaluation(payload.evaluation), nextQuestion: payload.next_question ? question(payload.next_question) : null, finalReport: payload.final_report ? report(payload.final_report) : null };
}

export async function cancelInterview(sessionId: string, dependencies: InterviewApiDependencies = {}): Promise<InterviewSession> {
  return session(await request(`/api/interviews/${encodeURIComponent(sessionId)}/cancel`, { method: 'POST' }, dependencies));
}

export async function getInterviewReport(sessionId: string, dependencies: InterviewApiDependencies = {}): Promise<InterviewFinalReport> {
  const payload = object(await request(`/api/interviews/${encodeURIComponent(sessionId)}/report`, {}, dependencies));
  if (!payload) throw invalidResponse();
  return report(payload.report);
}
