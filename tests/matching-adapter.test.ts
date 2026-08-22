import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptCanonicalCV, adaptCanonicalJob, normalizeMatcherDate } from '../src/server/matching-adapter';
import type { CanonicalPersistedCV } from '../src/types/cv-parser';
import type { CanonicalJob } from '../src/types/job';

function cv(): CanonicalPersistedCV {
  return {
    id: 'cv-document', uid: 'candidate-uid', status: 'PROCESSED', isCurrent: true,
    parsedData: {
      identity: { full_name: ' Candidate ', email: 'private@example.test', phone: '0600', linkedin: 'private', github: null, website: null, location: ' Oujda ', job_title: null, other_links: ['private'] },
      summary: ' Summary ', skills: [{ name: ' Python ', category: null, source: null }, { name: '', category: null, source: null }],
      experiences: [{ job_title: 'Intern', company: 'Atlas', location: 'Oujda', start_date: 'Juin 2024', end_date: 'Présent', description: 'Reports' }],
      education: [{ degree: null, field_of_study: 'Ignored', institution: 'Ignored', location: null, start_date: null, end_date: null, description: null },
        { degree: ' Master ', field_of_study: ' Computer Science ', institution: 'University', location: null, start_date: null, end_date: '2024', description: null }],
      languages: [{ language: ' French ', level: null, original_level: 'fluent' }],
      certifications: [{ name: 'AWS', issuer: 'Amazon', date: 'June 2023', credential_id: 'private' }],
    },
    file: { originalName: 'private.pdf', mimeType: 'application/pdf', sizeBytes: 10, sha256: 'private-hash' },
    parsing: { schemaVersion: 1, parserVersion: 'v', mode: 'deterministic', pageCount: 1, extractionMethod: 'native', warnings: [] },
    createdAt: '', updatedAt: '',
  };
}

function job(): CanonicalJob {
  return { id: 'job-document', recruiterId: 'owner', title: 'Backend', company: 'Atlas', location: 'Oujda', description: 'Build APIs',
    required_skills: ['Python'], preferred_skills: ['Docker'], minimum_experience_years: 2, maximum_experience_years: null,
    required_education: { minimum_level: 'Master', preferred_fields: [], mandatory: true },
    required_languages: [{ name: 'French', minimum_level: 'fluent', mandatory: true }], remote_allowed: false,
    work_mode: 'onsite', contract_type: 'CDI', mandatory_requirements: ['Must hold an arbitrary permit'], status: 'OPEN', schemaVersion: 1, createdAt: '', updatedAt: '' };
}

test('CV adapter flattens safe semantic fields and uses cvId identity', () => {
  const result = adaptCanonicalCV(cv());
  assert.equal(result.candidate_id, 'cv-document');
  assert.equal(result.full_name, 'Candidate');
  assert.equal(result.location, 'Oujda');
  assert.deepEqual(result.skills, ['Python']);
  assert.deepEqual(result.languages, [{ name: 'French', level: 'fluent' }]);
  assert.equal(result.education.length, 1);
  assert.deepEqual(result.education[0], { degree: 'Master', field: 'Computer Science', institution: 'University', graduation_year: 2024 });
  assert.deepEqual(result.certifications[0], { name: 'AWS', issuer: 'Amazon', year: 2023 });
});

test('date normalizer preserves precision and accepts English, French, and numeric month-year', () => {
  assert.equal(normalizeMatcherDate('2024-06'), '2024-06');
  assert.equal(normalizeMatcherDate('June 2024'), '2024-06');
  assert.equal(normalizeMatcherDate('Juin 2024'), '2024-06');
  assert.equal(normalizeMatcherDate('06/2024'), '2024-06');
  assert.equal(normalizeMatcherDate('2024'), undefined);
  assert.equal(normalizeMatcherDate('2024-99'), undefined);
  assert.equal(normalizeMatcherDate('2024-02-30'), undefined);
});

test('Present variants set is_current without inventing an end date', () => {
  const result = adaptCanonicalCV(cv()).experiences[0];
  assert.equal(result.start_date, '2024-06');
  assert.equal(result.is_current, true);
  assert.equal(result.end_date, undefined);
  assert.deepEqual(result.skills, []);
  assert.equal('location' in result, false);
});

test('CV adapter excludes private and parser/file fields', () => {
  const result: any = adaptCanonicalCV(cv());
  const text = JSON.stringify(result);
  for (const forbidden of ['private@example.test', '0600', 'private.pdf', 'private-hash', 'parserVersion', 'linkedin', 'credential_id', 'candidate-uid']) assert.equal(text.includes(forbidden), false);
});

test('Job adapter preserves mandatory requirement text without inventing satisfaction', () => {
  const result: any = adaptCanonicalJob(job());
  assert.equal(result.job_id, 'job-document');
  assert.equal(result.job_title, 'Backend');
  assert.deepEqual(result.mandatory_requirements, [{
    code: 'canonical-mandatory-1',
    description: 'Must hold an arbitrary permit',
    satisfied: null,
  }]);
  for (const forbidden of ['recruiterId', 'schemaVersion', 'createdAt', 'company', 'scoring_weights']) assert.equal(forbidden in result, false);
});
