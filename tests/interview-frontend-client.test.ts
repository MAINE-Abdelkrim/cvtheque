import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancelInterview,
  getInterview,
  getInterviewErrorMessage,
  getInterviewReport,
  InterviewApiError,
  startInterview,
  submitInterviewAnswer,
  type InterviewApiDependencies,
} from '../src/lib/api/interview-client';

const rawQuestion = { question_id: 'question-1', question: 'Présentez votre parcours.', category: 'introduction', difficulty: 'easy', based_on: ['private-grounding'] };
const rawEvaluation = { score: 80, classification: 'Solide', strengths: ['Clarté'], weaknesses: ['Plus de détails'], feedback: 'Une réponse claire.' };
const rawReport = { session_id: 'session-1', overall_score: 80, classification: 'Solide', questions_answered: 1, category_scores: { introduction: 80 }, strengths: ['Clarté'], areas_for_improvement: ['Détails'], summary: 'Bonne synthèse.' };
const rawSession = { session_id: 'session-1', interview_type: 'mixed', status: 'IN_PROGRESS', current_question_index: 0, max_questions: 5, created_at: '2026-01-01T00:00:00Z', completed_at: null, turns: [{ question: rawQuestion, answer: null, evaluation: null }], final_report: null };

function dependencies(handler: (url: string, init: RequestInit) => Response | Promise<Response>): InterviewApiDependencies & { tokenCalls: () => number } {
  let calls = 0;
  return {
    getCurrentUser: () => ({ getIdToken: async () => { calls += 1; return 'firebase-id-token'; } }),
    fetch: async (input, init = {}) => handler(String(input), init),
    tokenCalls: () => calls,
  };
}

test('start obtains Firebase token, uses relative Express URL, and sends only cvId', async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  const deps = dependencies((url, init) => { captured = { url, init }; return Response.json({ session: rawSession, first_question: rawQuestion }, { status: 201 }); });
  const result = await startInterview('cv-1', undefined, deps);
  assert.equal(deps.tokenCalls(), 1);
  assert.equal(captured?.url, '/api/interviews');
  assert.equal(new Headers(captured?.init.headers).get('authorization'), 'Bearer firebase-id-token');
  assert.deepEqual(JSON.parse(String(captured?.init.body)), { cvId: 'cv-1' });
  assert.equal('candidateUserId' in JSON.parse(String(captured?.init.body)), false);
  assert.equal(result.firstQuestion.text, 'Présentez votre parcours.');
  assert.equal('based_on' in result.firstQuestion, false);
});

test('answer uses encoded session endpoint and exact questionId/answer body', async () => {
  let url = ''; let body: any;
  const deps = dependencies((value, init) => { url = value; body = JSON.parse(String(init.body)); return Response.json({ session_id: 'session-1', status: 'IN_PROGRESS', evaluation: rawEvaluation, next_question: rawQuestion, final_report: null }); });
  const result = await submitInterviewAnswer('session/unsafe', 'question-1', 'Réponse privée', deps);
  assert.equal(url, '/api/interviews/session%2Funsafe/answers');
  assert.deepEqual(body, { questionId: 'question-1', answer: 'Réponse privée' });
  assert.equal(result.evaluation.score, 80);
});

test('start with optional Job sends only cvId and jobId', async () => {
  let body: any;
  const deps = dependencies((_url, init) => { body = JSON.parse(String(init.body)); return Response.json({ session: rawSession, first_question: rawQuestion }, { status: 201 }); });
  await startInterview('cv-1', 'job-1', deps);
  assert.deepEqual(body, { cvId: 'cv-1', jobId: 'job-1' });
  for (const excluded of ['candidateUserId', 'ownerId', 'recruiterId', 'job', 'cv']) assert.equal(excluded in body, false);
});

test('get, cancel, and report use their relative Express endpoints', async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const deps = dependencies((url, init) => {
    calls.push({ url, method: init.method });
    if (url.endsWith('/report')) return Response.json({ report: rawReport });
    return Response.json(url.endsWith('/cancel') ? { ...rawSession, status: 'CANCELLED' } : rawSession);
  });
  await getInterview('session-1', deps); await cancelInterview('session-1', deps); await getInterviewReport('session-1', deps);
  assert.deepEqual(calls, [
    { url: '/api/interviews/session-1', method: undefined },
    { url: '/api/interviews/session-1/cancel', method: 'POST' },
    { url: '/api/interviews/session-1/report', method: undefined },
  ]);
});

test('server errors retain only safe code/status and never expose backend text', async () => {
  const deps = dependencies(() => Response.json({ error: { code: 'INTERVIEW_REPORT_NOT_READY', message: 'internal URL and traceback' } }, { status: 409 }));
  await assert.rejects(getInterviewReport('session-1', deps), (cause: any) => cause instanceof InterviewApiError && cause.code === 'INTERVIEW_REPORT_NOT_READY' && cause.status === 409 && !cause.message.includes('traceback'));
});

test('503 and 504 map to safe candidate messages', () => {
  assert.equal(getInterviewErrorMessage(new InterviewApiError('X', 'private', 503)), "Le service d'entretien est temporairement indisponible.");
  assert.equal(getInterviewErrorMessage(new InterviewApiError('X', 'private', 504)), "Le service d'entretien met trop de temps à répondre.");
});

test('unavailable selected Job maps to actionable safe guidance', () => {
  assert.equal(getInterviewErrorMessage(new InterviewApiError('JOB_NOT_AVAILABLE', 'private state', 409)), "Cette offre n'est plus disponible. Vous pouvez choisir une autre offre ou commencer un entretien général.");
});

test('all client routes are relative and contain no Interview Engine address', async () => {
  const urls: string[] = [];
  const deps = dependencies((url) => { urls.push(url); return Response.json({ session: rawSession, first_question: rawQuestion }, { status: 201 }); });
  await startInterview('cv-1', undefined, deps);
  assert.ok(urls.every(url => url.startsWith('/api/')));
  assert.ok(urls.every(url => !/8003|interview-engine|https?:\/\//i.test(url)));
});
