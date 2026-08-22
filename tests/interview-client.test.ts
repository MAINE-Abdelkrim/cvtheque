import assert from 'node:assert/strict';
import test from 'node:test';
import type { InterviewEngineServerConfig } from '../src/server/config';
import { getInterviewEngineServerConfig } from '../src/server/config';
import {
  getInterview,
  InterviewClientError,
  startInterview,
  submitInterviewAnswer,
} from '../src/server/interview-client';

const config: InterviewEngineServerConfig = {
  baseUrl: 'http://interview.test', apiToken: 'server-secret-token', timeoutMs: 100,
};

const question = {
  question_id: 'question-1', category: 'introduction', question: 'Tell me about your background?',
  based_on: [], difficulty: 'easy',
};

const session = {
  session_id: 'session-1', interview_type: 'mixed', status: 'IN_PROGRESS',
  current_question_index: 0, max_questions: 5, created_at: '2026-01-01T00:00:00Z',
  completed_at: null, turns: [{ question, answer: null, evaluation: null }], final_report: null,
};

test('Interview config validates URL, token, and timeout without exposing defaults', () => {
  assert.deepEqual(getInterviewEngineServerConfig({
    INTERVIEW_ENGINE_BASE_URL: 'http://127.0.0.1:8003/',
    INTERVIEW_ENGINE_API_TOKEN: 'token',
    INTERVIEW_ENGINE_TIMEOUT_MS: '1234',
  }), { baseUrl: 'http://127.0.0.1:8003', apiToken: 'token', timeoutMs: 1234 });
  assert.throws(() => getInterviewEngineServerConfig({}), /incomplete/);
  assert.throws(() => getInterviewEngineServerConfig({
    INTERVIEW_ENGINE_BASE_URL: 'file:///private', INTERVIEW_ENGINE_API_TOKEN: 'token',
  }), /HTTP/);
});

test('client sends correct create URL, internal Bearer token, and candidate owner header', async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const response = await startInterview('candidate-uid', { cv: { identity: { full_name: null, location: null, job_title: null }, summary: null, skills: [], experiences: [], education: [], languages: [], certifications: [] } }, config,
    async (url, init) => {
      captured = { url: String(url), init };
      return Response.json({ session, first_question: question }, { status: 201 });
    });
  assert.equal(captured?.url, 'http://interview.test/api/v1/interviews');
  assert.equal(new Headers(captured?.init?.headers).get('authorization'), 'Bearer server-secret-token');
  assert.equal(new Headers(captured?.init?.headers).get('X-Interview-Owner-Id'), 'candidate-uid');
  assert.equal(response.session.session_id, 'session-1');
  const body = JSON.parse(String(captured?.init?.body));
  assert.equal('candidate_id' in body, false);
});

test('client encodes session IDs and propagates owner on GET', async () => {
  let url = '';
  let owner = '';
  await getInterview('candidate-uid', 'session/unsafe', config, async (input, init) => {
    url = String(input);
    owner = new Headers(init?.headers).get('X-Interview-Owner-Id') ?? '';
    return Response.json(session);
  });
  assert.equal(url, 'http://interview.test/api/v1/interviews/session%2Funsafe');
  assert.equal(owner, 'candidate-uid');
});

test('client maps timeout and network failure without leaking causes', async () => {
  await assert.rejects(
    getInterview('owner', 'session', { ...config, timeoutMs: 5 }, (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('secret cause'), { name: 'AbortError' })));
    })),
    (error: any) => error instanceof InterviewClientError && error.code === 'INTERVIEW_ENGINE_TIMEOUT' && !error.message.includes('secret cause'),
  );
  await assert.rejects(
    getInterview('owner', 'session', config, async () => { throw new Error('private network detail'); }),
    (error: any) => error.code === 'INTERVIEW_ENGINE_UNAVAILABLE' && !error.message.includes('private network detail'),
  );
});

test('client preserves only upstream status for 4xx and 5xx errors', async () => {
  for (const status of [401, 404, 409, 422, 500]) {
    await assert.rejects(
      getInterview('owner', 'session', config, async () => Response.json({
        error: { code: 'PRIVATE', message: 'traceback and token server-secret-token' },
      }, { status })),
      (error: any) => error.code === 'INTERVIEW_ENGINE_REJECTED'
        && error.upstreamStatus === status
        && !error.message.includes('traceback')
        && !error.message.includes(config.apiToken),
    );
  }
});

test('client rejects malformed JSON and malformed successful responses', async () => {
  await assert.rejects(getInterview('owner', 'session', config, async () => new Response('not-json')),
    (error: any) => error.code === 'INTERVIEW_ENGINE_INVALID_RESPONSE');
  await assert.rejects(getInterview('owner', 'session', config, async () => Response.json({ session_id: 'only' })),
    (error: any) => error.code === 'INTERVIEW_ENGINE_INVALID_RESPONSE');
});

test('answer body follows Engine contract and answer/token are never logged', async () => {
  const logged: unknown[][] = [];
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = (...args) => { logged.push(args); };
  console.info = (...args) => { logged.push(args); };
  console.warn = (...args) => { logged.push(args); };
  console.error = (...args) => { logged.push(args); };
  let body = '';
  try {
    await submitInterviewAnswer('owner', 'session-1', { question_id: 'question-1', answer: 'private answer text' }, config,
      async (_input, init) => {
        body = String(init?.body);
        return Response.json({
          session_id: 'session-1', status: 'IN_PROGRESS',
          evaluation: { score: 70, classification: 'good', strengths: [], weaknesses: [], feedback: 'Safe feedback' },
          next_question: question, final_report: null,
        });
      });
  } finally {
    Object.assign(console, original);
  }
  assert.deepEqual(JSON.parse(body), { question_id: 'question-1', answer: 'private answer text' });
  const output = JSON.stringify(logged);
  assert.equal(output.includes('private answer text'), false);
  assert.equal(output.includes(config.apiToken), false);
});
