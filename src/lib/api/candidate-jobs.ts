import type { User } from 'firebase/auth';
import { auth } from '../firebase/client';
import type { CandidateOpenJob } from '../../types/candidate-job';

export interface CandidateJobsApiDependencies {
  getCurrentUser?: () => Pick<User, 'getIdToken'> | null;
  fetch?: typeof fetch;
}

export class CandidateJobsApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'CandidateJobsApiError';
  }
}

function mapJob(value: unknown): CandidateOpenJob | null {
  if (typeof value !== 'object' || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.jobId !== 'string' || typeof item.title !== 'string' || typeof item.company !== 'string'
    || typeof item.location !== 'string' || typeof item.minimumExperienceYears !== 'number'
    || typeof item.createdAt !== 'string' || !Array.isArray(item.requiredSkills)) return null;
  const workMode = item.workMode === 'onsite' || item.workMode === 'hybrid' || item.workMode === 'remote' ? item.workMode : null;
  const contractType = ['CDI', 'CDD', 'Freelance', 'Stage', 'Alternance'].includes(String(item.contractType))
    ? item.contractType as CandidateOpenJob['contractType'] : null;
  return {
    jobId: item.jobId,
    title: item.title,
    company: item.company,
    location: item.location,
    requiredSkills: item.requiredSkills.filter((skill): skill is string => typeof skill === 'string'),
    minimumExperienceYears: item.minimumExperienceYears,
    workMode,
    contractType,
    createdAt: item.createdAt,
  };
}

export async function getOpenCandidateJobs(dependencies: CandidateJobsApiDependencies = {}): Promise<CandidateOpenJob[]> {
  const user = (dependencies.getCurrentUser ?? (() => auth?.currentUser))();
  if (!user) throw new CandidateJobsApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await (dependencies.fetch ?? fetch)('/api/jobs/open', { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new CandidateJobsApiError('NETWORK_ERROR', 'Open Jobs could not be loaded.', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = typeof payload === 'object' && payload !== null && 'error' in payload ? (payload as any).error : null;
    throw new CandidateJobsApiError(typeof error?.code === 'string' ? error.code : 'JOB_RETRIEVAL_FAILED', 'Open Jobs could not be loaded.', response.status);
  }
  const jobs = typeof payload === 'object' && payload !== null && 'jobs' in payload ? (payload as any).jobs : null;
  if (!Array.isArray(jobs)) throw new CandidateJobsApiError('JOB_RESPONSE_INVALID', 'Open Jobs could not be loaded.', 502);
  return jobs.map(mapJob).filter((job): job is CandidateOpenJob => job !== null);
}
