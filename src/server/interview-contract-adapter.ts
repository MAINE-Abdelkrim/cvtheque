import type { CanonicalPersistedCV } from '../types/cv-parser';
import type { InterviewCVInput, InterviewJobContextInput } from '../types/interview-contract';
import type { CanonicalJob } from '../types/job';

type EducationRequirement = CanonicalJob['required_education'];
type LanguageRequirement = CanonicalJob['required_languages'][number];

function formatYears(years: number): string {
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

function formatEducation(requirement: EducationRequirement): string {
  const level = requirement.minimum_level.trim() || 'unspecified level';
  const fields = requirement.preferred_fields.length
    ? `; preferred fields: ${requirement.preferred_fields.join(', ')}`
    : '';
  return `Minimum education: ${level}${requirement.mandatory ? ' (mandatory)' : ''}${fields}`;
}

function formatLanguage(requirement: LanguageRequirement): string {
  return `${requirement.name}: minimum ${requirement.minimum_level}${requirement.mandatory ? ' (mandatory)' : ''}`;
}

/** Pure projection only. Ownership and snapshot metadata are not part of Interview CanonicalCV. */
export function adaptCanonicalCVForInterview(record: CanonicalPersistedCV): InterviewCVInput {
  const cv = record.parsedData;
  return {
    identity: {
      full_name: cv.identity.full_name,
      location: cv.identity.location,
      job_title: cv.identity.job_title,
    },
    summary: cv.summary,
    skills: cv.skills.map(skill => ({ ...skill })),
    experiences: cv.experiences.map(experience => ({ ...experience })),
    education: cv.education.map(education => ({ ...education })),
    languages: cv.languages.map(language => ({ ...language })),
    certifications: cv.certifications.map(({ name, issuer, date }) => ({ name, issuer, date })),
  };
}

/** Deterministic projection to the Interview Engine's current text-oriented JobContext. */
export function adaptCanonicalJobForInterview(job: CanonicalJob): InterviewJobContextInput {
  const experienceRequirements = job.maximum_experience_years === null
    ? []
    : [`Maximum experience: ${formatYears(job.maximum_experience_years)}`];
  return {
    job_id: job.id,
    title: job.title,
    company: job.company,
    description: job.description,
    required_skills: [...job.required_skills],
    preferred_skills: [...job.preferred_skills],
    experience_requirements: experienceRequirements,
    minimum_experience: `Minimum experience: ${formatYears(job.minimum_experience_years)}`,
    required_education: [formatEducation(job.required_education)],
    language_requirements: job.required_languages.map(formatLanguage),
    location: job.location,
    work_mode: job.work_mode,
    mandatory_requirements: [...job.mandatory_requirements],
  };
}
