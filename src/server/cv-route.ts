import { createHash, randomUUID } from 'crypto';
import type { RequestHandler } from 'express';
import type { CanonicalPersistedCV, CVParserSafeResponse, CVStructuredData } from '../types/cv-parser';
import { getCVParserServerConfig } from './config';
import { CVRouteError, sendCVError } from './cv-errors';
import { parseCVWithFastAPI } from './cv-parser-client';
import { createCVRepository, CV_PARSER_VERSION, CV_SCHEMA_VERSION, type CVRepository } from './cv-repository';
import { parsePDFUpload } from './cv-upload';
import type { CandidateRequest } from './cv-auth';

function hasMeaningfulContent(cv: CVStructuredData): boolean {
  const identityValues = Object.values(cv.identity);
  return identityValues.some((value) => typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) && value.length > 0)
    || Boolean(cv.summary?.trim())
    || cv.skills.length > 0
    || cv.experiences.length > 0
    || cv.education.length > 0
    || cv.languages.length > 0
    || cv.certifications.length > 0;
}

export function toPublicCVResponse(record: CanonicalPersistedCV): CVParserSafeResponse {
  return {
    id: record.id,
    isCurrent: record.isCurrent,
    createdAt: record.createdAt,
    status: 'success',
    cv: record.parsedData,
    warnings: record.parsing.warnings,
    metadata: {
      pageCount: record.parsing.pageCount,
      extractionMethod: record.parsing.extractionMethod,
      mode: record.parsing.mode,
    },
  };
}

export function createCurrentCVHandler(
  repositoryFactory: () => CVRepository = createCVRepository,
): RequestHandler {
  return async (request: CandidateRequest, response) => {
    if (!request.candidate) return sendCVError(response, new CVRouteError(401, 'AUTH_REQUIRED', 'Authentication is required.'));
    try {
      const record = await repositoryFactory().getCurrentCVByUid(request.candidate.uid);
      if (!record) return sendCVError(response, new CVRouteError(404, 'CV_NOT_FOUND', 'No current CV is available.'));
      return response.json(toPublicCVResponse(record));
    } catch (error) {
      if (error instanceof CVRouteError) return sendCVError(response, error);
      return sendCVError(response, new CVRouteError(503, 'CV_PERSISTENCE_UNAVAILABLE', 'CV storage is temporarily unavailable.'));
    }
  };
}

export function createCVParseHandler(
  fetchImplementation: typeof fetch = fetch,
  repositoryFactory: () => CVRepository = createCVRepository,
): RequestHandler {
  return async (request: CandidateRequest, response) => {
    console.info('[CV Parse] request received');
    const requestId = randomUUID();
    const startedAt = Date.now();
    const declaredLength = Number(request.headers['content-length']);
    let fileSize = Number.isFinite(declaredLength) && declaredLength >= 0 ? declaredLength : 0;

    try {
      if (!request.candidate) {
        throw new CVRouteError(401, 'AUTH_REQUIRED', 'Authentication is required.');
      }
      const config = getCVParserServerConfig();
      const upload = await parsePDFUpload(request, config.maxUploadBytes);
      fileSize = upload.bytes.length;
      console.info('[CV Parse] PDF validation passed');
      const sha256 = createHash('sha256').update(upload.bytes).digest('hex');
      let repository: CVRepository;
      try {
        repository = repositoryFactory();
        const equivalent = await repository.findEquivalentCV(
          request.candidate.uid,
          sha256,
          CV_PARSER_VERSION,
          CV_SCHEMA_VERSION,
        );
        if (equivalent) {
          response.json(toPublicCVResponse(equivalent));
          console.info('[CV Parse] equivalent canonical CV returned');
          return;
        }
      } catch {
        throw new CVRouteError(503, 'CV_PERSISTENCE_UNAVAILABLE', 'CV storage is temporarily unavailable.');
      }

      const safeResponse = await parseCVWithFastAPI(upload, config, fetchImplementation);
      console.info('[CV Parse] parser response mapped');
      if (!hasMeaningfulContent(safeResponse.cv)) {
        throw new CVRouteError(422, 'CV_CONTENT_INSUFFICIENT', 'The CV did not contain enough usable information to save.');
      }

      let persisted: CanonicalPersistedCV;
      try {
        persisted = await repository.saveCurrentCV({
          uid: request.candidate.uid,
          parsedData: safeResponse.cv,
          file: {
            originalName: upload.filename,
            mimeType: upload.contentType,
            sizeBytes: upload.bytes.length,
            sha256,
          },
          parsing: {
            schemaVersion: CV_SCHEMA_VERSION,
            parserVersion: CV_PARSER_VERSION,
            mode: safeResponse.metadata.mode,
            pageCount: safeResponse.metadata.pageCount,
            extractionMethod: safeResponse.metadata.extractionMethod,
            warnings: safeResponse.warnings,
          },
        });
      } catch {
        throw new CVRouteError(503, 'CV_PERSISTENCE_FAILED', 'The CV was analyzed but could not be saved. Please try again.');
      }

      response.json(toPublicCVResponse(persisted));
      console.info('[CV Parse] canonical CV saved', {
        parserVersion: CV_PARSER_VERSION,
        schemaVersion: CV_SCHEMA_VERSION,
        durationMs: Date.now() - startedAt,
      });
      return;
    } catch (error) {
      const safeError = error instanceof CVRouteError
        ? error
        : new CVRouteError(500, 'INTERNAL_ERROR', 'An unexpected error occurred while analyzing the CV.');

      console.warn('[CV Parse]', {
        requestId,
        errorCode: safeError.code,
        httpStatus: safeError.status,
        durationMs: Date.now() - startedAt,
        fileSize,
      });
      sendCVError(response, safeError);
      return;
    }
  };
}
