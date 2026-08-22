import assert from 'node:assert/strict';
import test from 'node:test';
import type { InterviewEngineServerConfig } from '../src/server/config';
import { InterviewClientError, listInterviews } from '../src/server/interview-client';
import { createInterviewHistoryHandler } from '../src/server/interview-route';

const config: InterviewEngineServerConfig = { baseUrl: 'http://interview.test', apiToken: 'internal-test-token', timeoutMs: 100 };
const item = { session_id: 'session-1', interview_type: 'mixed' as const, status: 'IN_PROGRESS' as const, created_at: '2026-01-01T00:00:00Z', completed_at: null, questions_answered: 2, max_questions: 5, overall_score: null, classification: null };

function recorder() {
  const record: { status?: number; body?: any } = {};
  const response = { status(value: number) { record.status = value; return this; }, json(value: unknown) { record.body = value; return this; } };
  return { record, response: response as never };
}

async function invoke(options: { candidate?: string; query?: unknown; list?: any } = {}) {
  const request: any = { query: options.query ?? {}, ...(options.candidate ? { candidate: { uid: options.candidate, role: 'CANDIDATE' } } : {}) };
  const { record, response } = recorder();
  await createInterviewHistoryHandler(options.list ? { list: options.list } : {})(request, response, () => undefined);
  return record;
}

test('server history client propagates internal auth, owner, page size, and opaque cursor', async () => {
  let captured: { url: string; headers: Headers } | undefined;
  const result = await listInterviews('owner-a', 20, 'opaque+/=', config, async (url, init) => {
    captured = { url: String(url), headers: new Headers(init?.headers) };
    return Response.json({ items: [item], next_cursor: 'next-cursor' });
  });
  assert.match(captured?.url ?? '', /^http:\/\/interview\.test\/api\/v1\/interviews\?/);
  assert.match(captured?.url ?? '', /page_size=20/);
  assert.match(captured?.url ?? '', /cursor=opaque%2B%2F%3D/);
  assert.equal(captured?.headers.get('authorization'), 'Bearer internal-test-token');
  assert.equal(captured?.headers.get('X-Interview-Owner-Id'), 'owner-a');
  assert.equal(result.next_cursor, 'next-cursor');
});

test('candidate authentication is required and browser owner selection is rejected', async () => {
  assert.equal((await invoke()).status, 401);
  let called = false;
  const result = await invoke({ candidate: 'owner-a', query: { ownerId: 'owner-b' }, list: async () => { called = true; return { items: [], next_cursor: null }; } });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INTERVIEW_HISTORY_QUERY_INVALID');
  assert.equal(called, false);
});

test('Express history uses authenticated owner and maps only candidate-safe fields', async () => {
  let owner = '';
  const privateItem = { ...item, owner_id: 'private-owner', candidate_id: 'private-candidate', cv: { email: 'private@test' }, job: { recruiterId: 'private' }, turns: [{ answer: 'secret' }], final_report: { strengths: ['secret'] }, provider: 'gemini' };
  const result = await invoke({ candidate: 'verified-owner', query: { pageSize: '10' }, list: async (value: string, size: number) => { owner = value; assert.equal(size, 10); return { items: [privateItem], next_cursor: 'opaque-next' }; } });
  assert.equal(owner, 'verified-owner');
  assert.deepEqual(Object.keys(result.body.interviews[0]).sort(), ['classification', 'completedAt', 'createdAt', 'interviewType', 'maxQuestions', 'overallScore', 'questionsAnswered', 'sessionId', 'status'].sort());
  assert.equal(result.body.nextCursor, 'opaque-next');
  const serialized = JSON.stringify(result.body);
  for (const forbidden of ['private-owner', 'private-candidate', 'private@test', 'recruiterId', 'secret', 'gemini', 'owner_id', 'candidate_id', 'turns', 'final_report']) assert.equal(serialized.includes(forbidden), false);
});

test('empty history and pagination cursor are preserved', async () => {
  let cursor: string | undefined;
  const result = await invoke({ candidate: 'owner-a', query: { pageSize: '20', cursor: 'opaque-cursor' }, list: async (_owner: string, _size: number, value?: string) => { cursor = value; return { items: [], next_cursor: null }; } });
  assert.equal(cursor, 'opaque-cursor');
  assert.deepEqual(result.body, { interviews: [], nextCursor: null });
});

test('invalid page sizes and cursors are safely rejected', async () => {
  for (const query of [{ pageSize: '0' }, { pageSize: '51' }, { pageSize: 'abc' }, { cursor: '' }, { cursor: 'x'.repeat(1025) }]) {
    const result = await invoke({ candidate: 'owner-a', query, list: async () => ({ items: [], next_cursor: null }) });
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'INTERVIEW_HISTORY_QUERY_INVALID');
  }
});

test('Engine timeout and unavailable history responses map safely', async () => {
  for (const [code, expected] of [['INTERVIEW_ENGINE_TIMEOUT', 504], ['INTERVIEW_ENGINE_UNAVAILABLE', 503]] as const) {
    const result = await invoke({ candidate: 'owner-a', list: async () => { throw new InterviewClientError(code, 'sanitized'); } });
    assert.equal(result.status, expected);
    assert.doesNotMatch(JSON.stringify(result.body), /token|traceback|owner-a/i);
  }
});
