import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { listInterviews } from '../src/lib/api/interview-client';
import { appendInterviewHistory, InterviewHistoryContent, InterviewHistoryList, openInterviewFromHistory } from '../src/components/candidate/interview-history-view';
import { INTERVIEW_SESSION_STORAGE_KEY, recoverInterviewState } from '../src/components/candidate/interview-view';
import type { CandidateInterviewHistoryItem, InterviewSession } from '../src/types/interview-frontend';

const historyItem = (status: CandidateInterviewHistoryItem['status'], id: string = status): CandidateInterviewHistoryItem => ({ sessionId: id, interviewType: 'mixed', status, createdAt: '2026-01-01T00:00:00Z', completedAt: status === 'COMPLETED' || status === 'CANCELLED' ? '2026-01-01T00:05:00Z' : null, questionsAnswered: status === 'CREATED' ? 0 : 2, maxQuestions: 5, overallScore: status === 'COMPLETED' ? 80 : null, classification: status === 'COMPLETED' ? 'Solide' : null });

test('browser history client uses Firebase bearer and relative encoded Express URL', async () => {
  let captured: { url: string; headers: Headers } | undefined; let tokenCalls = 0;
  const result = await listInterviews(20, 'opaque+/=', { getCurrentUser: () => ({ getIdToken: async () => { tokenCalls += 1; return 'firebase-token'; } }), fetch: async (url, init) => { captured = { url: String(url), headers: new Headers(init?.headers) }; return Response.json({ interviews: [historyItem('IN_PROGRESS')], nextCursor: 'next' }); } });
  assert.equal(tokenCalls, 1);
  assert.match(captured?.url ?? '', /^\/api\/interviews\?/);
  assert.match(captured?.url ?? '', /pageSize=20/);
  assert.match(captured?.url ?? '', /cursor=opaque%2B%2F%3D/);
  assert.equal(captured?.headers.get('authorization'), 'Bearer firebase-token');
  assert.doesNotMatch(captured?.url ?? '', /8003|api\/v1|firestore|https?:\/\//i);
  assert.equal(result.nextCursor, 'next');
});

test('history loading and empty states render safely', () => {
  const loading = renderToStaticMarkup(React.createElement(InterviewHistoryContent, { loading: true, items: [], onOpen: () => undefined, onStart: () => undefined }));
  const empty = renderToStaticMarkup(React.createElement(InterviewHistoryContent, { loading: false, items: [], onOpen: () => undefined, onStart: () => undefined }));
  assert.match(loading, /aria-busy/);
  assert.match(empty, /Aucun entretien/);
});

test('history cards expose actions only for resumable/completed statuses', () => {
  const markup = renderToStaticMarkup(React.createElement(InterviewHistoryList, { items: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CREATED'].map(status => historyItem(status as any)), onOpen: () => undefined }));
  assert.equal((markup.match(/Reprendre/g) ?? []).length, 1);
  assert.equal((markup.match(/Voir le rapport/g) ?? []).length, 1);
  assert.match(markup, /Score : 80\/100/);
});

test('resume/report action stores only session ID and navigates to existing Interview page', () => {
  const writes: Array<[string, string]> = []; let path = '';
  openInterviewFromHistory('session-1', value => { path = value; }, { setItem: (key, value) => { writes.push([key, value]); } });
  assert.deepEqual(writes, [[INTERVIEW_SESSION_STORAGE_KEY, 'session-1']]);
  assert.equal(path, '/dashboard/candidate/interview');
});

test('pagination append preserves current items and removes cursor-boundary duplicates', () => {
  const current = [historyItem('IN_PROGRESS', 'one'), historyItem('COMPLETED', 'two')];
  const appended = appendInterviewHistory(current, [historyItem('COMPLETED', 'two'), historyItem('CANCELLED', 'three')]);
  assert.deepEqual(appended.map(item => item.sessionId), ['one', 'two', 'three']);
});

test('CREATED recovery is not resumable while IN_PROGRESS still recovers', () => {
  const session = (status: InterviewSession['status']): InterviewSession => ({ sessionId: 'session', status, currentQuestionIndex: status === 'CREATED' ? 0 : 1, maxQuestions: 5, turns: status === 'CREATED' ? [] : [{ question: { questionId: 'q', text: 'Question', category: 'skills', difficulty: 'medium' }, answered: false, evaluation: null }], finalReport: null });
  assert.equal(recoverInterviewState(session('CREATED')).phase, 'ERROR');
  assert.equal(recoverInterviewState(session('IN_PROGRESS')).phase, 'IN_PROGRESS');
});
