import type { Request } from 'express';
import { CVRouteError } from './cv-errors';

const MULTIPART_OVERHEAD_ALLOWANCE = 64 * 1024;

async function readLimitedBody(request: Request, maximumBytes: number): Promise<Buffer> {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new CVRouteError(413, 'FILE_TOO_LARGE', 'The PDF exceeds the allowed size.');
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.on('data', (chunk: Buffer | string) => {
      if (settled) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.length;
      if (total > maximumBytes) {
        fail(new CVRouteError(413, 'FILE_TOO_LARGE', 'The PDF exceeds the allowed size.'));
        request.resume();
        return;
      }
      chunks.push(bytes);
    });
    request.once('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, total));
    });
    request.once('aborted', () => fail(new CVRouteError(400, 'UPLOAD_ABORTED', 'The upload was interrupted.')));
    request.once('error', () => fail(new CVRouteError(400, 'UPLOAD_FAILED', 'The upload could not be read.')));
  });
}

export interface ValidatedPDFUpload {
  bytes: Buffer;
  filename: string;
  contentType: 'application/pdf';
}

export async function parsePDFUpload(request: Request, maxFileBytes: number): Promise<ValidatedPDFUpload> {
  const contentType = request.headers['content-type'];
  if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new CVRouteError(415, 'UNSUPPORTED_FILE_TYPE', 'Only PDF files are accepted.');
  }

  const body = await readLimitedBody(request, maxFileBytes + MULTIPART_OVERHEAD_ALLOWANCE);
  let formData: FormData;
  try {
    const webRequest = new globalThis.Request('http://local.invalid/api/cv/parse', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: body as unknown as BodyInit,
    });
    formData = await webRequest.formData();
  } catch {
    throw new CVRouteError(400, 'INVALID_MULTIPART', 'The upload form is invalid.');
  }

  const entries = [...formData.entries()];
  const fileEntries = entries.filter(([, value]) => typeof value !== 'string');
  const namedFiles = fileEntries.filter(([name]) => name === 'file');

  if (namedFiles.length === 0) {
    throw new CVRouteError(400, 'FILE_REQUIRED', 'A PDF file is required.');
  }
  if (fileEntries.length !== 1 || namedFiles.length !== 1) {
    throw new CVRouteError(400, 'MULTIPLE_FILES', 'Upload exactly one PDF file.');
  }

  const file = namedFiles[0][1] as File;
  if (file.type.toLowerCase() !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    throw new CVRouteError(415, 'UNSUPPORTED_FILE_TYPE', 'Only PDF files are accepted.');
  }
  if (file.size === 0) {
    throw new CVRouteError(400, 'INVALID_PDF', 'The uploaded file is not a valid PDF.');
  }
  if (file.size > maxFileBytes) {
    throw new CVRouteError(413, 'FILE_TOO_LARGE', 'The PDF exceeds the allowed size.');
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const firstNonWhitespace = bytes.findIndex((byte) => ![9, 10, 11, 12, 13, 32].includes(byte));
  const signature = firstNonWhitespace >= 0 ? bytes.subarray(firstNonWhitespace, firstNonWhitespace + 5).toString('ascii') : '';
  if (signature !== '%PDF-') {
    throw new CVRouteError(400, 'INVALID_PDF', 'The uploaded file is not a valid PDF.');
  }

  return { bytes, filename: file.name, contentType: 'application/pdf' };
}

