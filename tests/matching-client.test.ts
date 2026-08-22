import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJobCandidates, MatchingApiError } from '../src/lib/api/matching';
import type { RecruiterMatchingResponse } from '../src/types/matching';

const valid: RecruiterMatchingResponse = {
  jobId: 'job/one', jobTitle: 'Backend', evaluatedCandidates: 1, eligibleCandidates: 1, invalidCandidates: 0, summary: 'Done',
  topCandidates: [{ rank: 1, candidateId: 'uid-1', cvId: 'cv-1', candidateName: 'Candidate', score: 87, matchLevel: 'Strong match', eligible: true,
    eligibilityMessage: 'Eligible', summary: 'Good fit', requiredSkills: { matched: ['Python'], missing: ['Docker'], display: '1 of 2' },
    experience: { candidateYears: 3, requiredYears: 2, status: 'Meets requirement', display: '3 years found' },
    education: { status: 'Compatible', display: 'Compatible' }, languages: { status: 'Compatible', display: 'Compatible' },
    locationAndWorkMode: { status: 'Compatible', display: 'Compatible' }, contract: { status: 'Compatible', display: 'Compatible' },
    strengths: ['Python'], gaps: ['Docker'], mandatoryFailures: [] }],
};

test('matching client sends authenticated POST to encoded canonical Job URL', async () => {
  let captured: { url?: string; init?: RequestInit } = {};
  const result = await matchJobCandidates('job/one', {
    getCurrentUser: () => ({ async getIdToken() { return 'verified-token'; } }),
    fetch: async (url, init) => { captured = { url: String(url), init }; return Response.json(valid); },
  });
  assert.equal(captured.url, '/api/jobs/job%2Fone/match');
  assert.equal(captured.init?.method, 'POST');
  assert.equal((captured.init?.headers as Record<string, string>).Authorization, 'Bearer verified-token');
  assert.deepEqual(result, valid);
  assert.equal(result.topCandidates[0].score, 87);
  assert.deepEqual(result.topCandidates[0].requiredSkills.missing, ['Docker']);
});

test('matching client rejects missing authentication without a request', async () => {
  let called = false;
  await assert.rejects(matchJobCandidates('job-1', { getCurrentUser: () => null, fetch: async () => { called = true; return Response.json({}); } }), (error: any) => error.code === 'AUTH_REQUIRED');
  assert.equal(called, false);
});

test('matching client maps structured backend failures and never fabricates results', async () => {
  await assert.rejects(matchJobCandidates('job-1', {
    getCurrentUser: () => ({ async getIdToken() { return 'token'; } }),
    fetch: async () => Response.json({ error: { code: 'JOB_NOT_OPEN', message: 'Closed.' } }, { status: 409 }),
  }), (error: any) => error instanceof MatchingApiError && error.code === 'JOB_NOT_OPEN' && error.status === 409);
});

test('matching client rejects malformed successful responses', async () => {
  await assert.rejects(matchJobCandidates('job-1', {
    getCurrentUser: () => ({ async getIdToken() { return 'token'; } }),
    fetch: async () => Response.json({ topCandidates: [{ score: 99 }] }),
  }), (error: any) => error.code === 'MATCHING_RESPONSE_INVALID');
});

test('matching client accepts an empty result and preserves backend Top 3 order', async () => {
  const empty = { ...valid, evaluatedCandidates: 0, eligibleCandidates: 0, topCandidates: [], summary: 'No CVs.' };
  const emptyResult = await matchJobCandidates('job-1', {
    getCurrentUser: () => ({ async getIdToken() { return 'token'; } }),
    fetch: async () => Response.json(empty),
  });
  assert.deepEqual(emptyResult.topCandidates, []);

  const second = { ...valid.topCandidates[0], rank: 2, candidateId: 'uid-2', cvId: 'cv-2', candidateName: 'Second', score: 99 };
  const ordered = { ...valid, evaluatedCandidates: 2, topCandidates: [valid.topCandidates[0], second] };
  const orderedResult = await matchJobCandidates('job-1', {
    getCurrentUser: () => ({ async getIdToken() { return 'token'; } }),
    fetch: async () => Response.json(ordered),
  });
  assert.deepEqual(orderedResult.topCandidates.map(candidate => candidate.cvId), ['cv-1', 'cv-2']);
  assert.deepEqual(orderedResult.topCandidates.map(candidate => candidate.score), [87, 99]);
});
