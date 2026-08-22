import type { Response } from 'express';
import type { CVParserServerError } from '../types/cv-parser';

export class CVRouteError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly safeMessage: string,
    public readonly details: string[] = [],
  ) {
    super(safeMessage);
  }
}

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  INVALID_PDF: { status: 400, message: 'The uploaded file is not a valid PDF.' },
  FILE_TOO_LARGE: { status: 413, message: 'The PDF exceeds the allowed size.' },
  PDF_PAGE_LIMIT_EXCEEDED: { status: 413, message: 'The PDF contains more than 20 pages.' },
  UNSUPPORTED_FILE_TYPE: { status: 415, message: 'Only PDF files are accepted.' },
  IMAGE_ONLY_PDF: {
    status: 422,
    message: 'This PDF does not contain selectable text. Please upload a professionally generated text-based PDF.',
  },
};

export function parserErrorFromResponse(status: number, payload: unknown): CVRouteError {
  const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : '';
  const mapped = ERROR_MESSAGES[code];
  if (mapped) return new CVRouteError(mapped.status, code, mapped.message);

  if (status === 404) {
    return new CVRouteError(
      502,
      'CV_PARSER_ENDPOINT_NOT_FOUND',
      'The CV analysis service is misconfigured. Please contact support.',
    );
  }

  if (status >= 400 && status < 500) {
    return new CVRouteError(status, 'CV_PARSER_REJECTED', 'The CV could not be analyzed. Please verify the PDF and try again.');
  }
  return new CVRouteError(500, 'INTERNAL_ERROR', 'An unexpected error occurred while analyzing the CV.');
}

export function sendCVError(response: Response, error: CVRouteError): Response<CVParserServerError> {
  return response.status(error.status).json({
    error: {
      code: error.code,
      message: error.safeMessage,
      details: error.details,
    },
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
