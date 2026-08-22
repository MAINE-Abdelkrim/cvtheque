import { z } from 'zod';

export interface MatcherCVInput {
  schema_version: '1.0';
  candidate_id: string;
  full_name?: string;
  summary?: string;
  skills: string[];
  experiences: Array<{
    job_title?: string;
    company?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
    description?: string;
    skills: string[];
  }>;
  education: Array<{ degree: string; field?: string; institution?: string; graduation_year?: number }>;
  languages: Array<{ name: string; level?: string }>;
  certifications: Array<{ name: string; issuer?: string; year?: number }>;
  location?: string;
}

export interface MatcherJobInput {
  schema_version: '1.0';
  job_id: string;
  job_title: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  minimum_experience_years: number;
  maximum_experience_years: number | null;
  required_education: { minimum_level: string; preferred_fields: string[]; mandatory: boolean };
  required_languages: Array<{ name: string; minimum_level: string; mandatory: boolean }>;
  location: string;
  remote_allowed: boolean;
  work_mode: 'onsite' | 'hybrid' | 'remote' | null;
  contract_type: 'CDI' | 'CDD' | 'Freelance' | 'Stage' | 'Alternance' | null;
  mandatory_requirements: Array<{
    code: string;
    description: string;
    satisfied: null;
  }>;
}

export interface MatchingRankingRequest {
  job: MatcherJobInput;
  candidates: MatcherCVInput[];
  options: { top_k: 3; include_technical_details: false; invalid_candidate_policy: 'skip' };
}

const criterionSchema = z.object({ status: z.string(), display: z.string() }).passthrough();
const candidateSchema = z.object({
  rank: z.number().int().positive(),
  candidate_id: z.string().nullish().transform(value => value ?? null),
  candidate_name: z.string().nullish().transform(value => value ?? null),
  score: z.number().min(0).max(100),
  match_level: z.string(),
  eligible: z.boolean(),
  eligibility_message: z.string(),
  summary: z.string(),
  required_skills: z.object({
    matched_count: z.number().int().nonnegative(), required_count: z.number().int().nonnegative(),
    display: z.string(), matched: z.array(z.string()), missing: z.array(z.string()),
  }),
  experience: z.object({
    candidate_years: z.number().nullish().transform(value => value ?? null),
    required_years: z.number().nullish().transform(value => value ?? null),
    status: z.string(),
    display: z.string(),
  }),
  education: criterionSchema,
  languages: criterionSchema,
  location_and_work_mode: criterionSchema,
  contract: criterionSchema,
  main_strengths: z.array(z.string()),
  main_gaps: z.array(z.string()),
  mandatory_failures: z.array(z.string()),
}).passthrough();

export const matchingRankingResponseSchema = z.object({
  job_id: z.string().nullable(),
  job_title: z.string().nullable(),
  candidates_received: z.number().int().nonnegative(),
  candidates_evaluated: z.number().int().nonnegative(),
  invalid_candidates_count: z.number().int().nonnegative(),
  duplicate_candidates_count: z.number().int().nonnegative(),
  eligible_candidates_count: z.number().int().nonnegative(),
  ineligible_candidates_count: z.number().int().nonnegative(),
  requested_top_k: z.number().int().positive(),
  returned_candidates_count: z.number().int().nonnegative(),
  top_candidates: z.array(candidateSchema),
  invalid_candidates: z.array(z.object({
    candidate_reference: z.string().nullable(),
    index: z.number().int().nonnegative(),
    error_code: z.string(),
    message: z.string(),
  })),
  duplicate_candidates: z.array(z.object({
    candidate_id: z.string(),
    index: z.number().int().nonnegative(),
    message: z.string(),
  })),
  summary: z.string(),
  metadata: z.object({
    matching_version: z.string(),
    ranking_version: z.string(),
    processed_at: z.string(),
    processing_time_ms: z.number().nonnegative(),
  }),
}).strict();

export type MatchingRankingResponse = z.infer<typeof matchingRankingResponseSchema>;

export interface RecruiterCandidateMatch {
  rank: number;
  candidateId: string;
  cvId: string;
  candidateName: string | null;
  score: number;
  matchLevel: string;
  eligible: boolean;
  eligibilityMessage: string;
  summary: string;
  requiredSkills: { matched: string[]; missing: string[]; display: string };
  experience: { candidateYears: number | null; requiredYears: number | null; status: string; display: string };
  education: { status: string; display: string };
  languages: { status: string; display: string };
  locationAndWorkMode: { status: string; display: string };
  contract: { status: string; display: string };
  strengths: string[];
  gaps: string[];
  mandatoryFailures: string[];
}

export interface RecruiterMatchingResponse {
  jobId: string;
  jobTitle: string;
  evaluatedCandidates: number;
  eligibleCandidates: number;
  invalidCandidates: number;
  topCandidates: RecruiterCandidateMatch[];
  summary: string;
}

const recruiterCriterionSchema = z.object({ status: z.string(), display: z.string() }).strict();

export const recruiterMatchingResponseSchema = z.object({
  jobId: z.string().min(1),
  jobTitle: z.string(),
  evaluatedCandidates: z.number().int().nonnegative(),
  eligibleCandidates: z.number().int().nonnegative(),
  invalidCandidates: z.number().int().nonnegative(),
  topCandidates: z.array(z.object({
    rank: z.number().int().positive(),
    candidateId: z.string().min(1),
    cvId: z.string().min(1),
    candidateName: z.string().nullable(),
    score: z.number().min(0).max(100),
    matchLevel: z.string(),
    eligible: z.boolean(),
    eligibilityMessage: z.string(),
    summary: z.string(),
    requiredSkills: z.object({ matched: z.array(z.string()), missing: z.array(z.string()), display: z.string() }).strict(),
    experience: z.object({ candidateYears: z.number().nullable(), requiredYears: z.number().nullable(), status: z.string(), display: z.string() }).strict(),
    education: recruiterCriterionSchema,
    languages: recruiterCriterionSchema,
    locationAndWorkMode: recruiterCriterionSchema,
    contract: recruiterCriterionSchema,
    strengths: z.array(z.string()),
    gaps: z.array(z.string()),
    mandatoryFailures: z.array(z.string()),
  }).strict()),
  summary: z.string(),
}).strict();
