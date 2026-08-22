import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import type { App } from 'firebase-admin/app';
import { createRequireCandidate } from '../src/server/cv-auth';
import { CVRouteError, parserErrorFromResponse } from '../src/server/cv-errors';
import { toSafeCVResponse } from '../src/server/cv-mapper';
import { parseCVWithFastAPI } from '../src/server/cv-parser-client';
import { createCurrentCVHandler, createCVParseHandler } from '../src/server/cv-route';
import { CV_PARSER_VERSION, CV_SCHEMA_VERSION, sortCanonicalCVsNewestFirst, type CVRepository } from '../src/server/cv-repository';
import { parsePDFUpload } from '../src/server/cv-upload';
import { CVParserClientError, validateCandidateCVFile } from '../src/lib/api/cv-parser-client';
import type { CanonicalPersistedCV, NewCanonicalCV } from '../src/types/cv-parser';

const pdf = new Uint8Array(Buffer.from('%PDF-1.4\nsynthetic test only'));

function responseRecorder() {
  const record: { status?: number; body?: unknown } = {};
  const response = {
    status(status: number) { record.status = status; return this; },
    json(body: unknown) { record.body = body; return this; },
  };
  return { record, response: response as never };
}

function authRequest(authorization?: string) {
  return { headers: authorization ? { authorization } : {} } as never;
}

function authMiddleware(profile: Record<string, unknown> | null, verifyRejects = false) {
  return createRequireCandidate(
    () => ({} as App),
    {
      async verifyToken() {
        if (verifyRejects) throw new Error('invalid');
        return { uid: 'candidate-test' };
      },
      async getProfile() { return profile; },
    },
  );
}

async function runAuth(authorization: string | undefined, profile: Record<string, unknown> | null, verifyRejects = false) {
  const request = authRequest(authorization);
  const { record, response } = responseRecorder();
  let nextCalled = false;
  await authMiddleware(profile, verifyRejects)(request, response, () => { nextCalled = true; });
  return { request, record, nextCalled };
}

test('candidate auth rejects missing Authorization header', async () => {
  const result = await runAuth(undefined, { role: 'CANDIDATE', isActive: true });
  assert.equal(result.record.status, 401);
  assert.equal((result.record.body as any).error.code, 'AUTH_REQUIRED');
});

test('candidate auth fails safely when Firebase Admin is unavailable', async () => {
  const middleware = createRequireCandidate(() => null);
  const { record, response } = responseRecorder();
  await middleware(authRequest('Bearer token'), response, () => assert.fail('next must not run'));
  assert.equal(record.status, 503);
  assert.equal((record.body as any).error.code, 'AUTH_SERVICE_UNAVAILABLE');
});

test('candidate auth rejects invalid token', async () => {
  const result = await runAuth('Bearer invalid', { role: 'CANDIDATE', isActive: true }, true);
  assert.equal(result.record.status, 401);
  assert.equal((result.record.body as any).error.code, 'AUTH_INVALID');
});

test('candidate auth rejects inactive profile', async () => {
  const result = await runAuth('Bearer token', { role: 'CANDIDATE', isActive: false });
  assert.equal(result.record.status, 403);
  assert.equal((result.record.body as any).error.code, 'ACCOUNT_INACTIVE');
});

test('candidate auth rejects non-candidate role', async () => {
  const result = await runAuth('Bearer token', { role: 'RECRUITER', isActive: true });
  assert.equal(result.record.status, 403);
  assert.equal((result.record.body as any).error.code, 'CANDIDATE_ROLE_REQUIRED');
});

test('candidate auth rejects Admin role', async () => {
  const result = await runAuth('Bearer token', { role: 'ADMIN', isActive: true });
  assert.equal(result.record.status, 403);
  assert.equal((result.record.body as any).error.code, 'CANDIDATE_ROLE_REQUIRED');
});

test('candidate auth accepts active candidate', async () => {
  const result = await runAuth('Bearer token', { role: 'CANDIDATE', isActive: true });
  assert.equal(result.nextCalled, true);
  assert.deepEqual((result.request as any).candidate, { uid: 'candidate-test', role: 'CANDIDATE' });
});

test('current canonical CV fallback preserves newest-first repository order', () => {
  const older = { id: 'older', createdAt: '2026-01-01T00:00:00.000Z' } as CanonicalPersistedCV;
  const newer = { id: 'newer', createdAt: '2026-02-01T00:00:00.000Z' } as CanonicalPersistedCV;
  assert.deepEqual(sortCanonicalCVsNewestFirst([older, newer]).map(record => record.id), ['newer', 'older']);
});

async function multipartRequest(entries: Array<[string, Blob, string]>) {
  const form = new FormData();
  for (const [name, blob, filename] of entries) form.append(name, blob, filename);
  const encoded = new Response(form);
  const body = Buffer.from(await encoded.arrayBuffer());
  const request = Readable.from([body]) as any;
  request.headers = {
    'content-type': encoded.headers.get('content-type'),
    'content-length': String(body.length),
  };
  return request;
}

async function uploadError(entries: Array<[string, Blob, string]>, max = 10_485_760) {
  try {
    await parsePDFUpload(await multipartRequest(entries), max);
    assert.fail('Expected upload validation to fail');
  } catch (error) {
    assert.ok(error instanceof CVRouteError);
    return error;
  }
}

test('upload rejects missing file field', async () => {
  const error = await uploadError([]);
  assert.equal(error.code, 'FILE_REQUIRED');
});

test('upload rejects multiple files', async () => {
  const error = await uploadError([
    ['file', new Blob([pdf], { type: 'application/pdf' }), 'one.pdf'],
    ['file', new Blob([pdf], { type: 'application/pdf' }), 'two.pdf'],
  ]);
  assert.equal(error.code, 'MULTIPLE_FILES');
});

test('upload rejects non-PDF type and extension', async () => {
  const error = await uploadError([['file', new Blob(['text'], { type: 'text/plain' }), 'cv.txt']]);
  assert.equal(error.code, 'UNSUPPORTED_FILE_TYPE');
});

test('upload rejects empty PDF', async () => {
  const error = await uploadError([['file', new Blob([], { type: 'application/pdf' }), 'empty.pdf']]);
  assert.equal(error.code, 'INVALID_PDF');
});

test('upload rejects oversized PDF', async () => {
  const error = await uploadError([['file', new Blob([pdf], { type: 'application/pdf' }), 'large.pdf']], 5);
  assert.equal(error.code, 'FILE_TOO_LARGE');
});

test('upload rejects invalid PDF signature', async () => {
  const error = await uploadError([['file', new Blob(['not a pdf'], { type: 'application/pdf' }), 'fake.pdf']]);
  assert.equal(error.code, 'INVALID_PDF');
});

test('upload accepts one synthetic PDF', async () => {
  const upload = await parsePDFUpload(await multipartRequest([['file', new Blob([pdf], { type: 'application/pdf' }), 'cv.pdf']]), 1024);
  assert.equal(upload.filename, 'cv.pdf');
  assert.equal(upload.bytes.subarray(0, 5).toString(), '%PDF-');
});

test('client validation accepts PDF and rejects DOCX', () => {
  assert.doesNotThrow(() => validateCandidateCVFile(new File([pdf], 'cv.pdf', { type: 'application/pdf' })));
  assert.throws(
    () => validateCandidateCVFile(new File(['docx'], 'cv.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })),
    (error: any) => error instanceof CVParserClientError && error.code === 'UNSUPPORTED_FILE_TYPE',
  );
});

test('client validation rejects oversized file', () => {
  const bytes = new Uint8Array(10_485_761);
  assert.throws(
    () => validateCandidateCVFile(new File([bytes], 'large.pdf', { type: 'application/pdf' })),
    (error: any) => error instanceof CVParserClientError && error.code === 'FILE_TOO_LARGE',
  );
});

const parserPayload = {
  pipeline_result: {
    raw_text: 'private raw text',
    cleaned_text: 'private cleaned text',
    pages: [{ native_text: 'private page text' }],
    pipeline_steps: [{ name: 'private timing' }],
    total_pages: 1,
    extraction_method: 'native_pdf',
  },
  cv_data: {
    identity: { full_name: 'Synthetic Candidate', email: null, phone: null, linkedin: null, github: null, website: null, location: null, job_title: 'Engineer', other_links: [] },
    summary: null,
    skills: [{ name: 'TypeScript', category: null, source: null }],
    languages: [], certifications: [], education: [], experiences: [],
    warnings: ['Some information could not be detected.'],
  },
  llm_used: false,
  llm_available: false,
};

class MemoryCVRepository implements CVRepository {
  records: CanonicalPersistedCV[] = [];
  saveCalls = 0;
  failSave = false;

  async findEquivalentCV(uid: string, sha256: string, parserVersion: string, schemaVersion: number) {
    return this.records.find((record) => record.uid === uid
      && record.file.sha256 === sha256
      && record.parsing.parserVersion === parserVersion
      && record.parsing.schemaVersion === schemaVersion) ?? null;
  }

  async saveCurrentCV(input: NewCanonicalCV) {
    this.saveCalls += 1;
    if (this.failSave) throw new Error('transaction failed');
    const duplicate = await this.findEquivalentCV(input.uid, input.file.sha256, input.parsing.parserVersion, input.parsing.schemaVersion);
    if (duplicate) return duplicate;
    this.records = this.records.map((record) => record.uid === input.uid && record.isCurrent
      ? { ...record, isCurrent: false }
      : record);
    const now = new Date().toISOString();
    const record: CanonicalPersistedCV = {
      id: `canonical-${this.records.length + 1}`,
      uid: input.uid,
      status: 'PROCESSED',
      isCurrent: true,
      parsedData: input.parsedData,
      file: input.file,
      parsing: input.parsing,
      createdAt: now,
      updatedAt: now,
    };
    this.records.push(record);
    return record;
  }

  async getCurrentCVByUid(uid: string) {
    return this.records.find((record) => record.uid === uid && record.isCurrent) ?? null;
  }

  async getCVHistoryByUid(uid: string) {
    return this.records.filter((record) => record.uid === uid);
  }

  async getCurrentCanonicalCVs() {
    return this.records.filter((record) => record.isCurrent);
  }
}

async function runParseHandler(
  repository: MemoryCVRepository,
  payload: unknown = parserPayload,
  uid = 'candidate-test',
  bytes = pdf,
  upstreamStatus = 200,
) {
  const request = await multipartRequest([['file', new Blob([bytes], { type: 'application/pdf' }), 'cv.pdf']]);
  request.candidate = { uid, role: 'CANDIDATE' };
  const { record, response } = responseRecorder();
  let upstreamCalls = 0;
  const fetchMock = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify(payload), { status: upstreamStatus, headers: { 'content-type': 'application/json' } });
  };
  await createCVParseHandler(fetchMock as typeof fetch, () => repository)(request, response, () => undefined);
  return { record, upstreamCalls };
}

async function runCurrentHandler(repository: MemoryCVRepository, uid?: string) {
  const request = { candidate: uid ? { uid, role: 'CANDIDATE' as const } : undefined } as any;
  const { record, response } = responseRecorder();
  await createCurrentCVHandler(() => repository)(request, response, () => undefined);
  return record;
}

test('authenticated Candidate retrieves only their own current canonical CV', async () => {
  const repository = new MemoryCVRepository();
  await runParseHandler(repository, parserPayload, 'candidate-a');
  await runParseHandler(repository, parserPayload, 'candidate-b');
  const result = await runCurrentHandler(repository, 'candidate-a');
  assert.equal((result.body as any).id, repository.records[0].id);
  assert.equal((result.body as any).cv.identity.full_name, 'Synthetic Candidate');
  assert.equal((result.body as any).isCurrent, true);
});

test('current CV lookup derives uid from authenticated principal', async () => {
  const repository = new MemoryCVRepository();
  let queriedUid = '';
  repository.getCurrentCVByUid = async (uid: string) => { queriedUid = uid; return null; };
  await runCurrentHandler(repository, 'verified-candidate');
  assert.equal(queriedUid, 'verified-candidate');
});

test('missing current canonical CV returns controlled CV_NOT_FOUND', async () => {
  const result = await runCurrentHandler(new MemoryCVRepository(), 'candidate-test');
  assert.equal(result.status, 404);
  assert.equal((result.body as any).error.code, 'CV_NOT_FOUND');
});

test('current CV handler rejects a request without attached Candidate principal', async () => {
  const result = await runCurrentHandler(new MemoryCVRepository());
  assert.equal(result.status, 401);
  assert.equal((result.body as any).error.code, 'AUTH_REQUIRED');
});

test('current CV response excludes ownership, file metadata, and parser internals', async () => {
  const repository = new MemoryCVRepository();
  await runParseHandler(repository, parserPayload, 'candidate-test');
  const result = await runCurrentHandler(repository, 'candidate-test');
  const serialized = JSON.stringify(result.body);
  for (const forbidden of ['uid', 'sha256', 'originalName', 'parserVersion', 'schemaVersion', 'raw_text', 'cleaned_text', 'pages']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('safe DTO maps parser success and excludes diagnostics', () => {
  const safe = toSafeCVResponse(parserPayload);
  assert.equal(safe.cv.identity.full_name, 'Synthetic Candidate');
  assert.equal(safe.metadata.pageCount, 1);
  assert.equal(safe.metadata.mode, 'deterministic');
  const serialized = JSON.stringify(safe);
  for (const forbidden of ['raw_text', 'cleaned_text', 'pages', 'pipeline_steps', 'llm_available']) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.equal(safe.warnings[0].message.includes('private'), false);
});

test('invalid parser success response is sanitized', () => {
  assert.throws(
    () => toSafeCVResponse({ pipeline_result: {}, cv_data: null }),
    (error: any) => error.code === 'CV_PARSER_INVALID_RESPONSE' && !error.message.includes('null'),
  );
});

for (const [status, code, expected] of [
  [400, 'INVALID_PDF', 400],
  [413, 'FILE_TOO_LARGE', 413],
  [415, 'UNSUPPORTED_FILE_TYPE', 415],
  [422, 'IMAGE_ONLY_PDF', 422],
] as const) {
  test(`maps FastAPI ${code}`, () => {
    const error = parserErrorFromResponse(status, { code, detail: 'must not be returned' });
    assert.equal(error.status, expected);
    assert.equal(error.safeMessage.includes('must not be returned'), false);
  });
}

test('FastAPI client maps timeout', async () => {
  const fetchMock = (_input: any, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  await assert.rejects(
    parseCVWithFastAPI({ bytes: Buffer.from(pdf), filename: 'cv.pdf', contentType: 'application/pdf' }, { apiUrl: 'http://parser', timeoutMs: 1, maxUploadBytes: 1024 }, fetchMock as typeof fetch),
    (error: any) => error.code === 'CV_PARSER_TIMEOUT' && error.status === 504,
  );
});

test('FastAPI client maps unavailable service', async () => {
  const fetchMock = async () => { throw new TypeError('network details'); };
  await assert.rejects(
    parseCVWithFastAPI({ bytes: Buffer.from(pdf), filename: 'cv.pdf', contentType: 'application/pdf' }, { apiUrl: 'http://parser', timeoutMs: 100, maxUploadBytes: 1024 }, fetchMock as typeof fetch),
    (error: any) => error.code === 'CV_PARSER_UNAVAILABLE' && error.status === 503 && !error.message.includes('network details'),
  );
});

test('FastAPI client identifies a wrong upstream service returning route 404', async () => {
  const fetchMock = async () => new Response(
    JSON.stringify({ detail: 'Not Found' }),
    { status: 404, headers: { 'content-type': 'application/json' } },
  );
  await assert.rejects(
    parseCVWithFastAPI(
      { bytes: Buffer.from(pdf), filename: 'cv.pdf', contentType: 'application/pdf' },
      { apiUrl: 'http://matching-engine', timeoutMs: 100, maxUploadBytes: 1024 },
      fetchMock as typeof fetch,
    ),
    (error: any) => error.code === 'CV_PARSER_ENDPOINT_NOT_FOUND'
      && error.status === 502
      && !error.message.includes('PDF'),
  );
});

test('FastAPI client maps successful response', async () => {
  const fetchMock = async (_input: any, init?: RequestInit) => {
    assert.ok(init?.body instanceof FormData);
    assert.equal((init.body as FormData).getAll('file').length, 1);
    return new Response(JSON.stringify(parserPayload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await parseCVWithFastAPI(
    { bytes: Buffer.from(pdf), filename: 'cv.pdf', contentType: 'application/pdf' },
    { apiUrl: 'http://parser', timeoutMs: 100, maxUploadBytes: 1024 },
    fetchMock as typeof fetch,
  );
  assert.equal(result.status, 'success');
});

test('Express CV handler parses multipart, forwards to the configured parser route, and returns the safe DTO', async () => {
  const request = await multipartRequest([['file', new Blob([pdf], { type: 'application/pdf' }), 'cv.pdf']]);
  request.candidate = { uid: 'candidate-test', role: 'CANDIDATE' };
  const { record, response } = responseRecorder();
  let upstreamUrl = '';
  const fetchMock = async (input: string | URL | Request, init?: RequestInit) => {
    upstreamUrl = String(input);
    assert.equal(init?.method, 'POST');
    assert.ok(init?.body instanceof FormData);
    assert.equal((init.body as FormData).getAll('file').length, 1);
    assert.equal((init.headers as Record<string, string> | undefined)?.['content-type'], undefined);
    return new Response(JSON.stringify(parserPayload), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const repository = new MemoryCVRepository();
  await createCVParseHandler(fetchMock as typeof fetch, () => repository)(request, response, () => undefined);

  assert.equal(upstreamUrl, 'http://127.0.0.1:8001/api/v1/cv/parse');
  assert.equal((record.body as any).status, 'success');
  assert.equal((record.body as any).cv.identity.full_name, 'Synthetic Candidate');
  assert.equal((record.body as any).id, 'canonical-1');
  assert.equal(JSON.stringify(record.body).includes('raw_text'), false);
});

test('successful parse persists canonical data under authenticated uid only', async () => {
  const repository = new MemoryCVRepository();
  const result = await runParseHandler(repository, parserPayload, 'verified-candidate');
  assert.equal(result.record.status, undefined);
  assert.equal(repository.records.length, 1);
  assert.equal(repository.records[0].uid, 'verified-candidate');
  assert.deepEqual(repository.records[0].parsedData, (result.record.body as any).cv);
  assert.equal(repository.records[0].parsing.schemaVersion, CV_SCHEMA_VERSION);
  assert.equal(repository.records[0].parsing.parserVersion, CV_PARSER_VERSION);
});

test('parser failure and invalid PDF do not write canonical records', async () => {
  const repository = new MemoryCVRepository();
  const parserFailure = await runParseHandler(repository, { code: 'INVALID_PDF' }, 'candidate-test', pdf, 400);
  assert.equal(parserFailure.record.status, 400);
  assert.equal(repository.saveCalls, 0);

  const request = await multipartRequest([['file', new Blob(['not-pdf'], { type: 'application/pdf' }), 'cv.pdf']]);
  request.candidate = { uid: 'candidate-test', role: 'CANDIDATE' };
  const { record, response } = responseRecorder();
  await createCVParseHandler(fetch as typeof fetch, () => repository)(request, response, () => undefined);
  assert.equal(record.status, 400);
  assert.equal(repository.saveCalls, 0);
});

test('partial but meaningful parser result is persisted', async () => {
  const repository = new MemoryCVRepository();
  const partial = structuredClone(parserPayload);
  partial.cv_data.identity = { full_name: null, email: null, phone: null, linkedin: null, github: null, website: null, location: null, job_title: null, other_links: [] };
  partial.cv_data.skills = [{ name: 'TypeScript', category: null, source: null }];
  const result = await runParseHandler(repository, partial);
  assert.equal((result.record.body as any).status, 'success');
  assert.equal(repository.records.length, 1);
});

test('equivalent upload is returned without parser call or duplicate write', async () => {
  const repository = new MemoryCVRepository();
  await runParseHandler(repository);
  const duplicate = await runParseHandler(repository);
  assert.equal(duplicate.upstreamCalls, 0);
  assert.equal(repository.records.length, 1);
  assert.equal((duplicate.record.body as any).id, repository.records[0].id);
});

test('same PDF for different candidates creates separate canonical records', async () => {
  const repository = new MemoryCVRepository();
  await runParseHandler(repository, parserPayload, 'candidate-a');
  await runParseHandler(repository, parserPayload, 'candidate-b');
  assert.equal(repository.records.length, 2);
  assert.deepEqual(repository.records.map((record) => record.uid), ['candidate-a', 'candidate-b']);
});

test('new CV preserves history and switches the current record', async () => {
  const repository = new MemoryCVRepository();
  await runParseHandler(repository);
  const secondPDF = new Uint8Array(Buffer.from('%PDF-1.4\nsecond synthetic document'));
  await runParseHandler(repository, parserPayload, 'candidate-test', secondPDF);
  assert.equal(repository.records.length, 2);
  assert.equal(repository.records[0].isCurrent, false);
  assert.equal(repository.records[1].isCurrent, true);
});

test('transaction failure leaves the previous current record unchanged', async () => {
  const repository = new MemoryCVRepository();
  await runParseHandler(repository);
  repository.failSave = true;
  const secondPDF = new Uint8Array(Buffer.from('%PDF-1.4\nfailed transaction document'));
  const result = await runParseHandler(repository, parserPayload, 'candidate-test', secondPDF);
  assert.equal(result.record.status, 503);
  assert.equal(repository.records.length, 1);
  assert.equal(repository.records[0].isCurrent, true);
});

test('canonical persistence excludes PDF bytes and internal parser diagnostics', async () => {
  const repository = new MemoryCVRepository();
  const result = await runParseHandler(repository);
  const persisted = JSON.stringify(repository.records[0]);
  const returned = JSON.stringify(result.record.body);
  for (const forbidden of ['raw_text', 'cleaned_text', 'pipeline_steps', 'private page text', '%PDF-']) {
    assert.equal(persisted.includes(forbidden), false);
    assert.equal(returned.includes(forbidden), false);
  }
  assert.equal('aiScore' in repository.records[0], false);
  assert.equal('feedback' in repository.records[0], false);
});

test('legacy records are not returned by canonical repository queries', async () => {
  const repository = new MemoryCVRepository();
  await runParseHandler(repository);
  const canonical = await repository.getCurrentCanonicalCVs();
  assert.equal(canonical.length, 1);
  assert.ok(canonical.every((record) => record.parsedData && record.parsing.schemaVersion === 1));
});
