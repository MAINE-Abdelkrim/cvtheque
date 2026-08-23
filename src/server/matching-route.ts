import type { RequestHandler } from 'express';
import { adaptCanonicalCV, adaptCanonicalJob } from './matching-adapter';
import { MatchingClientError, rankCandidates } from './matching-client';
import { createCVRepository, type CVRepository } from './cv-repository';
import { createJobRepository, type JobRepository } from './job-repository';
import type { RecruiterRequest } from './recruiter-auth';
import type { MatchingRankingRequest, MatchingRankingResponse, RecruiterMatchingResponse } from '../types/matching';

const MAX_CANDIDATES = 5_000;

export interface MatchingRouteDependencies {
  jobRepositoryFactory?: () => JobRepository;
  cvRepositoryFactory?: () => CVRepository;
  rank?: (request: MatchingRankingRequest) => Promise<MatchingRankingResponse>;
}

function sendError(response: any, status: number, code: string, message: string) {
  return response.status(status).json({ error: { code, message, details: [] } });
}

function emptyResult(jobId: string, jobTitle: string): RecruiterMatchingResponse {
  return { jobId, jobTitle, evaluatedCandidates: 0, eligibleCandidates: 0, invalidCandidates: 0, topCandidates: [], summary: 'No current candidate CVs are available for matching.' };
}

export function createJobMatchingHandler(dependencies: MatchingRouteDependencies = {}): RequestHandler {
  const jobRepositoryFactory = dependencies.jobRepositoryFactory ?? createJobRepository;
  const cvRepositoryFactory = dependencies.cvRepositoryFactory ?? createCVRepository;
  const rank = dependencies.rank ?? rankCandidates;

  return async (request: RecruiterRequest, response) => {
    if (!request.recruiter) return sendError(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    const startedAt = Date.now();
    try {
      const job = await jobRepositoryFactory().getCanonicalJobById(request.params.jobId);
      if (!job || job.recruiterId !== request.recruiter.uid || job.schemaVersion !== 1) {
        return sendError(response, 404, 'JOB_NOT_FOUND', 'The canonical job was not found.');
      }
      if (job.status !== 'OPEN') return sendError(response, 409, 'JOB_NOT_OPEN', 'Only OPEN jobs can be matched.');

      const cvs = await cvRepositoryFactory().getCurrentCanonicalCVs();
      if (cvs.length === 0) return response.json(emptyResult(job.id, job.title));
      if (cvs.length > MAX_CANDIDATES) {
        return sendError(response, 422, 'MATCHING_CANDIDATE_LIMIT_EXCEEDED', `Matching supports at most ${MAX_CANDIDATES} candidates per request.`);
      }

      const correlations = new Map(cvs.map(cv => [cv.id, cv.id]));
      const ranking = await rank({
        job: adaptCanonicalJob(job),
        candidates: cvs.map(adaptCanonicalCV),
        options: { top_k: 3, include_technical_details: false, invalid_candidate_policy: 'skip' },
      });

      const topCandidates = ranking.top_candidates.map(candidate => {
        const correlation = candidate.candidate_id ? correlations.get(candidate.candidate_id) : undefined;
        if (!correlation) throw new MatchingClientError('MATCHING_ENGINE_INVALID_RESPONSE', 'The Matching Engine returned an unknown candidate identifier.');
        return {
          rank: candidate.rank,
          cvId: correlation,
          candidateName: candidate.candidate_name,
          score: candidate.score,
          matchLevel: candidate.match_level,
          eligible: candidate.eligible,
          eligibilityMessage: candidate.eligibility_message,
          summary: candidate.summary,
          requiredSkills: { matched: candidate.required_skills.matched, missing: candidate.required_skills.missing, display: candidate.required_skills.display },
          experience: { candidateYears: candidate.experience.candidate_years, requiredYears: candidate.experience.required_years, status: candidate.experience.status, display: candidate.experience.display },
          education: candidate.education,
          languages: candidate.languages,
          locationAndWorkMode: candidate.location_and_work_mode,
          contract: candidate.contract,
          strengths: candidate.main_strengths,
          gaps: candidate.main_gaps,
          mandatoryFailures: candidate.mandatory_failures,
        };
      });

      const result: RecruiterMatchingResponse = {
        jobId: job.id,
        jobTitle: job.title,
        evaluatedCandidates: ranking.candidates_evaluated,
        eligibleCandidates: ranking.eligible_candidates_count,
        invalidCandidates: ranking.invalid_candidates_count,
        topCandidates,
        summary: ranking.summary,
      };
      console.info('[Matching] ranking complete', { evaluatedCandidates: result.evaluatedCandidates, returnedCandidates: result.topCandidates.length, durationMs: Date.now() - startedAt });
      return response.json(result);
    } catch (error) {
      if (error instanceof MatchingClientError) {
        const status = error.code === 'MATCHING_ENGINE_TIMEOUT' ? 504
          : error.code === 'MATCHING_ENGINE_UNAVAILABLE' ? 503 : 502;
        console.warn('[Matching] engine request failed', { errorCode: error.code, durationMs: Date.now() - startedAt });
        return sendError(response, status, error.code, error.message);
      }
      console.warn('[Matching] retrieval failed', { durationMs: Date.now() - startedAt });
      return sendError(response, 503, 'MATCHING_DATA_UNAVAILABLE', 'The matching data could not be loaded.');
    }
  };
}
