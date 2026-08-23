import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { CanonicalPersistedCV, NewCanonicalCV } from '../src/types/cv-parser';
import type { CreateInterviewResponse, InterviewSession, SubmitAnswerResponse } from '../src/types/interview';
import type { CanonicalJob, CanonicalJobInput } from '../src/types/job';
import type { CVRepository } from '../src/server/cv-repository';
import type { JobRepository } from '../src/server/job-repository';
import { InterviewClientError } from '../src/server/interview-client';
import {
  createInterviewAnswerHandler,
  createInterviewCancelHandler,
  createInterviewGetHandler,
  createInterviewReportHandler,
  createInterviewStartHandler,
} from '../src/server/interview-route';
import { startInterviewForCandidate } from '../src/server/interview-service';

const question = { question_id: 'question-1', category: 'introduction' as const,
  question: 'Tell me about your background?', based_on: [], difficulty: 'easy' as const };
const report = { session_id: 'session-1', overall_score: 80, classification: 'good', questions_answered: 1,
  category_scores: { introduction: 80 }, strengths: ['Relevant'], areas_for_improvement: [], summary: 'Good response.' };

function session(status: InterviewSession['status'] = 'IN_PROGRESS'): InterviewSession {
  return { session_id: 'session-1', interview_type: 'mixed', status, current_question_index: status === 'COMPLETED' ? 1 : 0,
    max_questions: 1, created_at: '2026-01-01T00:00:00Z', completed_at: status === 'COMPLETED' ? '2026-01-01T00:01:00Z' : null,
    turns: [{ question, answer: status === 'COMPLETED' ? { question_id: 'question-1', answer: 'answer', submitted_at: '2026-01-01T00:00:30Z' } : null,
      evaluation: status === 'COMPLETED' ? { score: 80, classification: 'good', strengths: ['Relevant'], weaknesses: [], feedback: 'Good.' } : null }],
    final_report: status === 'COMPLETED' ? report : null };
}

const created: CreateInterviewResponse = { session: session(), first_question: question };
const answered: SubmitAnswerResponse = { session_id: 'session-1', status: 'COMPLETED',
  evaluation: { score: 80, classification: 'good', strengths: ['Relevant'], weaknesses: [], feedback: 'Good.' },
  next_question: null, final_report: report };

function cv(overrides: Partial<CanonicalPersistedCV> = {}): CanonicalPersistedCV {
  return { id: 'cv-1', uid: 'candidate-1', status: 'PROCESSED', isCurrent: true,
    parsedData: { identity: { full_name: 'Candidate', email: 'private@example.test', phone: '0600', linkedin: null,
      github: null, website: null, location: 'Oujda', job_title: 'Developer', other_links: [] }, summary: 'Profile',
      skills: [{ name: 'Python', category: 'language', source: 'skills_section' }], experiences: [], education: [], languages: [], certifications: [] },
    file: { originalName: 'private.pdf', mimeType: 'application/pdf', sizeBytes: 10, sha256: 'private-hash' },
    parsing: { schemaVersion: 1, parserVersion: 'v1', mode: 'deterministic', pageCount: 1, extractionMethod: 'native_pdf', warnings: [] },
    createdAt: '', updatedAt: '', ...overrides };
}

function job(): CanonicalJob {
  return { id: 'job-1', recruiterId: 'recruiter-1', title: 'Backend', company: 'Atlas', location: 'Oujda', description: 'Build APIs',
    required_skills: ['Python'], preferred_skills: [], minimum_experience_years: 2, maximum_experience_years: null,
    required_education: { minimum_level: 'Master', preferred_fields: [], mandatory: false }, required_languages: [],
    remote_allowed: false, work_mode: 'onsite', contract_type: 'CDI', mandatory_requirements: [], status: 'OPEN', schemaVersion: 1,
    createdAt: '', updatedAt: '' };
}

class CVs implements CVRepository {
  constructor(private readonly records: CanonicalPersistedCV[]) {}
  async getCVHistoryByUid() { return this.records; }
  async findEquivalentCV() { return null; }
  async saveCurrentCV(_input: NewCanonicalCV): Promise<CanonicalPersistedCV> { throw new Error('unused'); }
  async getCurrentCVByUid() { return null; }
  async getCurrentCanonicalCVs() { return []; }
}
class Jobs implements JobRepository {
  constructor(private readonly record: CanonicalJob | null) {}
  async getCanonicalJobById() { return this.record; }
  async createCanonicalJob(_uid: string, _input: CanonicalJobInput): Promise<CanonicalJob> { throw new Error('unused'); }
  async getJobsByRecruiter() { return []; }
  async getOpenCanonicalJobs() { return []; }
  async deleteRecruiterJob() { return false; }
}

function recorder() {
  const record: { status?: number; body?: any } = {};
  const response = { status(value: number) { record.status = value; return this; }, json(value: unknown) { record.body = value; return this; } };
  return { record, response: response as never };
}

async function invoke(handler: any, options: { candidate?: string; body?: unknown; sessionId?: string } = {}) {
  const request: any = { params: { sessionId: options.sessionId ?? 'session-1' }, body: options.body ?? {},
    ...(options.candidate ? { candidate: { uid: options.candidate, role: 'CANDIDATE' } } : {}) };
  const { record, response } = recorder();
  await handler(request, response, () => undefined);
  return record;
}

test('owned processed CV starts Interview with authenticated UID and frozen CV projection', async () => {
  let owner = '';
  let payload: any;
  const result = await startInterviewForCandidate('candidate-1', 'cv-1', undefined, {
    cvRepositoryFactory: () => new CVs([cv()]),
    start: async (candidateUserId, request) => { owner = candidateUserId; payload = request; return created; },
  });
  assert.equal(result.session.session_id, 'session-1');
  assert.equal(owner, 'candidate-1');
  assert.equal(payload.cv.identity.full_name, 'Candidate');
  const serialized = JSON.stringify(payload);
  for (const excluded of ['private@example.test', '0600', 'private.pdf', 'private-hash', 'candidate-1']) assert.equal(serialized.includes(excluded), false);
});

test('foreign and missing CVs are rejected without calling Engine', async () => {
  for (const records of [[cv({ uid: 'other' })], []]) {
    let called = false;
    await assert.rejects(startInterviewForCandidate('candidate-1', 'cv-1', undefined, {
      cvRepositoryFactory: () => new CVs(records), start: async () => { called = true; return created; },
    }), (error: any) => error.code === 'CV_NOT_FOUND');
    assert.equal(called, false);
  }
});

test('unusable CV is rejected', async () => {
  const unusable = cv({ parsedData: { identity: { full_name: null, email: null, phone: null, linkedin: null, github: null,
    website: null, location: null, job_title: null, other_links: [] }, summary: null, skills: [], experiences: [], education: [], languages: [], certifications: [] } });
  await assert.rejects(startInterviewForCandidate('candidate-1', 'cv-1', undefined, {
    cvRepositoryFactory: () => new CVs([unusable]),
  }), (error: any) => error.code === 'CV_NOT_USABLE');
});

test('optional Job uses deterministic adapter and missing Job fails safely', async () => {
  let payload: any;
  await startInterviewForCandidate('candidate-1', 'cv-1', 'job-1', {
    cvRepositoryFactory: () => new CVs([cv()]), jobRepositoryFactory: () => new Jobs(job()),
    start: async (_owner, request) => { payload = request; return created; },
  });
  assert.equal(payload.job.job_id, 'job-1');
  assert.equal(payload.job.minimum_experience, 'Minimum experience: 2 years');
  await assert.rejects(startInterviewForCandidate('candidate-1', 'cv-1', 'missing', {
    cvRepositoryFactory: () => new CVs([cv()]), jobRepositoryFactory: () => new Jobs(null),
  }), (error: any) => error.code === 'JOB_NOT_FOUND');
  await assert.rejects(startInterviewForCandidate('candidate-1', 'cv-1', 'closed', {
    cvRepositoryFactory: () => new CVs([cv()]), jobRepositoryFactory: () => new Jobs({ ...job(), id: 'closed', status: 'CLOSED' }),
  }), (error: any) => error.code === 'JOB_NOT_AVAILABLE' && error.status === 409);
});

test('start route requires candidate auth and rejects browser-selected identity', async () => {
  const handler = createInterviewStartHandler({ cvRepositoryFactory: () => new CVs([cv()]), start: async () => created });
  assert.equal((await invoke(handler, { body: { cvId: 'cv-1' } })).status, 401);
  const override = await invoke(handler, { candidate: 'candidate-1', body: { cvId: 'cv-1', candidateUserId: 'attacker' } });
  assert.equal(override.status, 400);
});

test('start route uses authenticated candidate UID, never body authority', async () => {
  let owner = '';
  const result = await invoke(createInterviewStartHandler({
    cvRepositoryFactory: () => new CVs([cv()]),
    start: async (candidateUserId) => { owner = candidateUserId; return created; },
  }), { candidate: 'candidate-1', body: { cvId: 'cv-1' } });
  assert.equal(result.status, 201);
  assert.equal(owner, 'candidate-1');
});

test('GET, answer, final-answer completion, cancel, and report propagate authenticated owner', async () => {
  const calls: Array<[string, string, string]> = [];
  const dependencies = {
    get: async (owner: string, id: string) => { calls.push(['get', owner, id]); return session('COMPLETED'); },
    submit: async (owner: string, id: string, request: any) => { calls.push(['answer', owner, `${id}:${request.question_id}`]); return answered; },
    cancel: async (owner: string, id: string) => { calls.push(['cancel', owner, id]); return { ...session(), status: 'CANCELLED' as const }; },
  };
  await invoke(createInterviewGetHandler(dependencies), { candidate: 'candidate-1' });
  const completion = await invoke(createInterviewAnswerHandler(dependencies), { candidate: 'candidate-1', body: { questionId: 'question-1', answer: 'final answer' } });
  assert.equal(completion.body.status, 'COMPLETED');
  await invoke(createInterviewCancelHandler(dependencies), { candidate: 'candidate-1' });
  const reportResult = await invoke(createInterviewReportHandler(dependencies), { candidate: 'candidate-1' });
  assert.equal(reportResult.body.report.session_id, 'session-1');
  assert.deepEqual(calls, [
    ['get', 'candidate-1', 'session-1'], ['answer', 'candidate-1', 'session-1:question-1'],
    ['cancel', 'candidate-1', 'session-1'], ['get', 'candidate-1', 'session-1'],
  ]);
});

test('report is unavailable before completion', async () => {
  const result = await invoke(createInterviewReportHandler({ get: async () => session() }), { candidate: 'candidate-1' });
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'INTERVIEW_REPORT_NOT_READY');
});

test('upstream auth, not-found, conflict, 5xx, and traceback bodies become stable safe errors', async () => {
  for (const [upstream, expectedStatus, expectedCode] of [
    [401, 502, 'INTERVIEW_ENGINE_AUTH_FAILED'], [404, 404, 'INTERVIEW_NOT_FOUND'],
    [409, 409, 'INTERVIEW_STATE_CONFLICT'], [500, 502, 'INTERVIEW_ENGINE_FAILURE'],
  ] as const) {
    const result = await invoke(createInterviewGetHandler({ get: async () => {
      throw new InterviewClientError('INTERVIEW_ENGINE_REJECTED', 'sanitized', upstream);
    } }), { candidate: 'candidate-1' });
    assert.equal(result.status, expectedStatus);
    assert.equal(result.body.error.code, expectedCode);
    assert.equal(JSON.stringify(result.body).includes('traceback'), false);
  }
});

test('answer validation enforces Engine limits and answer content is never logged', async () => {
  let called = false;
  const handler = createInterviewAnswerHandler({ submit: async () => { called = true; return answered; } });
  const blank = await invoke(handler, { candidate: 'candidate-1', body: { questionId: 'question-1', answer: '   ' } });
  const oversized = await invoke(handler, { candidate: 'candidate-1', body: { questionId: 'question-1', answer: 'x'.repeat(20_001) } });
  assert.equal(blank.status, 400);
  assert.equal(oversized.status, 400);
  assert.equal(called, false);
});

test('local Interview Engine startup disables access logs that expose session URLs', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const command = packageJson.scripts?.['dev:interview'];
  assert.equal(typeof command, 'string');
  assert.match(command, /(?:^|\s)--no-access-log(?:\s|$)/);
});
