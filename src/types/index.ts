import type { CVStructuredData } from './cv-parser';

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
  fileData?: string;
  aiScore?: number;
  feedback?: string;
  skills?: string[];
  parsedData?: CVStructuredData;
  fullName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
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

export interface JobApplication {
  id: string;
  jobId: string;
  candidateId: string;
  cvId: string;
  matchScore: number;
  status: 'APPLIED' | 'REVIEWED' | 'REJECTED' | 'HIRED';
  createdAt: string;
}

export type OralInterviewStage = 'INTRODUCTION' | 'EXPERIENCE' | 'TECHNICAL' | 'BEHAVIORAL' | 'COMPLETED';
export type InterviewStage = OralInterviewStage;

export interface OralInterviewMessage {
  id: string;
  sender: 'ai' | 'candidate';
  stage: OralInterviewStage;
  text: string;
  timestamp: string;
  audioUrl?: string;
  score?: number;
  feedback?: string;
}
export type InterviewMessage = OralInterviewMessage;

export interface OralInterviewSession {
  id: string;
  candidateId: string;
  jobId: string;
  jobTitle: string;
  currentStage: OralInterviewStage;
  status: 'IN_PROGRESS' | 'COMPLETED';
  audioMode: boolean;
  messages: OralInterviewMessage[];
  totalScore?: number;
  classification?: string;
  categoryScores?: Array<{ category: string; score: number; comment?: string }>;
  summaryFeedback?: string;
  createdAt?: string;
  completedAt?: string;
}
export type InterviewSession = OralInterviewSession;

export type { CanonicalJob, CanonicalJobInput, GeminiJobDraft } from './job';

