import { z } from 'zod';
import type { InterviewCVInput, InterviewJobContextInput } from './interview-contract';

const interviewTypeSchema = z.enum(['general', 'behavioral', 'technical', 'mixed']);
const sessionStatusSchema = z.enum(['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const questionCategorySchema = z.enum([
  'introduction', 'experience', 'skills', 'technical', 'behavioral', 'motivation',
  'problem_solving', 'education', 'job_fit',
]);
const difficultySchema = z.enum(['easy', 'medium', 'hard']);

export const interviewQuestionSchema = z.object({
  question_id: z.string().min(1).max(128),
  category: questionCategorySchema,
  question: z.string().min(1).max(500),
  based_on: z.array(z.string()),
  difficulty: difficultySchema,
}).strict();

export const answerEvaluationSchema = z.object({
  score: z.number().int().min(0).max(100),
  classification: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  feedback: z.string(),
}).strict();

const candidateAnswerSchema = z.object({
  question_id: z.string(),
  answer: z.string(),
  submitted_at: z.string(),
}).strict();

const interviewTurnSchema = z.object({
  question: interviewQuestionSchema,
  answer: candidateAnswerSchema.nullable(),
  evaluation: answerEvaluationSchema.nullable(),
}).strict();

export const finalInterviewReportSchema = z.object({
  session_id: z.string(),
  overall_score: z.number().int().min(0).max(100),
  classification: z.string(),
  questions_answered: z.number().int().nonnegative(),
  category_scores: z.record(z.string(), z.number().int().min(0).max(100)),
  strengths: z.array(z.string()),
  areas_for_improvement: z.array(z.string()),
  summary: z.string(),
}).strict();

export const interviewSessionSchema = z.object({
  session_id: z.string().min(1).max(128),
  interview_type: interviewTypeSchema,
  status: sessionStatusSchema,
  current_question_index: z.number().int().nonnegative(),
  max_questions: z.number().int().min(1).max(20),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  turns: z.array(interviewTurnSchema),
  final_report: finalInterviewReportSchema.nullable(),
}).strict();

export const createInterviewResponseSchema = z.object({
  session: interviewSessionSchema,
  first_question: interviewQuestionSchema,
}).strict();

export const submitAnswerResponseSchema = z.object({
  session_id: z.string(),
  status: sessionStatusSchema,
  evaluation: answerEvaluationSchema,
  next_question: interviewQuestionSchema.nullable().optional().transform(value => value ?? null),
  final_report: finalInterviewReportSchema.nullable().optional().transform(value => value ?? null),
}).strict();

export const interviewHistoryItemSchema = z.object({
  session_id: z.string().min(1).max(128),
  interview_type: interviewTypeSchema,
  status: sessionStatusSchema,
  created_at: z.string(),
  completed_at: z.string().nullable(),
  questions_answered: z.number().int().nonnegative(),
  max_questions: z.number().int().min(1).max(20),
  overall_score: z.number().int().min(0).max(100).nullable(),
  classification: z.string().nullable(),
}).strict();

export const interviewHistoryResponseSchema = z.object({
  items: z.array(interviewHistoryItemSchema),
  next_cursor: z.string().nullable(),
}).strict();

export interface InterviewCreateEngineRequest {
  cv: InterviewCVInput;
  job?: InterviewJobContextInput;
}

export interface InterviewSubmitAnswerEngineRequest {
  question_id: string;
  answer: string;
}

export type InterviewSession = z.infer<typeof interviewSessionSchema>;
export type CreateInterviewResponse = z.infer<typeof createInterviewResponseSchema>;
export type SubmitAnswerResponse = z.infer<typeof submitAnswerResponseSchema>;
export type FinalInterviewReport = z.infer<typeof finalInterviewReportSchema>;
export type InterviewHistoryResponse = z.infer<typeof interviewHistoryResponseSchema>;
