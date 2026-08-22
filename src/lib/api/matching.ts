import type { User } from 'firebase/auth';
import { auth } from '../firebase/client';
import { recruiterMatchingResponseSchema, type RecruiterMatchingResponse } from '../../types/matching';

export class MatchingApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'MatchingApiError';
  }
}

export interface MatchingApiDependencies {
  getCurrentUser?: () => Pick<User, 'getIdToken'> | null;
  fetch?: typeof fetch;
}

export async function matchJobCandidates(
  jobId: string,
  dependencies: MatchingApiDependencies = {},
): Promise<RecruiterMatchingResponse> {
  const canonicalJobId = jobId.trim();
  if (!canonicalJobId) throw new MatchingApiError('JOB_ID_REQUIRED', 'Sélectionnez une offre avant de lancer le matching.', 400);
  const user = (dependencies.getCurrentUser ?? (() => auth?.currentUser))();
  if (!user) throw new MatchingApiError('AUTH_REQUIRED', 'Veuillez vous reconnecter avec votre compte recruteur.', 401);
  const token = await user.getIdToken();
  const response = await (dependencies.fetch ?? fetch)(`/api/jobs/${encodeURIComponent(canonicalJobId)}/match`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? (payload as any).error : null;
    throw new MatchingApiError(
      typeof error?.code === 'string' ? error.code : 'MATCHING_REQUEST_FAILED',
      typeof error?.message === 'string' ? error.message : 'Le matching est temporairement indisponible.',
      response.status,
    );
  }
  const parsed = recruiterMatchingResponseSchema.safeParse(payload);
  if (!parsed.success) throw new MatchingApiError('MATCHING_RESPONSE_INVALID', 'La réponse de matching est invalide.', 502);
  return parsed.data as RecruiterMatchingResponse;
}
