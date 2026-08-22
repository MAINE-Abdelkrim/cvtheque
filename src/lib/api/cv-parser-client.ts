import { auth } from '../firebase/client';
import type { CVParserSafeResponse, CVParserServerError } from '../../types/cv-parser';

export class CVParserClientError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

export const CV_UPLOAD_MAX_BYTES = 10_485_760;

async function candidateToken(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new CVParserClientError('AUTH_REQUIRED', 'Please sign in with your candidate account.', 401);
  return user.getIdToken();
}

export async function getCurrentCandidateCV(): Promise<CVParserSafeResponse | null> {
  const token = await candidateToken();
  let response: Response;
  try {
    response = await fetch('/api/cv/current', { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new CVParserClientError('NETWORK_ERROR', 'The server could not be reached. Please try again.', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (response.status === 404 && isServerError(payload) && payload.error.code === 'CV_NOT_FOUND') return null;
  if (!response.ok) {
    if (isServerError(payload)) throw new CVParserClientError(payload.error.code, payload.error.message, response.status);
    throw new CVParserClientError('INTERNAL_ERROR', 'The current CV could not be loaded.', response.status);
  }
  return payload as CVParserSafeResponse;
}

export function validateCandidateCVFile(file: File): void {
  const isPdfName = file.name.toLowerCase().endsWith('.pdf');
  if (file.type !== 'application/pdf' || !isPdfName) {
    throw new CVParserClientError('UNSUPPORTED_FILE_TYPE', 'Only PDF files are accepted.', 415);
  }
  if (file.size === 0) {
    throw new CVParserClientError('INVALID_PDF', 'The selected PDF is empty.', 400);
  }
  if (file.size > CV_UPLOAD_MAX_BYTES) {
    throw new CVParserClientError('FILE_TOO_LARGE', 'The PDF exceeds the 10 MiB limit.', 413);
  }
}

function isServerError(value: unknown): value is CVParserServerError {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error?: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

export async function parseCandidateCV(file: File, signal?: AbortSignal): Promise<CVParserSafeResponse> {
  validateCandidateCVFile(file);
  const token = await candidateToken();
  const formData = new FormData();
  formData.append('file', file, file.name);

  let response: Response;
  try {
    response = await fetch('/api/cv/parse', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CVParserClientError('CANCELLED', 'CV analysis was cancelled.', 0);
    }
    throw new CVParserClientError('NETWORK_ERROR', 'The server could not be reached. Please try again.', 0);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isServerError(payload)) {
      throw new CVParserClientError(payload.error.code, payload.error.message, response.status);
    }
    throw new CVParserClientError('INTERNAL_ERROR', 'The CV could not be analyzed. Please try again.', response.status);
  }
  return payload as CVParserSafeResponse;
}
