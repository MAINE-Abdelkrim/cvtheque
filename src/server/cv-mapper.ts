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

const nullableString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const stringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (isRecord(item)) return nullableString(item.url || item.link || item.name || item.value) || '';
      return '';
    }).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

function identity(value: unknown): CVParserIdentity {
  const item = isRecord(value) ? value : {};
  const otherLinks = stringList(item.other_links || item.otherLinks || item.links || item.socials || item.urls);

  return {
    full_name: nullableString(item.full_name || item.fullName || item.name || item.nom || item.candidate_name || item.candidateName),
    email: nullableString(item.email || item.mail || item.courriel || item.email_address),
    phone: nullableString(item.phone || item.tel || item.telephone || item.mobile || item.phone_number),
    linkedin: nullableString(item.linkedin || item.linkedIn || item.linkedin_url || item.linkedInUrl),
    github: nullableString(item.github || item.gitHub || item.github_url || item.gitHubUrl),
    website: nullableString(item.website || item.portfolio || item.site || item.site_web || item.url),
    location: nullableString(item.location || item.address || item.adresse || item.city || item.ville || item.country || item.pays),
    job_title: nullableString(item.job_title || item.jobTitle || item.title || item.titre || item.headline || item.poste_vise || item.current_title),
    other_links: otherLinks,
  };
}

function extractSkills(value: unknown): CVParserSkill[] {
  if (!Array.isArray(value)) return [];
  const results: CVParserSkill[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      results.push({ name: entry.trim(), category: null, source: 'extracted' });
    } else if (isRecord(entry)) {
      const name = nullableString(entry.name || entry.skill || entry.nom || entry.label || entry.value || entry.title);
      if (name) {
        results.push({
          name,
          category: nullableString(entry.category || entry.categorie || entry.type || entry.domain || entry.group),
          source: nullableString(entry.source || entry.provenance) || 'extracted',
        });
      }
    }
  }
  return results;
}

function extractLanguages(value: unknown): CVParserLanguage[] {
  if (!Array.isArray(value)) return [];
  const results: CVParserLanguage[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      const str = entry.trim();
      const match = str.match(/^([^(:-]+)(?:[(:-]\s*([^)]+)\)?)?$/);
      if (match) {
        results.push({
          language: match[1].trim(),
          level: match[2] ? match[2].trim() : null,
          original_level: str,
        });
      } else {
        results.push({ language: str, level: null, original_level: str });
      }
    } else if (isRecord(entry)) {
      const language = nullableString(entry.language || entry.langue || entry.name || entry.nom);
      if (language) {
        results.push({
          language,
          level: nullableString(entry.level || entry.niveau || entry.proficiency || entry.fluency),
          original_level: nullableString(entry.original_level || entry.originalLevel || entry.raw_level || entry.level),
        });
      }
    }
  }
  return results;
}

function extractCertifications(value: unknown): CVParserCertification[] {
  if (!Array.isArray(value)) return [];
  const results: CVParserCertification[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      results.push({
        name: entry.trim(),
        issuer: null,
        date: null,
        credential_id: null,
      });
    } else if (isRecord(entry)) {
      const name = nullableString(entry.name || entry.title || entry.titre || entry.certification || entry.nom);
      if (name) {
        results.push({
          name,
          issuer: nullableString(entry.issuer || entry.organization || entry.organisme || entry.autorite || entry.provider || entry.institution),
          date: nullableString(entry.date || entry.year || entry.annee || entry.obtained_at || entry.issued_date),
          credential_id: nullableString(entry.credential_id || entry.credentialId || entry.id || entry.reference || entry.license_number),
        });
      }
    }
  }
  return results;
}

function extractEducation(value: unknown): CVParserEducation[] {
  if (!Array.isArray(value)) return [];
  const results: CVParserEducation[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      results.push({
        degree: entry.trim(),
        field_of_study: null,
        institution: null,
        location: null,
        start_date: null,
        end_date: null,
        description: null,
      });
    } else if (isRecord(entry)) {
      let desc: string | null = null;
      const edSource = entry.description || entry.details || entry.courses;
      if (typeof entry.description === 'string') {
        desc = entry.description.trim();
      } else if (Array.isArray(edSource)) {
        desc = edSource.filter(Boolean).map(String).join('\n');
      } else if (typeof entry.details === 'string') {
        desc = entry.details.trim();
      }

      const degree = nullableString(entry.degree || entry.diploma || entry.diplome || entry.title || entry.qualification || entry.niveau);
      const institution = nullableString(entry.institution || entry.school || entry.university || entry.ecole || entry.universite || entry.etablissement);
      const field_of_study = nullableString(entry.field_of_study || entry.fieldOfStudy || entry.field || entry.domaine || entry.specialite || entry.major);
      const location = nullableString(entry.location || entry.city || entry.ville || entry.lieu);
      const start_date = nullableString(entry.start_date || entry.startDate || entry.start || entry.debut || entry.annee_debut || entry.from);
      const end_date = nullableString(entry.end_date || entry.endDate || entry.end || entry.fin || entry.annee_fin || entry.to);

      if (degree || institution || field_of_study || desc) {
        results.push({
          degree,
          field_of_study,
          institution,
          location,
          start_date,
          end_date,
          description: desc || null,
        });
      }
    }
  }
  return results;
}

function extractExperiences(value: unknown): CVParserExperience[] {
  if (!Array.isArray(value)) return [];
  const results: CVParserExperience[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;

    let desc: string | null = null;
    const expSource = entry.description || entry.responsibilities || entry.missions || entry.tasks || entry.achievements || entry.projects;
    if (typeof entry.description === 'string' && entry.description.trim()) {
      desc = entry.description.trim();
    } else if (Array.isArray(expSource)) {
      desc = expSource
        .map((t: unknown) => typeof t === 'string' ? t.trim() : isRecord(t) ? nullableString(t.name || t.description) || JSON.stringify(t) : '')
        .filter(Boolean)
        .join('\n');
    } else if (typeof entry.responsibilities === 'string') {
      desc = entry.responsibilities.trim();
    } else if (typeof entry.missions === 'string') {
      desc = entry.missions.trim();
    }

    const job_title = nullableString(entry.job_title || entry.jobTitle || entry.title || entry.position || entry.role || entry.poste || entry.intitule);
    const company = nullableString(entry.company || entry.employer || entry.organization || entry.entreprise || entry.societe || entry.client);
    const location = nullableString(entry.location || entry.city || entry.ville || entry.lieu);
    const start_date = nullableString(entry.start_date || entry.startDate || entry.start || entry.debut || entry.date_debut || entry.from);
    const end_date = nullableString(entry.end_date || entry.endDate || entry.end || entry.fin || entry.date_fin || entry.to);

    if (job_title || company || desc) {
      results.push({
        job_title,
        company,
        location,
        start_date,
        end_date,
        description: desc || null,
      });
    }
  }
  return results;
}

export function structuredData(value: unknown): CVStructuredData {
  if (!isRecord(value)) throw new CVRouteError(502, 'CV_PARSER_INVALID_RESPONSE', 'The CV analysis service returned an invalid response.');

  return {
    identity: identity(value.identity),
    summary: nullableString(value.summary || value.profile || value.bio || value.about || value.resume || value.presentation || value.objective),
    skills: extractSkills(value.skills || value.competences),
    languages: extractLanguages(value.languages || value.langues),
    certifications: extractCertifications(value.certifications || value.certificates || value.diplomes),
    education: extractEducation(value.education || value.formations || value.studies),
    experiences: extractExperiences(value.experiences || value.experience || value.parcours),
  };
}

export function toSafeCVResponse(payload: unknown): CVParserSafeResponse {
  if (!isRecord(payload)) {
    throw new CVRouteError(502, 'CV_PARSER_INVALID_RESPONSE', 'The CV analysis service returned an invalid response.');
  }

  // Handle pipeline_result structure or direct/wrapped formats
  const rawCvData = payload.cv_data !== undefined
    ? payload.cv_data
    : payload.cv !== undefined
    ? payload.cv
    : payload.data !== undefined
    ? payload.data
    : payload;

  if (!isRecord(rawCvData)) {
    throw new CVRouteError(502, 'CV_PARSER_INVALID_RESPONSE', 'The CV analysis service returned an invalid response.');
  }

  const pipeline = isRecord(payload.pipeline_result) ? payload.pipeline_result : {};
  const hasWarnings = stringList(rawCvData.warnings).length > 0;

  const totalPages = typeof pipeline.total_pages === 'number'
    ? pipeline.total_pages
    : typeof (payload as any).metadata?.pageCount === 'number'
    ? (payload as any).metadata.pageCount
    : 1;

  const extractionMethod = typeof pipeline.extraction_method === 'string'
    ? pipeline.extraction_method
    : typeof (payload as any).metadata?.extractionMethod === 'string'
    ? (payload as any).metadata.extractionMethod
    : 'hybrid';

  const mode = payload.llm_used === true || (payload as any).metadata?.mode === 'hybrid'
    ? 'hybrid'
    : 'deterministic';

  return {
    status: 'success',
    cv: structuredData(rawCvData),
    warnings: hasWarnings
      ? [{ code: 'PARTIAL_EXTRACTION', message: 'Some information could not be detected. Please review the extracted fields.' }]
      : [],
    metadata: {
      pageCount: totalPages,
      extractionMethod,
      mode,
    },
  };
}

