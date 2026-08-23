import assert from 'node:assert/strict';
import test from 'node:test';
import type { App } from 'firebase-admin/app';
import { createRequireRecruiter } from '../src/server/recruiter-auth';
import { createJobMatchingHandler } from '../src/server/matching-route';
import { MatchingClientError, rankCandidates } from '../src/server/matching-client';
import type { CVRepository } from '../src/server/cv-repository';
import type { JobRepository } from '../src/server/job-repository';
import type { CanonicalPersistedCV, NewCanonicalCV } from '../src/types/cv-parser';
import type { CanonicalJob, CanonicalJobInput } from '../src/types/job';
import type { MatchingRankingRequest, MatchingRankingResponse } from '../src/types/matching';

function recorder() {
  const record: { status?: number; body?: any } = {};
  const response = {
    status(value: number) { record.status = value; return this; },
    json(value: unknown) { record.body = value; return this; },
  };
  return { record, response: response as never };
}

function job(overrides: Partial<CanonicalJob> = {}): CanonicalJob {
  return {
    id: 'job-1', recruiterId: 'owner', title: 'Backend Developer', company: 'Atlas', location: 'Oujda', description: 'Build APIs',
    required_skills: ['Python'], preferred_skills: ['Docker'], minimum_experience_years: 1, maximum_experience_years: null,
    required_education: { minimum_level: 'Master', preferred_fields: [], mandatory: false }, required_languages: [],
    remote_allowed: false, work_mode: 'onsite', contract_type: 'CDI', mandatory_requirements: ['Free-text permit'],
    status: 'OPEN', schemaVersion: 1, createdAt: '', updatedAt: '', ...overrides,
  };
}

function cv(id = 'cv-1', uid = 'candidate-1'): CanonicalPersistedCV {
  return {
    id, uid, status: 'PROCESSED', isCurrent: true,
    parsedData: {
      identity: { full_name: 'Candidate One', email: 'private@example.test', phone: '0600', linkedin: null, github: null, website: null, location: 'Oujda', job_title: null, other_links: [] },
      summary: 'Backend profile', skills: [{ name: 'Python', category: null, source: null }],
      experiences: [], education: [], languages: [], certifications: [],
    },
    file: { originalName: 'private.pdf', mimeType: 'application/pdf', sizeBytes: 12, sha256: 'secret-hash' },
    parsing: { schemaVersion: 1, parserVersion: 'v1', mode: 'deterministic', pageCount: 1, extractionMethod: 'native', warnings: [] },
    createdAt: '', updatedAt: '',
  };
}

class Jobs implements JobRepository {
  constructor(public value: CanonicalJob | null) {}
  async getCanonicalJobById() { return this.value; }
  async createCanonicalJob(_uid: string, _input: CanonicalJobInput): Promise<CanonicalJob> { throw new Error('unused'); }
  async getJobsByRecruiter() { return []; }
  async getOpenCanonicalJobs() { return []; }
  async deleteRecruiterJob() { return false; }
}

class CVs implements CVRepository {
  constructor(public values: CanonicalPersistedCV[]) {}
  async getCurrentCanonicalCVs() { return this.values; }
  async findEquivalentCV() { return null; }
  async saveCurrentCV(_input: NewCanonicalCV): Promise<CanonicalPersistedCV> { throw new Error('unused'); }
  async getCurrentCVByUid() { return null; }
  async getCVHistoryByUid() { return []; }
}

function ranking(candidateId = 'cv-1'): MatchingRankingResponse {
  return {
    job_id: 'job-1', job_title: 'Backend Developer', candidates_received: 1, candidates_evaluated: 1,
    invalid_candidates_count: 0, duplicate_candidates_count: 0, eligible_candidates_count: 1,
    ineligible_candidates_count: 0, requested_top_k: 3, returned_candidates_count: 1,
    top_candidates: [{
      rank: 1, candidate_id: candidateId, candidate_name: 'Candidate One', score: 88, match_level: 'Strong match', eligible: true,
      eligibility_message: 'Eligible', summary: 'Good fit', required_skills: { matched_count: 1, required_count: 1, display: '1 of 1', matched: ['Python'], missing: [] },
      experience: { candidate_years: 2, required_years: 1, status: 'Meets requirement', display: '2 years' },
      education: { status: 'Compatible', display: 'Compatible' }, languages: { status: 'Not specified', display: 'Not specified' },
      location_and_work_mode: { status: 'Compatible', display: 'Compatible' }, contract: { status: 'Compatible', display: 'Compatible' },
      main_strengths: ['Python'], main_gaps: [], mandatory_failures: [],
    }], invalid_candidates: [], duplicate_candidates: [], summary: 'One candidate evaluated.',
    metadata: { matching_version: '1.0.0', ranking_version: '1.0.0', processed_at: new Date(0).toISOString(), processing_time_ms: 1 },
  };
}

async function invoke(options: { currentJob?: CanonicalJob | null; cvs?: CanonicalPersistedCV[]; uid?: string; rank?: (request: MatchingRankingRequest) => Promise<MatchingRankingResponse>; recruiter?: boolean } = {}) {
  const request: any = { params: { jobId: 'job-1' }, ...(options.recruiter === false ? {} : { recruiter: { uid: options.uid ?? 'owner', role: 'RECRUITER', subscription: 'FREE' } }) };
  const { record, response } = recorder();
  await createJobMatchingHandler({
    jobRepositoryFactory: () => new Jobs(options.currentJob === undefined ? job() : options.currentJob),
    cvRepositoryFactory: () => new CVs(options.cvs ?? [cv()]),
    rank: options.rank ?? (async () => ranking()),
  })(request, response, () => undefined);
  return record;
}

test('route requires attached authenticated recruiter identity', async () => {
  assert.equal((await invoke({ recruiter: false })).status, 401);
});

test('recruiter middleware rejects a candidate role', async () => {
  const request: any = { headers: { authorization: 'Bearer token' } };
  const { record, response } = recorder();
  await createRequireRecruiter(() => ({} as App), { async verifyToken() { return { uid: 'candidate' }; }, async getProfile() { return { role: 'CANDIDATE', isActive: true }; } })(request, response, () => assert.fail('must not continue'));
  assert.equal(record.status, 403);
});

test('owner matches multiple CVs in exactly one bulk call with safe options and inputs', async () => {
  const requests: MatchingRankingRequest[] = [];
  const cvs = [cv('cv-1', 'uid-1'), cv('cv-2', 'uid-2')];
  const result = await invoke({ cvs, rank: async request => { requests.push(request); return ranking('cv-1'); } });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].candidates.length, 2);
  assert.deepEqual(requests[0].options, { top_k: 3, include_technical_details: false, invalid_candidate_policy: 'skip' });
  const sent = JSON.stringify(requests[0]);
  for (const forbidden of ['private@example.test', '0600', 'private.pdf', 'secret-hash', 'recruiterId']) assert.equal(sent.includes(forbidden), false);
  assert.deepEqual(requests[0].job.mandatory_requirements, [{
    code: 'canonical-mandatory-1', description: 'Free-text permit', satisfied: null,
  }]);
  assert.equal(result.body.topCandidates[0].cvId, 'cv-1');
  assert.equal(result.body.invalidCandidates, 0);
  const publicBody = JSON.stringify(result.body);
  for (const forbidden of ['email', 'phone', 'parsedData', 'sha256', 'technical_result', 'uid-1', 'candidateId']) assert.equal(publicBody.includes(forbidden), false);
});

test('matching logs exclude recruiter, Job, CV, and candidate identifiers', async () => {
  const logs: unknown[][] = [];
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = (...args: unknown[]) => logs.push(args);
  console.warn = (...args: unknown[]) => logs.push(args);
  try {
    await invoke({ cvs: [cv('private-cv-id', 'private-candidate-uid')], rank: async () => ranking('private-cv-id') });
    await invoke({ rank: async () => { throw new MatchingClientError('MATCHING_ENGINE_UNAVAILABLE', 'unavailable'); } });
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
  const output = JSON.stringify(logs);
  for (const forbidden of ['owner', 'job-1', 'private-cv-id', 'private-candidate-uid', 'recruiterId', 'jobId']) {
    assert.equal(output.includes(forbidden), false);
  }
  assert.equal(output.includes('MATCHING_ENGINE_UNAVAILABLE'), true);
});

test('other owner and missing job receive non-disclosing 404', async () => {
  assert.equal((await invoke({ uid: 'attacker' })).status, 404);
  assert.equal((await invoke({ currentJob: null })).status, 404);
});

test('CLOSED jobs are not matched', async () => {
  const result = await invoke({ currentJob: job({ status: 'CLOSED' }) });
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'JOB_NOT_OPEN');
});

test('empty CV database returns empty Top 3 without calling matcher', async () => {
  let called = false;
  const result = await invoke({ cvs: [], rank: async () => { called = true; return ranking(); } });
  assert.equal(called, false);
  assert.deepEqual(result.body.topCandidates, []);
  assert.equal(result.body.evaluatedCandidates, 0);
});

test('timeout, unavailable, and invalid matcher identifiers are controlled', async () => {
  for (const [failure, status] of [
    [new MatchingClientError('MATCHING_ENGINE_TIMEOUT', 'timeout'), 504],
    [new MatchingClientError('MATCHING_ENGINE_UNAVAILABLE', 'unavailable'), 503],
  ] as const) {
    const result = await invoke({ rank: async () => { throw failure; } });
    assert.equal(result.status, status);
  }
  const unknown = await invoke({ rank: async () => ranking('unknown-cv') });
  assert.equal(unknown.status, 502);
  assert.equal(unknown.body.error.code, 'MATCHING_ENGINE_INVALID_RESPONSE');
});

test('matching client validates HTTP, JSON, and response contracts', async () => {
  const request: MatchingRankingRequest = { job: {} as any, candidates: [{} as any], options: { top_k: 3, include_technical_details: false, invalid_candidate_policy: 'skip' } };
  await assert.rejects(rankCandidates(request, { baseUrl: 'http://matcher', timeoutMs: 100 }, async () => new Response('{}', { status: 500 })), (error: any) => error.code === 'MATCHING_ENGINE_REJECTED');
  await assert.rejects(rankCandidates(request, { baseUrl: 'http://matcher', timeoutMs: 100 }, async () => new Response('not-json')), (error: any) => error.code === 'MATCHING_ENGINE_INVALID_RESPONSE');
  await assert.rejects(rankCandidates(request, { baseUrl: 'http://matcher', timeoutMs: 100 }, async () => new Response('{}', { headers: { 'content-type': 'application/json' } })), (error: any) => error.code === 'MATCHING_ENGINE_INVALID_RESPONSE');
  await assert.rejects(rankCandidates(request, { baseUrl: 'http://matcher', timeoutMs: 100 }, async () => { throw new TypeError('offline'); }), (error: any) => error.code === 'MATCHING_ENGINE_UNAVAILABLE');
});

test('matching client normalizes FastAPI omitted nullable candidate fields', async () => {
  const response = ranking();
  const candidate: any = response.top_candidates[0];
  delete candidate.candidate_name;
  delete candidate.experience.candidate_years;
  const parsed = await rankCandidates(
    { job: {} as any, candidates: [{} as any], options: { top_k: 3, include_technical_details: false, invalid_candidate_policy: 'skip' } },
    { baseUrl: 'http://matcher', timeoutMs: 100 },
    async () => Response.json(response),
  );
  assert.equal(parsed.top_candidates[0].candidate_name, null);
  assert.equal(parsed.top_candidates[0].experience.candidate_years, null);
});

test('matching client timeout is bounded', async () => {
  const request: MatchingRankingRequest = { job: {} as any, candidates: [{} as any], options: { top_k: 3, include_technical_details: false, invalid_candidate_policy: 'skip' } };
  await assert.rejects(rankCandidates(request, { baseUrl: 'http://matcher', timeoutMs: 5 }, (_url, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))), (error: any) => error.code === 'MATCHING_ENGINE_TIMEOUT');
});
