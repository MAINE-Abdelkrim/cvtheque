import type { CVStructuredData } from '../types/cv-parser';
import type { CreateInterviewResponse } from '../types/interview';
import { adaptCanonicalCVForInterview, adaptCanonicalJobForInterview } from './interview-contract-adapter';
import { startInterview } from './interview-client';
import { createCVRepository, type CVRepository } from './cv-repository';
import { createJobRepository, type JobRepository } from './job-repository';

export class InterviewIntegrationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'InterviewIntegrationError';
  }
}

function hasUsableCV(cv: CVStructuredData): boolean {
  return Boolean(
    cv.identity.full_name?.trim()
    || cv.identity.job_title?.trim()
    || cv.summary?.trim()
    || cv.skills.length
    || cv.experiences.length
    || cv.education.length,
  );
}

export interface StartInterviewDependencies {
  cvRepositoryFactory?: () => CVRepository;
  jobRepositoryFactory?: () => JobRepository;
  start?: typeof startInterview;
}

export async function startInterviewForCandidate(
  candidateUserId: string,
  cvId: string,
  jobId: string | undefined,
  dependencies: StartInterviewDependencies = {},
): Promise<CreateInterviewResponse> {
  const cvRepository = (dependencies.cvRepositoryFactory ?? createCVRepository)();
  const candidateCVs = await cvRepository.getCVHistoryByUid(candidateUserId);
  const cv = candidateCVs.find(record => record.id === cvId);
  if (!cv || cv.uid !== candidateUserId) {
    throw new InterviewIntegrationError(404, 'CV_NOT_FOUND', 'The requested CV was not found.');
  }
  if (cv.status !== 'PROCESSED' || cv.parsing.schemaVersion !== 1 || !hasUsableCV(cv.parsedData)) {
    throw new InterviewIntegrationError(422, 'CV_NOT_USABLE', 'The requested CV cannot be used for an interview.');
  }

  let job;
  if (jobId !== undefined) {
    const jobRepository = (dependencies.jobRepositoryFactory ?? createJobRepository)();
    job = await jobRepository.getCanonicalJobById(jobId);
    if (!job || job.schemaVersion !== 1) {
      throw new InterviewIntegrationError(404, 'JOB_NOT_FOUND', 'The requested Job was not found.');
    }
    if (job.status !== 'OPEN') {
      throw new InterviewIntegrationError(409, 'JOB_NOT_AVAILABLE', 'The requested Job is not open.');
    }
  }

  return (dependencies.start ?? startInterview)(candidateUserId, {
    cv: adaptCanonicalCVForInterview(cv),
    ...(job ? { job: adaptCanonicalJobForInterview(job) } : {}),
  });
}
