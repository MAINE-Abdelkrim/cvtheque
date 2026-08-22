import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toSafeCVResponse } from '../../src/server/cv-mapper';
import { adaptCanonicalCVForInterview, adaptCanonicalJobForInterview } from '../../src/server/interview-contract-adapter';
import { adaptCanonicalCV, adaptCanonicalJob } from '../../src/server/matching-adapter';
import type { CanonicalPersistedCV } from '../../src/types/cv-parser';
import { canonicalJobInputSchema, type CanonicalJob } from '../../src/types/job';

function fixture<T>(name: string): T {
  const url = new URL(`../../docs/contracts/examples/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

const canonicalCV = fixture<CanonicalPersistedCV>('canonical_cv_v1.json');
const canonicalJob = fixture<CanonicalJob>('canonical_job_v1.json');

test('synthetic CanonicalCV v1 passes the platform parser boundary and envelope invariants', () => {
  const safe = toSafeCVResponse({
    cv_data: { ...canonicalCV.parsedData, warnings: [] },
    pipeline_result: {
      total_pages: canonicalCV.parsing.pageCount,
      extraction_method: canonicalCV.parsing.extractionMethod,
    },
    llm_used: false,
  });
  assert.deepEqual(safe.cv, canonicalCV.parsedData);
  assert.equal(canonicalCV.parsing.schemaVersion, 1);
  assert.equal(canonicalCV.uid, 'candidate-synthetic-001');
  assert.equal(canonicalCV.id, 'cv-synthetic-001');
});

test('synthetic CanonicalCV v1 projects to Matching with cvId as candidate_id', () => {
  const projected = adaptCanonicalCV(canonicalCV);
  assert.equal(projected.candidate_id, canonicalCV.id);
  assert.equal(projected.full_name, 'Samira Example');
  assert.equal(projected.experiences[0].is_current, true);
  assert.equal(JSON.stringify(projected).includes('samira@example.test'), false);
});

test('synthetic CanonicalCV v1 projects to Interview without contact or ownership data', () => {
  const projected = adaptCanonicalCVForInterview(canonicalCV);
  assert.equal(projected.identity.full_name, 'Samira Example');
  assert.equal(projected.skills[0].category, 'programming_language');
  const serialized = JSON.stringify(projected);
  for (const excluded of ['samira@example.test', canonicalCV.uid, canonicalCV.id, 'credential_id']) {
    assert.equal(serialized.includes(excluded), false);
  }
});

test('synthetic CanonicalJob v1 passes authoritative platform validation', () => {
  const { id: _id, recruiterId: _owner, status: _status, schemaVersion: _version,
    createdAt: _created, updatedAt: _updated, ...input } = canonicalJob;
  const parsed = canonicalJobInputSchema.parse(input);
  assert.equal(parsed.minimum_experience_years, 2);
  assert.equal(parsed.required_languages[0].mandatory, true);
});

test('synthetic CanonicalJob v1 projects to Matching with unevaluated mandatory text', () => {
  const projected = adaptCanonicalJob(canonicalJob);
  assert.equal(projected.job_id, canonicalJob.id);
  assert.deepEqual(projected.mandatory_requirements, [{
    code: 'canonical-mandatory-1',
    description: 'Availability during core collaboration hours',
    satisfied: null,
  }]);
});

test('synthetic CanonicalJob v1 projects deterministically to Interview JobContext', () => {
  const projected = adaptCanonicalJobForInterview(canonicalJob);
  assert.equal(projected.minimum_experience, 'Minimum experience: 2 years');
  assert.deepEqual(projected.experience_requirements, ['Maximum experience: 5 years']);
  assert.deepEqual(projected.required_education, [
    'Minimum education: Master (mandatory); preferred fields: Computer Science',
  ]);
  assert.deepEqual(projected.language_requirements, ['French: minimum fluent (mandatory)']);
  assert.deepEqual(projected.mandatory_requirements, canonicalJob.mandatory_requirements);
  assert.equal('contract_type' in projected, false);
  assert.equal('remote_allowed' in projected, false);
});
