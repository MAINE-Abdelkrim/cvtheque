import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { CandidateRequest } from './cv-auth';
import {
  cancelInterview,
  getInterview,
  InterviewClientError,
  listInterviews,
  submitInterviewAnswer,
} from './interview-client';
import {
  InterviewIntegrationError,
  startInterviewForCandidate,
  type StartInterviewDependencies,
} from './interview-service';

const startRequestSchema = z.object({
  cvId: z.string().trim().min(1).max(128),
  jobId: z.string().trim().min(1).max(128).optional(),
}).strict();

const answerRequestSchema = z.object({
  questionId: z.string().trim().min(1).max(128),
  answer: z.string().trim().min(1).max(20_000),
}).strict();

const sessionIdSchema = z.string().trim().min(1).max(128);
const historyQuerySchema = z.object({
  pageSize: z.string().regex(/^\d+$/).default('20').transform(Number).pipe(z.number().int().min(1).max(50)),
  cursor: z.string().trim().min(1).max(1_024).optional(),
}).strict();

export interface InterviewRouteDependencies extends StartInterviewDependencies {
  get?: typeof getInterview;
  submit?: typeof submitInterviewAnswer;
  cancel?: typeof cancelInterview;
  list?: typeof listInterviews;
}

function sendError(response: Response, status: number, code: string, message: string) {
  return response.status(status).json({ error: { code, message, details: [] } });
}

function sendClientError(response: Response, error: InterviewClientError) {
  if (error.code === 'INTERVIEW_ENGINE_TIMEOUT') {
    return sendError(response, 504, error.code, 'The Interview service took too long to respond.');
  }
  if (error.code === 'INTERVIEW_ENGINE_UNAVAILABLE') {
    return sendError(response, 503, error.code, 'The Interview service is temporarily unavailable.');
  }
  if (error.code === 'INTERVIEW_ENGINE_INVALID_RESPONSE') {
    return sendError(response, 502, error.code, 'The Interview service returned an invalid response.');
  }
  const upstream = error.upstreamStatus;
  if (upstream === 400 || upstream === 422) {
    return sendError(response, upstream, 'INTERVIEW_REQUEST_REJECTED', 'The Interview request was rejected.');
  }
  if (upstream === 403 || upstream === 404) {
    return sendError(response, 404, 'INTERVIEW_NOT_FOUND', 'The Interview session was not found.');
  }
  if (upstream === 409) {
    return sendError(response, 409, 'INTERVIEW_STATE_CONFLICT', 'The Interview session is not in the required state.');
  }
  if (upstream === 401) {
    return sendError(response, 502, 'INTERVIEW_ENGINE_AUTH_FAILED', 'The Interview service authentication failed.');
  }
  return sendError(response, 502, 'INTERVIEW_ENGINE_FAILURE', 'The Interview service could not process the request.');
}

function handleFailure(response: Response, error: unknown) {
  if (error instanceof InterviewIntegrationError) {
    return sendError(response, error.status, error.code, error.message);
  }
  if (error instanceof InterviewClientError) return sendClientError(response, error);
  return sendError(response, 503, 'INTERVIEW_INTEGRATION_UNAVAILABLE', 'The Interview integration is temporarily unavailable.');
}

function candidateId(request: CandidateRequest, response: Response): string | null {
  if (!request.candidate) {
    sendError(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    return null;
  }
  return request.candidate.uid;
}

function sessionId(request: CandidateRequest, response: Response): string | null {
  const parsed = sessionIdSchema.safeParse(request.params.sessionId);
  if (!parsed.success) {
    sendError(response, 400, 'INTERVIEW_SESSION_ID_INVALID', 'A valid Interview session ID is required.');
    return null;
  }
  return parsed.data;
}

export function createInterviewStartHandler(
  dependencies: InterviewRouteDependencies = {},
): RequestHandler {
  return async (request: CandidateRequest, response) => {
    const ownerId = candidateId(request, response);
    if (!ownerId) return;
    const input = startRequestSchema.safeParse(request.body);
    if (!input.success) {
      sendError(response, 400, 'INTERVIEW_START_INVALID', 'The Interview start request is invalid.');
      return;
    }
    try {
      const result = await startInterviewForCandidate(
        ownerId, input.data.cvId, input.data.jobId, dependencies,
      );
      response.status(201).json(result);
    } catch (error) {
      handleFailure(response, error);
    }
  };
}

export function createInterviewHistoryHandler(
  dependencies: InterviewRouteDependencies = {},
): RequestHandler {
  return async (request: CandidateRequest, response) => {
    const ownerId = candidateId(request, response);
    if (!ownerId) return;
    const query = historyQuerySchema.safeParse(request.query);
    if (!query.success) {
      sendError(response, 400, 'INTERVIEW_HISTORY_QUERY_INVALID', 'The Interview history query is invalid.');
      return;
    }
    try {
      const result = await (dependencies.list ?? listInterviews)(ownerId, query.data.pageSize, query.data.cursor);
      response.json({
        interviews: result.items.map(item => ({
          sessionId: item.session_id,
          interviewType: item.interview_type,
          status: item.status,
          createdAt: item.created_at,
          completedAt: item.completed_at,
          questionsAnswered: item.questions_answered,
          maxQuestions: item.max_questions,
          overallScore: item.overall_score,
          classification: item.classification,
        })),
        nextCursor: result.next_cursor,
      });
    } catch (error) { handleFailure(response, error); }
  };
}

export function createInterviewGetHandler(
  dependencies: InterviewRouteDependencies = {},
): RequestHandler {
  return async (request: CandidateRequest, response) => {
    const ownerId = candidateId(request, response);
    if (!ownerId) return;
    const id = sessionId(request, response);
    if (!id) return;
    try {
      response.json(await (dependencies.get ?? getInterview)(ownerId, id));
    } catch (error) {
      handleFailure(response, error);
    }
  };
}

export function createInterviewAnswerHandler(
  dependencies: InterviewRouteDependencies = {},
): RequestHandler {
  return async (request: CandidateRequest, response) => {
    const ownerId = candidateId(request, response);
    if (!ownerId) return;
    const id = sessionId(request, response);
    if (!id) return;
    const input = answerRequestSchema.safeParse(request.body);
    if (!input.success) {
      sendError(response, 400, 'INTERVIEW_ANSWER_INVALID', 'The Interview answer request is invalid.');
      return;
    }
    try {
      response.json(await (dependencies.submit ?? submitInterviewAnswer)(ownerId, id, {
        question_id: input.data.questionId,
        answer: input.data.answer,
      }));
    } catch (error) {
      handleFailure(response, error);
    }
  };
}

export function createInterviewCancelHandler(
  dependencies: InterviewRouteDependencies = {},
): RequestHandler {
  return async (request: CandidateRequest, response) => {
    const ownerId = candidateId(request, response);
    if (!ownerId) return;
    const id = sessionId(request, response);
    if (!id) return;
    try {
      response.json(await (dependencies.cancel ?? cancelInterview)(ownerId, id));
    } catch (error) {
      handleFailure(response, error);
    }
  };
}

export function createInterviewReportHandler(
  dependencies: InterviewRouteDependencies = {},
): RequestHandler {
  return async (request: CandidateRequest, response) => {
    const ownerId = candidateId(request, response);
    if (!ownerId) return;
    const id = sessionId(request, response);
    if (!id) return;
    try {
      const session = await (dependencies.get ?? getInterview)(ownerId, id);
      if (session.status !== 'COMPLETED' || !session.final_report) {
        sendError(response, 409, 'INTERVIEW_REPORT_NOT_READY', 'The Interview report is not available yet.');
        return;
      }
      response.json({ report: session.final_report });
    } catch (error) {
      handleFailure(response, error);
    }
  };
}
