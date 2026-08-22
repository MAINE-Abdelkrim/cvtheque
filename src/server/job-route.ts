import type { RequestHandler } from 'express';
import { ZodError } from 'zod';
import { canonicalJobInputSchema } from '../types/job';
import type { CanonicalJob } from '../types/job';
import type { CandidateOpenJob } from '../types/candidate-job';
import { createJobRepository, type JobRepository } from './job-repository';
import type { RecruiterRequest } from './recruiter-auth';
import type { CandidateRequest } from './cv-auth';

export const CANDIDATE_OPEN_JOBS_LIMIT = 100;

/** Explicit candidate privacy boundary. Never spread CanonicalJob here. */
export function toCandidateOpenJob(job: CanonicalJob): CandidateOpenJob {
  return {
    jobId: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    requiredSkills: [...job.required_skills],
    minimumExperienceYears: job.minimum_experience_years,
    workMode: job.work_mode,
    contractType: job.contract_type,
    createdAt: job.createdAt,
  };
}

function sendError(response: any, status: number, code: string, message: string, details: string[] = []) {
  return response.status(status).json({ error: { code, message, details } });
}

export function createCandidateOpenJobsHandler(repositoryFactory: () => JobRepository = createJobRepository): RequestHandler {
  return async (request: CandidateRequest, response) => {
    if (!request.candidate) return sendError(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    try {
      const jobs = await repositoryFactory().getOpenCanonicalJobs();
      return response.json({ jobs: jobs.slice(0, CANDIDATE_OPEN_JOBS_LIMIT).map(toCandidateOpenJob) });
    } catch {
      return sendError(response, 503, 'JOB_RETRIEVAL_FAILED', 'Open Jobs could not be loaded.');
    }
  };
}

export function createJobCreateHandler(repositoryFactory: () => JobRepository = createJobRepository): RequestHandler {
  return async (request: RecruiterRequest, response) => {
    const startedAt = Date.now();
    if (!request.recruiter) return sendError(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    try {
      const input = canonicalJobInputSchema.parse(request.body);
      const job = await repositoryFactory().createCanonicalJob(request.recruiter.uid, input);
      console.info('[Job] canonical job created', { jobId: job.id, recruiterId: request.recruiter.uid, schemaVersion: job.schemaVersion, status: job.status, durationMs: Date.now() - startedAt });
      return response.status(201).json(job);
    } catch (error) {
      if (error instanceof ZodError) {
        return sendError(response, 400, 'JOB_VALIDATION_FAILED', 'The job data is invalid.', error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
      }
      console.warn('[Job] persistence failed', { recruiterId: request.recruiter.uid, durationMs: Date.now() - startedAt });
      return sendError(response, 503, 'JOB_PERSISTENCE_FAILED', 'The job could not be saved. Please try again.');
    }
  };
}

export function createMyJobsHandler(repositoryFactory: () => JobRepository = createJobRepository): RequestHandler {
  return async (request: RecruiterRequest, response) => {
    if (!request.recruiter) return sendError(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    try {
      return response.json({ jobs: await repositoryFactory().getJobsByRecruiter(request.recruiter.uid) });
    } catch (error) {
      console.warn('[Job] recruiter job retrieval failed', {
        recruiterId: request.recruiter.uid,
        errorCode: typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'UNKNOWN',
      });
      return sendError(response, 503, 'JOB_RETRIEVAL_FAILED', 'Jobs could not be loaded.');
    }
  };
}

export function createJobDeleteHandler(repositoryFactory: () => JobRepository = createJobRepository): RequestHandler {
  return async (request: RecruiterRequest, response) => {
    if (!request.recruiter) return sendError(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    try {
      const deleted = await repositoryFactory().deleteRecruiterJob(request.params.jobId, request.recruiter.uid);
      if (!deleted) return sendError(response, 404, 'JOB_NOT_FOUND', 'The canonical job was not found.');
      return response.status(204).send();
    } catch {
      return sendError(response, 503, 'JOB_PERSISTENCE_FAILED', 'The job could not be deleted.');
    }
  };
}
