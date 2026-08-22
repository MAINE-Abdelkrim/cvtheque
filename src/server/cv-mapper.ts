import type {
  CVParserCertification,
  CVParserEducation,
  CVParserExperience,
  CVParserIdentity,
  CVParserLanguage,
  CVParserSafeResponse,
  CVParserSkill,
  CVStructuredData,
} from '../types/cv-parser';
import { CVRouteError, isRecord } from './cv-errors';

const nullableString = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function identity(value: unknown): CVParserIdentity {
  const item = isRecord(value) ? value : {};
  return {
    full_name: nullableString(item.full_name),
    email: nullableString(item.email),
    phone: nullableString(item.phone),
    linkedin: nullableString(item.linkedin),
    github: nullableString(item.github),
    website: nullableString(item.website),
    location: nullableString(item.location),
    job_title: nullableString(item.job_title),
    other_links: stringList(item.other_links),
  };
}

function mappedList<T>(value: unknown, mapper: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const mapped = mapper(entry);
    return mapped ? [mapped] : [];
  });
}

function structuredData(value: unknown): CVStructuredData {
  if (!isRecord(value)) throw new CVRouteError(502, 'CV_PARSER_INVALID_RESPONSE', 'The CV analysis service returned an invalid response.');

  return {
    identity: identity(value.identity),
    summary: nullableString(value.summary),
    skills: mappedList<CVParserSkill>(value.skills, (item) => {
      const name = nullableString(item.name);
      return name ? { name, category: nullableString(item.category), source: nullableString(item.source) } : null;
    }),
    languages: mappedList<CVParserLanguage>(value.languages, (item) => {
      const language = nullableString(item.language);
      return language ? { language, level: nullableString(item.level), original_level: nullableString(item.original_level) } : null;
    }),
    certifications: mappedList<CVParserCertification>(value.certifications, (item) => {
      const name = nullableString(item.name);
      return name ? { name, issuer: nullableString(item.issuer), date: nullableString(item.date), credential_id: nullableString(item.credential_id) } : null;
    }),
    education: mappedList<CVParserEducation>(value.education, (item) => ({
      degree: nullableString(item.degree),
      field_of_study: nullableString(item.field_of_study),
      institution: nullableString(item.institution),
      location: nullableString(item.location),
      start_date: nullableString(item.start_date),
      end_date: nullableString(item.end_date),
      description: nullableString(item.description),
    })),
    experiences: mappedList<CVParserExperience>(value.experiences, (item) => ({
      job_title: nullableString(item.job_title),
      company: nullableString(item.company),
      location: nullableString(item.location),
      start_date: nullableString(item.start_date),
      end_date: nullableString(item.end_date),
      description: nullableString(item.description),
    })),
  };
}

export function toSafeCVResponse(payload: unknown): CVParserSafeResponse {
  if (!isRecord(payload) || !isRecord(payload.pipeline_result)) {
    throw new CVRouteError(502, 'CV_PARSER_INVALID_RESPONSE', 'The CV analysis service returned an invalid response.');
  }

  const pipeline = payload.pipeline_result;
  const hasWarnings = isRecord(payload.cv_data) && stringList(payload.cv_data.warnings).length > 0;

  return {
    status: 'success',
    cv: structuredData(payload.cv_data),
    warnings: hasWarnings
      ? [{ code: 'PARTIAL_EXTRACTION', message: 'Some information could not be detected. Please review the extracted fields.' }]
      : [],
    metadata: {
      pageCount: typeof pipeline.total_pages === 'number' ? pipeline.total_pages : 0,
      extractionMethod: typeof pipeline.extraction_method === 'string' ? pipeline.extraction_method : 'unknown',
      mode: payload.llm_used === true ? 'hybrid' : 'deterministic',
    },
  };
}
