import type { MatchingRankingRequest, MatchingRankingResponse } from '../types/matching';
import { matchingRankingResponseSchema } from '../types/matching';

export type MatchingClientErrorCode =
  | 'MATCHING_ENGINE_TIMEOUT'
  | 'MATCHING_ENGINE_UNAVAILABLE'
  | 'MATCHING_ENGINE_REJECTED'
  | 'MATCHING_ENGINE_INVALID_RESPONSE';

export class MatchingClientError extends Error {
  constructor(public readonly code: MatchingClientErrorCode, message: string) {
    super(message);
    this.name = 'MatchingClientError';
  }
}

export interface MatchingClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export function getMatchingClientConfig(environment: NodeJS.ProcessEnv = process.env): MatchingClientConfig {
  const rawUrl = environment.MATCHING_ENGINE_URL?.trim();
  if (!rawUrl) throw new MatchingClientError('MATCHING_ENGINE_UNAVAILABLE', 'The Matching Engine URL is not configured.');
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new MatchingClientError('MATCHING_ENGINE_UNAVAILABLE', 'The Matching Engine URL is invalid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new MatchingClientError('MATCHING_ENGINE_UNAVAILABLE', 'The Matching Engine URL must use HTTP or HTTPS.');
  }
  const timeoutMs = Number(environment.MATCHING_ENGINE_TIMEOUT_MS || 30_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300_000) {
    throw new MatchingClientError('MATCHING_ENGINE_UNAVAILABLE', 'The Matching Engine timeout is invalid.');
  }
  return { baseUrl: rawUrl.replace(/\/+$/, ''), timeoutMs };
}

export async function rankCandidates(
  request: MatchingRankingRequest,
  config: MatchingClientConfig = getMatchingClientConfig(),
  fetchImplementation: typeof fetch = fetch,
): Promise<MatchingRankingResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetchImplementation(`${config.baseUrl}/api/v1/rank-candidates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new MatchingClientError('MATCHING_ENGINE_TIMEOUT', 'The Matching Engine request timed out.');
    }
    throw new MatchingClientError('MATCHING_ENGINE_UNAVAILABLE', 'The Matching Engine is unavailable.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new MatchingClientError('MATCHING_ENGINE_REJECTED', `The Matching Engine returned HTTP ${response.status}.`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new MatchingClientError('MATCHING_ENGINE_INVALID_RESPONSE', 'The Matching Engine returned invalid JSON.');
  }
  const parsed = matchingRankingResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new MatchingClientError('MATCHING_ENGINE_INVALID_RESPONSE', 'The Matching Engine response did not match its contract.');
  }
  return parsed.data;
}
