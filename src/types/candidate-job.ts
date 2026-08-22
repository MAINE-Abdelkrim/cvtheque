import type { CanonicalJob } from './job';

export interface CandidateOpenJob {
  jobId: string;
  title: string;
  company: string;
  location: string;
  requiredSkills: string[];
  minimumExperienceYears: number;
  workMode: CanonicalJob['work_mode'];
  contractType: CanonicalJob['contract_type'];
  createdAt: string;
}
