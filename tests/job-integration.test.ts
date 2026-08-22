import assert from 'node:assert/strict';
import test from 'node:test';
import type { App } from 'firebase-admin/app';
import { canonicalJobInputSchema, type CanonicalJob, type CanonicalJobInput } from '../src/types/job';
import { createRequireRecruiter } from '../src/server/recruiter-auth';
import { createJobCreateHandler, createJobDeleteHandler, createMyJobsHandler } from '../src/server/job-route';
import { JOB_SCHEMA_VERSION, sortCanonicalJobsNewestFirst, type JobRepository } from '../src/server/job-repository';
import { extractValidatedGeminiDraft } from '../src/server/job-ai';
import { JobClientError, jobPayloadOrError } from '../src/lib/api/job-client';

const validInput: CanonicalJobInput = {
  title: 'Backend Developer', company: 'Atlas', location: 'Casablanca', description: 'Build reliable APIs.',
  required_skills: [' Python ', 'Python', 'FastAPI'], preferred_skills: ['Docker'],
  minimum_experience_years: 2, maximum_experience_years: 5,
  required_education: { minimum_level: 'Master', preferred_fields: ['Computer Science'], mandatory: false },
  required_languages: [{ name: 'French', minimum_level: 'fluent', mandatory: true }],
  remote_allowed: true, work_mode: 'hybrid', contract_type: 'CDI', mandatory_requirements: [],
};

function recorder() {
  const record: { status?: number; body?: any } = {};
  const response = {
    status(value: number) { record.status = value; return this; },
    json(value: unknown) { record.body = value; return this; },
    send() { return this; },
  };
  return { record, response: response as never };
}

class MemoryJobs implements JobRepository {
  jobs: CanonicalJob[] = [];
  received: Array<{ recruiterId: string; input: CanonicalJobInput }> = [];
  legacy = [{ id: 'legacy', recruiterId: 'recruiter-a', title: 'Legacy', status: 'OPEN' }];
  async createCanonicalJob(recruiterId: string, input: CanonicalJobInput) {
    this.received.push({ recruiterId, input });
    const now = new Date().toISOString();
    const job: CanonicalJob = { id: `firestore-${this.jobs.length + 1}`, recruiterId, ...input, status: 'OPEN', schemaVersion: 1, createdAt: now, updatedAt: now };
    this.jobs.push(job); return job;
  }
  async getCanonicalJobById(id: string) { return this.jobs.find(job => job.id === id) ?? null; }
  async getJobsByRecruiter(uid: string) { return this.jobs.filter(job => job.recruiterId === uid); }
  async getOpenCanonicalJobs() { return this.jobs.filter(job => job.status === 'OPEN' && job.schemaVersion === 1); }
  async deleteRecruiterJob(id: string, uid: string) {
    const index = this.jobs.findIndex(job => job.id === id && job.recruiterId === uid);
    if (index < 0) return false;
    this.jobs.splice(index, 1); return true;
  }
}

async function auth(profile: Record<string, unknown> | null, authorization = 'Bearer token') {
  const request: any = { headers: { authorization } };
  const { record, response } = recorder();
  let next = false;
  await createRequireRecruiter(
    () => ({} as App),
    { async verifyToken() { return { uid: 'verified-recruiter' }; }, async getProfile() { return profile; } },
  )(request, response, () => { next = true; });
  return { request, record, next };
}

async function create(repository: MemoryJobs, body: unknown, uid = 'verified-recruiter') {
  const request: any = { recruiter: { uid, role: 'RECRUITER', subscription: 'PREMIUM' }, body };
  const { record, response } = recorder();
  await createJobCreateHandler(() => repository)(request, response, () => undefined);
  return record;
}

test('recruiter auth accepts active recruiter and attaches verified ownership', async () => {
  const result = await auth({ role: 'RECRUITER', isActive: true, subscription: 'PREMIUM' });
  assert.equal(result.next, true);
  assert.equal(result.request.recruiter.uid, 'verified-recruiter');
  assert.equal(result.request.recruiter.subscription, 'PREMIUM');
});

test('recruiter auth rejects unauthenticated users and candidates', async () => {
  const missing = await auth({ role: 'RECRUITER', isActive: true }, '');
  assert.equal(missing.record.status, 401);
  const candidate = await auth({ role: 'CANDIDATE', isActive: true });
  assert.equal(candidate.record.status, 403);
  assert.equal(candidate.record.body.error.code, 'RECRUITER_ROLE_REQUIRED');
});

test('authenticated recruiter creates canonical job with server identity and Firestore id', async () => {
  const repository = new MemoryJobs();
  const result = await create(repository, validInput);
  assert.equal(result.status, 201);
  assert.equal(result.body.id, 'firestore-1');
  assert.equal(result.body.recruiterId, 'verified-recruiter');
  assert.equal(result.body.schemaVersion, JOB_SCHEMA_VERSION);
  assert.equal(repository.received[0].recruiterId, 'verified-recruiter');
  assert.equal('id' in repository.received[0].input, false);
  assert.equal('recruiterId' in repository.received[0].input, false);
  assert.equal('createdAt' in repository.received[0].input, false);
});

test('server normalizes duplicate skills and preserves canonical content', async () => {
  const repository = new MemoryJobs();
  const result = await create(repository, validInput);
  assert.deepEqual(result.body.required_skills, ['Python', 'FastAPI']);
  assert.equal(result.body.description, validInput.description);
});

test('malformed payload, experience range, enum, and language are rejected', async () => {
  const repository = new MemoryJobs();
  for (const body of [
    { ...validInput, title: '' },
    { ...validInput, minimum_experience_years: 5, maximum_experience_years: 2 },
    { ...validInput, work_mode: 'sometimes' },
    { ...validInput, required_languages: [{ name: 'French', minimum_level: 7, mandatory: true }] },
  ]) {
    const result = await create(repository, body);
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'JOB_VALIDATION_FAILED');
  }
  assert.equal(repository.jobs.length, 0);
});

test('valid payload with omitted optional fields receives safe defaults', async () => {
  const repository = new MemoryJobs();
  const result = await create(repository, { title: 'Engineer', company: 'Atlas', location: 'Oujda', description: 'Engineering role.' });
  assert.equal(result.status, 201);
  assert.deepEqual(result.body.required_skills, []);
  assert.deepEqual(result.body.required_languages, []);
  assert.equal(result.body.maximum_experience_years, null);
});

test('client-controlled ownership and operational fields are rejected', async () => {
  const repository = new MemoryJobs();
  const result = await create(repository, { ...validInput, recruiterId: 'victim', id: 'stale', schemaVersion: 999, status: 'CLOSED' });
  assert.equal(result.status, 400);
  assert.equal(repository.jobs.length, 0);
});

test('mine retrieval returns only authenticated recruiter canonical jobs', async () => {
  const repository = new MemoryJobs();
  await create(repository, validInput, 'recruiter-a');
  await create(repository, validInput, 'recruiter-b');
  const request: any = { recruiter: { uid: 'recruiter-a', role: 'RECRUITER', subscription: 'FREE' } };
  const { record, response } = recorder();
  await createMyJobsHandler(() => repository)(request, response, () => undefined);
  assert.equal(record.body.jobs.length, 1);
  assert.equal(record.body.jobs[0].recruiterId, 'recruiter-a');
});

test('successful creation is exposed by the recruiter reload endpoint', async () => {
  const repository = new MemoryJobs();
  const created = await create(repository, validInput, 'recruiter-a');
  const request: any = { recruiter: { uid: 'recruiter-a', role: 'RECRUITER', subscription: 'FREE' } };
  const { record, response } = recorder();
  await createMyJobsHandler(() => repository)(request, response, () => undefined);
  assert.equal(record.status, undefined);
  assert.deepEqual(record.body.jobs.map((job: CanonicalJob) => job.id), [created.body.id]);
});

test('canonical recruiter jobs are sorted newest first without mutating repository results', () => {
  const older = { ...validInput, id: 'older', recruiterId: 'owner', status: 'OPEN' as const, schemaVersion: 1 as const, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
  const newer = { ...older, id: 'newer', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' };
  const source = [older, newer];
  assert.deepEqual(sortCanonicalJobsNewestFirst(source).map(job => job.id), ['newer', 'older']);
  assert.deepEqual(source.map(job => job.id), ['older', 'newer']);
});

test('frontend job client surfaces controlled server failures', async () => {
  const response = new Response(JSON.stringify({ error: { code: 'JOB_RETRIEVAL_FAILED', message: 'Unable to retrieve jobs.' } }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(
    () => jobPayloadOrError(response),
    (error: unknown) => error instanceof JobClientError
      && error.code === 'JOB_RETRIEVAL_FAILED'
      && error.status === 503
      && error.message === 'Unable to retrieve jobs.',
  );
});

test('recruiter cannot delete another recruiter canonical job', async () => {
  const repository = new MemoryJobs();
  const created = await create(repository, validInput, 'owner');
  const request: any = { recruiter: { uid: 'attacker', role: 'RECRUITER', subscription: 'FREE' }, params: { jobId: created.body.id } };
  const { record, response } = recorder();
  await createJobDeleteHandler(() => repository)(request, response, () => undefined);
  assert.equal(record.status, 404);
  assert.equal(repository.jobs.length, 1);
});

test('legacy and CLOSED jobs are excluded from matcher-ready OPEN retrieval', async () => {
  const repository = new MemoryJobs();
  await create(repository, validInput, 'owner');
  repository.jobs.push({ ...repository.jobs[0], id: 'closed', status: 'CLOSED' });
  const open = await repository.getOpenCanonicalJobs();
  assert.deepEqual(open.map(job => job.id), ['firestore-1']);
  assert.equal(repository.legacy.some(job => !('schemaVersion' in job)), true);
});

test('Gemini draft validation rejects malformed fields and strips noncanonical weights', () => {
  const invalid = extractValidatedGeminiDraft('```json\n{"job_title":"Engineer","work_mode":"teleport"}\n```');
  assert.equal(invalid.invalid, true);
  assert.equal(invalid.draft, null);
  const valid = extractValidatedGeminiDraft('```json\n{"job_title":"Engineer","required_skills":["Go","Go"],"scoring_weights":{"skills_weight":99}}\n```');
  assert.equal(valid.invalid, false);
  assert.deepEqual(valid.draft?.required_skills, ['Go']);
  assert.equal('scoring_weights' in (valid.draft ?? {}), false);
});

test('public canonical response excludes internal Firebase metadata', async () => {
  const repository = new MemoryJobs();
  const result = await create(repository, validInput);
  const serialized = JSON.stringify(result.body);
  for (const forbidden of ['_fieldsProto', 'writeTime', 'readTime', 'serviceAccount']) assert.equal(serialized.includes(forbidden), false);
});

test('canonical schema can validate matching content without scoring weights', () => {
  const parsed = canonicalJobInputSchema.parse(validInput);
  assert.equal('scoring_weights' in parsed, false);
});
