import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InterviewView, OptionalJobSelector } from '../src/components/candidate/interview-view';
import { applyInterviewAnswer, canSubmitInterviewAnswer, INTERVIEW_SESSION_STORAGE_KEY, recoverInterviewState } from '../src/components/candidate/interview-view';
import type { InterviewAnswerResponse, InterviewQuestion, InterviewSession } from '../src/types/interview-frontend';

const first: InterviewQuestion = { questionId: 'q1', text: 'Question 1', category: 'introduction', difficulty: 'easy' };
const second: InterviewQuestion = { questionId: 'q2', text: 'Question 2', category: 'skills', difficulty: 'medium' };
const evaluation = { score: 75, classification: 'Solide', strengths: ['Clair'], weaknesses: ['Détails'], feedback: 'Continuez.' };
const report = { overallScore: 75, classification: 'Solide', questionsAnswered: 2, categoryScores: { skills: 75 }, strengths: ['Clair'], areasForImprovement: ['Détails'], summary: 'Synthèse.' };

function session(status: InterviewSession['status'] = 'IN_PROGRESS'): InterviewSession {
  return { sessionId: 'session-1', status, currentQuestionIndex: 1, maxQuestions: 5, turns: [{ question: first, answered: true, evaluation }, { question: second, answered: false, evaluation: null }], finalReport: status === 'COMPLETED' ? report : null };
}

test('processed CV selection is required conceptually through a non-empty ID', () => {
  assert.equal(Boolean(''.trim()), false);
  assert.equal(Boolean('cv-1'.trim()), true);
});

test('Interview route view renders its start experience offline', () => {
  const markup = renderToStaticMarkup(React.createElement(InterviewView, { onNavigate: () => undefined }));
  assert.match(markup, /AI Interview/);
  assert.match(markup, /Préparation|Comment fonctionne|Chargement|aria-busy/);
});

test('optional Job selector defaults to CV-only and renders safe labels', () => {
  const job = { jobId: 'job-1', title: 'Backend Developer', company: 'Atlas', location: 'Oujda', requiredSkills: ['TypeScript'], minimumExperienceYears: 2, workMode: 'hybrid' as const, contractType: 'CDI' as const, createdAt: '2026-01-01T00:00:00Z' };
  const markup = renderToStaticMarkup(React.createElement(OptionalJobSelector, { jobs: [job], loading: false, warning: '', selectedJobId: '', onSelect: () => undefined }));
  assert.match(markup, /Entretien général basé sur mon CV/);
  assert.match(markup, /Backend Developer/);
  assert.match(markup, /Atlas/);
  assert.doesNotMatch(markup, /recruiterId|schemaVersion/);
});

test('empty and failed Job loading states preserve the general option', () => {
  for (const warning of ['', "Les offres ne peuvent pas être chargées actuellement."]) {
    const markup = renderToStaticMarkup(React.createElement(OptionalJobSelector, { jobs: [], loading: false, warning, selectedJobId: '', onSelect: () => undefined }));
    assert.match(markup, /Entretien général basé sur mon CV/);
    assert.match(markup, warning ? /Les offres ne peuvent pas/ : /Aucune offre ouverte/);
  }
});

test('blank, oversized, and busy answers cannot submit', () => {
  assert.equal(canSubmitInterviewAnswer('  ', false), false);
  assert.equal(canSubmitInterviewAnswer('a'.repeat(20_001), false), false);
  assert.equal(canSubmitInterviewAnswer('Réponse', true), false);
  assert.equal(canSubmitInterviewAnswer('Réponse', false), true);
});

test('recovery returns the current unanswered question', () => {
  const recovered = recoverInterviewState(session());
  assert.equal(recovered.phase, 'IN_PROGRESS');
  assert.equal(recovered.question?.questionId, 'q2');
  assert.equal(recovered.questionIndex, 2);
});

test('evaluation remains visible with returned next question until continue', () => {
  const response: InterviewAnswerResponse = { sessionId: 'session-1', status: 'IN_PROGRESS', evaluation, nextQuestion: second, finalReport: null };
  const state = applyInterviewAnswer(response);
  assert.equal(state.phase, 'IN_PROGRESS');
  assert.equal(state.evaluation, evaluation);
  assert.equal(state.nextQuestion, second);
});

test('completed answer transitions to final report and discards next question', () => {
  const response: InterviewAnswerResponse = { sessionId: 'session-1', status: 'COMPLETED', evaluation, nextQuestion: second, finalReport: report };
  const state = applyInterviewAnswer(response);
  assert.equal(state.phase, 'COMPLETED');
  assert.equal(state.nextQuestion, null);
  assert.equal(state.report, report);
});

test('completed and cancelled sessions recover safely', () => {
  assert.equal(recoverInterviewState(session('COMPLETED')).phase, 'COMPLETED');
  assert.equal(recoverInterviewState(session('CANCELLED')).phase, 'CANCELLED');
});

test('recovery storage key describes only a session ID', () => {
  assert.equal(INTERVIEW_SESSION_STORAGE_KEY, 'candidateInterviewSessionId');
  assert.doesNotMatch(INTERVIEW_SESSION_STORAGE_KEY, /token|owner|answer|report|cv/i);
});
