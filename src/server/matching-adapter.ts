import type { CanonicalPersistedCV } from '../types/cv-parser';
import type { CanonicalJob } from '../types/job';
import type { MatcherCVInput, MatcherJobInput } from '../types/matching';

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, janvier: 1, february: 2, feb: 2, fevrier: 2,
  march: 3, mar: 3, mars: 3, april: 4, apr: 4, avril: 4,
  may: 5, mai: 5, june: 6, jun: 6, juin: 6, july: 7, jul: 7, juillet: 7,
  august: 8, aug: 8, aout: 8, september: 9, sep: 9, septembre: 9,
  october: 10, oct: 10, octobre: 10, november: 11, nov: 11, novembre: 11,
  december: 12, dec: 12, decembre: 12,
};
const CURRENT = new Set(['present', 'current', 'presentement', 'actuel', 'actuelle', 'en cours']);

const clean = (value: string | null | undefined): string | undefined => value?.trim() || undefined;
const normalizedText = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const pad = (value: number) => String(value).padStart(2, '0');

function validDay(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isCurrentDate(value: string | null | undefined): boolean {
  return Boolean(value && CURRENT.has(normalizedText(value)));
}

export function normalizeMatcherDate(value: string | null | undefined): string | undefined {
  const source = clean(value);
  if (!source || isCurrentDate(source)) return undefined;
  let match = /^(\d{4})-(\d{2})$/.exec(source);
  if (match) {
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : undefined;
  }
  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    return validDay(year, month, day) ? source : undefined;
  }
  match = /^(\d{1,2})\/(\d{4})$/.exec(source);
  if (match) {
    const month = Number(match[1]);
    return month >= 1 && month <= 12 ? `${match[2]}-${pad(month)}` : undefined;
  }
  match = /^([\p{L}.]+)\s+(\d{4})$/u.exec(source);
  if (match) {
    const month = MONTHS[normalizedText(match[1]).replace(/\.$/, '')];
    return month ? `${match[2]}-${pad(month)}` : undefined;
  }
  return undefined;
}

export function extractExplicitYear(value: string | null | undefined): number | undefined {
  const source = clean(value);
  if (!source) return undefined;
  if (/^\d{4}$/.test(source)) return Number(source);
  const normalized = normalizeMatcherDate(source);
  return normalized ? Number(normalized.slice(0, 4)) : undefined;
}

export function adaptCanonicalCV(record: CanonicalPersistedCV): MatcherCVInput {
  const cv = record.parsedData;
  return {
    schema_version: '1.0',
    candidate_id: record.id,
    ...(clean(cv.identity.full_name) ? { full_name: clean(cv.identity.full_name) } : {}),
    ...(clean(cv.summary) ? { summary: clean(cv.summary) } : {}),
    skills: [...new Set(cv.skills.map(item => clean(item.name)).filter((item): item is string => Boolean(item)))],
    experiences: cv.experiences.map((item) => {
      const current = isCurrentDate(item.end_date);
      const start = normalizeMatcherDate(item.start_date);
      const end = normalizeMatcherDate(item.end_date);
      return {
        ...(clean(item.job_title) ? { job_title: clean(item.job_title) } : {}),
        ...(clean(item.company) ? { company: clean(item.company) } : {}),
        ...(start ? { start_date: start } : {}),
        ...(end ? { end_date: end } : {}),
        ...(current ? { is_current: true } : {}),
        ...(clean(item.description) ? { description: clean(item.description) } : {}),
        skills: [],
      };
    }),
    education: cv.education.flatMap((item) => {
      const degree = clean(item.degree);
      if (!degree) return [];
      const year = extractExplicitYear(item.end_date);
      return [{ degree, ...(clean(item.field_of_study) ? { field: clean(item.field_of_study) } : {}),
        ...(clean(item.institution) ? { institution: clean(item.institution) } : {}), ...(year ? { graduation_year: year } : {}) }];
    }),
    languages: cv.languages.flatMap((item) => {
      const name = clean(item.language);
      if (!name) return [];
      const level = clean(item.level) ?? clean(item.original_level);
      return [{ name, ...(level ? { level } : {}) }];
    }),
    certifications: cv.certifications.flatMap((item) => {
      const name = clean(item.name);
      if (!name) return [];
      const year = extractExplicitYear(item.date);
      return [{ name, ...(clean(item.issuer) ? { issuer: clean(item.issuer) } : {}), ...(year ? { year } : {}) }];
    }),
    ...(clean(cv.identity.location) ? { location: clean(cv.identity.location) } : {}),
  };
}

export function adaptCanonicalJob(job: CanonicalJob): MatcherJobInput {
  return {
    schema_version: '1.0', job_id: job.id, job_title: job.title, description: job.description,
    required_skills: job.required_skills, preferred_skills: job.preferred_skills,
    minimum_experience_years: job.minimum_experience_years,
    maximum_experience_years: job.maximum_experience_years,
    required_education: {
      ...job.required_education,
      preferred_fields: job.required_education.preferred_fields ?? [],
    },
    required_languages: job.required_languages,
    location: job.location, remote_allowed: job.remote_allowed, work_mode: job.work_mode,
    contract_type: job.contract_type,
    // Canonical requirements are recruiter statements, not candidate evidence.
    // Preserve them for traceability while keeping satisfaction explicitly unknown.
    mandatory_requirements: job.mandatory_requirements.map((description, index) => ({
      code: `canonical-mandatory-${index + 1}`,
      description,
      satisfied: null,
    })),
  };
}
