export type UserRole = 'ADMIN' | 'RECRUITER' | 'CANDIDATE';
export type SubscriptionTier = 'FREE' | 'PREMIUM';

export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  subscription: SubscriptionTier;
  photoURL?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateCV {
  id: string;
  uid: string;
  fileName: string;
  fileURL?: string;
  aiScore?: number;
  feedback?: string;
  skills?: string[];
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  createdAt: string;
}

export interface EducationRequirement {
  minimum_level: string; // e.g. "Master", "Licence / Bac+3", "Doctorat"
  preferred_fields: string[];
  mandatory: boolean;
}

export interface LanguageRequirement {
  name: string; // e.g. "French", "English"
  minimum_level: string; // e.g. "beginner", "intermediate", "fluent", "native"
  mandatory: boolean;
}

export interface JobPosting {
  id: string;
  job_id?: string;
  recruiterId: string;
  title: string;
  description: string;
  company: string;
  location: string;
  required_skills?: string[];
  preferred_skills?: string[];
  minimum_experience_years?: number;
  maximum_experience_years?: number | null;
  required_education?: EducationRequirement;
  required_languages?: LanguageRequirement[];
  remote_allowed?: boolean;
  work_mode?: 'onsite' | 'hybrid' | 'remote' | null;
  contract_type?: 'CDI' | 'CDD' | 'Freelance' | 'Stage' | 'Alternance' | null;
  mandatory_requirements?: string[];
  scoring_weights?: {
    skills_weight?: number;
    experience_weight?: number;
    education_weight?: number;
    language_weight?: number;
  } | null;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt?: string;
  schemaVersion?: number;
}

export type { CanonicalJob, CanonicalJobInput, GeminiJobDraft } from './job';
