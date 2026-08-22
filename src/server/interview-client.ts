import type { z } from 'zod';
import type { InterviewEngineServerConfig } from './config';
import { getInterviewEngineServerConfig } from './config';
import {
  createInterviewResponseSchema,
  interviewSessionSchema,
  interviewHistoryResponseSchema,
  submitAnswerResponseSchema,
  type CreateInterviewResponse,
  type InterviewCreateEngineRequest,
  type InterviewSession,
  type InterviewHistoryResponse,
  type InterviewSubmitAnswerEngineRequest,
  type SubmitAnswerResponse,
} from '../types/interview';

const OWNER_HEADER = 'X-Interview-Owner-Id';

export type InterviewClientErrorCode =
  | 'INTERVIEW_ENGINE_TIMEOUT'
  | 'INTERVIEW_ENGINE_UNAVAILABLE'
  | 'INTERVIEW_ENGINE_REJECTED'
  | 'INTERVIEW_ENGINE_INVALID_RESPONSE';

export class InterviewClientError extends Error {
  constructor(
    public readonly code: InterviewClientErrorCode,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'InterviewClientError';
  }
}

async function requestInterview<T>(
  path: string,
  ownerId: string,
  schema: z.ZodType<T>,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
  config: InterviewEngineServerConfig = getInterviewEngineServerConfig(),
  fetchImplementation: typeof fetch = fetch,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetchImplementation(`${config.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        [OWNER_HEADER]: ownerId,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new InterviewClientError('INTERVIEW_ENGINE_TIMEOUT', 'The Interview Engine request timed out.');
    }
    throw new InterviewClientError('INTERVIEW_ENGINE_UNAVAILABLE', 'The Interview Engine is unavailable.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new InterviewClientError(
      'INTERVIEW_ENGINE_REJECTED',
      'The Interview Engine rejected the request.',
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new InterviewClientError('INTERVIEW_ENGINE_INVALID_RESPONSE', 'The Interview Engine returned invalid JSON.');
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new InterviewClientError('INTERVIEW_ENGINE_INVALID_RESPONSE', 'The Interview Engine response did not match its contract.');
  }
  return parsed.data;
}

export function startInterview(
  ownerId: string,
  request: InterviewCreateEngineRequest,
  config?: InterviewEngineServerConfig,
  fetchImplementation?: typeof fetch,
): Promise<CreateInterviewResponse> {
  return requestInterview('/api/v1/interviews', ownerId, createInterviewResponseSchema,
    { method: 'POST', body: request }, config, fetchImplementation);
}

export function getInterview(
  ownerId: string,
  sessionId: string,
  config?: InterviewEngineServerConfig,
  fetchImplementation?: typeof fetch,
): Promise<InterviewSession> {
  return requestInterview(`/api/v1/interviews/${encodeURIComponent(sessionId)}`, ownerId,
    interviewSessionSchema, {}, config, fetchImplementation);
}

export function listInterviews(
  ownerId: string,
  pageSize: number,
  cursor?: string,
  config?: InterviewEngineServerConfig,
  fetchImplementation?: typeof fetch,
): Promise<InterviewHistoryResponse> {
  const query = new URLSearchParams({ page_size: String(pageSize) });
  if (cursor) query.set('cursor', cursor);
  return requestInterview(`/api/v1/interviews?${query.toString()}`, ownerId,
    interviewHistoryResponseSchema, {}, config, fetchImplementation);
}

export function submitInterviewAnswer(
  ownerId: string,
  sessionId: string,
  request: InterviewSubmitAnswerEngineRequest,
  config?: InterviewEngineServerConfig,
  fetchImplementation?: typeof fetch,
): Promise<SubmitAnswerResponse> {
  return requestInterview(`/api/v1/interviews/${encodeURIComponent(sessionId)}/answers`, ownerId,
    submitAnswerResponseSchema, { method: 'POST', body: request }, config, fetchImplementation);
}

export function cancelInterview(
  ownerId: string,
  sessionId: string,
  config?: InterviewEngineServerConfig,
  fetchImplementation?: typeof fetch,
): Promise<InterviewSession> {
  return requestInterview(`/api/v1/interviews/${encodeURIComponent(sessionId)}/cancel`, ownerId,
    interviewSessionSchema, { method: 'POST' }, config, fetchImplementation);
}
