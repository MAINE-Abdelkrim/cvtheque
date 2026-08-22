export interface InterviewCVInput {
  identity: {
    full_name: string | null;
    location: string | null;
    job_title: string | null;
  };
  summary: string | null;
  skills: Array<{ name: string; category: string | null; source: string | null }>;
  experiences: Array<{
    job_title: string | null;
    company: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
  }>;
  education: Array<{
    degree: string | null;
    field_of_study: string | null;
    institution: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
  }>;
  languages: Array<{ language: string; level: string | null; original_level: string | null }>;
  certifications: Array<{ name: string; issuer: string | null; date: string | null }>;
}

export interface InterviewJobContextInput {
  job_id: string;
  title: string;
  company: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  experience_requirements: string[];
  minimum_experience: string;
  required_education: string[];
  language_requirements: string[];
  location: string;
  work_mode: string | null;
  mandatory_requirements: string[];
}
