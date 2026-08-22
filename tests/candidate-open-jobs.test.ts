import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalJob, CanonicalJobInput } from '../src/types/job';
import type { JobRepository } from '../src/server/job-repository';
import { CANDIDATE_OPEN_JOBS_LIMIT, createCandidateOpenJobsHandler, toCandidateOpenJob } from '../src/server/job-route';
import { getOpenCandidateJobs } from '../src/lib/api/candidate-jobs';

const input: CanonicalJobInput = { title: 'Backend Developer', company: 'Atlas', location: 'Oujda', description: 'Private full description', required_skills: ['TypeScript', 'Node.js'], preferred_skills: ['Docker'], minimum_experience_years: 2, maximum_experience_years: 5, required_education: { minimum_level: 'Master', preferred_fields: [], mandatory: false }, required_languages: [], remote_allowed: true, work_mode: 'hybrid', contract_type: 'CDI', mandatory_requirements: ['private requirement'] };
const job = (id: string, status: CanonicalJob['status'] = 'OPEN', createdAt = '2026-01-01T00:00:00Z'): CanonicalJob => ({ id, recruiterId: 'private-recruiter', ...input, status, schemaVersion: 1, createdAt, updatedAt: createdAt });

class Jobs implements JobRepository {
  constructor(private readonly records: CanonicalJob[]) {}
  async getOpenCanonicalJobs() { return this.records.filter(item => item.status === 'OPEN' && item.schemaVersion === 1).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async getCanonicalJobById(id: string) { return this.records.find(item => item.id === id) ?? null; }
  async createCanonicalJob(_uid: string, _input: CanonicalJobInput): Promise<CanonicalJob> { throw new Error('unused'); }
  async getJobsByRecruiter() { return []; }
  async deleteRecruiterJob() { return false; }
}

function responseRecorder() {
  const record: { status?: number; body?: any } = {};
  const response = { status(value: number) { record.status = value; return this; }, json(value: unknown) { record.body = value; return this; } };
  return { record, response: response as never };
}

test('candidate open Job handler rejects missing authenticated candidate', async () => {
  const { record, response } = responseRecorder();
  await createCandidateOpenJobsHandler(() => new Jobs([]))({} as never, response, () => undefined);
  assert.equal(record.status, 401);
  assert.equal(record.body.error.code, 'AUTH_REQUIRED');
});

test('candidate receives only OPEN Jobs in repository newest-first order', async () => {
  const repository = new Jobs([job('older'), job('closed', 'CLOSED', '2026-03-01T00:00:00Z'), job('newer', 'OPEN', '2026-02-01T00:00:00Z')]);
  const { record, response } = responseRecorder();
  await createCandidateOpenJobsHandler(() => repository)({ candidate: { uid: 'candidate', role: 'CANDIDATE' } } as never, response, () => undefined);
  assert.deepEqual(record.body.jobs.map((item: any) => item.jobId), ['newer', 'older']);
  assert.equal(record.body.jobs.some((item: any) => item.jobId === 'closed'), false);
});

test('candidate projection contains exactly safe fields', () => {
  const projected = toCandidateOpenJob(job('job-1'));
  assert.deepEqual(Object.keys(projected).sort(), ['company', 'contractType', 'createdAt', 'jobId', 'location', 'minimumExperienceYears', 'requiredSkills', 'title', 'workMode'].sort());
  const serialized = JSON.stringify(projected);
  for (const excluded of ['recruiterId', 'schemaVersion', 'status', 'updatedAt', 'preferredSkills', 'required_education', 'required_languages', 'mandatory_requirements', 'Private full description', 'private-recruiter']) assert.equal(serialized.includes(excluded), false);
});

test('candidate open Job endpoint caps results at 100 without reordering', async () => {
  const records = Array.from({ length: CANDIDATE_OPEN_JOBS_LIMIT + 5 }, (_, index) => job(`job-${index}`, 'OPEN', new Date(Date.UTC(2026, 0, index + 1)).toISOString()));
  const repository = new Jobs(records);
  const expected = (await repository.getOpenCanonicalJobs()).slice(0, 100).map(item => item.id);
  const { record, response } = responseRecorder();
  await createCandidateOpenJobsHandler(() => repository)({ candidate: { uid: 'candidate', role: 'CANDIDATE' } } as never, response, () => undefined);
  assert.equal(record.body.jobs.length, 100);
  assert.deepEqual(record.body.jobs.map((item: any) => item.jobId), expected);
});

test('frontend candidate Job client uses Firebase bearer token and relative Express URL', async () => {
  let captured: { url: string; init: RequestInit } | undefined; let tokenCalls = 0;
  const jobs = await getOpenCandidateJobs({ getCurrentUser: () => ({ getIdToken: async () => { tokenCalls += 1; return 'firebase-token'; } }), fetch: async (url, init = {}) => { captured = { url: String(url), init }; return Response.json({ jobs: [toCandidateOpenJob(job('job-1'))] }); } });
  assert.equal(tokenCalls, 1);
  assert.equal(captured?.url, '/api/jobs/open');
  assert.equal(new Headers(captured?.init.headers).get('authorization'), 'Bearer firebase-token');
  assert.equal(jobs[0].jobId, 'job-1');
  assert.ok(!/https?:\/\/|firestore|8003/i.test(captured?.url ?? ''));
});

test('frontend mapping strips unexpected private response fields', async () => {
  const unsafe = { ...toCandidateOpenJob(job('job-1')), recruiterId: 'private', status: 'OPEN', schemaVersion: 1, description: 'private' };
  const jobs = await getOpenCandidateJobs({ getCurrentUser: () => ({ getIdToken: async () => 'token' }), fetch: async () => Response.json({ jobs: [unsafe] }) });
  assert.equal(JSON.stringify(jobs).includes('private'), false);
  assert.deepEqual(Object.keys(jobs[0]).sort(), Object.keys(toCandidateOpenJob(job('job-1'))).sort());
});
