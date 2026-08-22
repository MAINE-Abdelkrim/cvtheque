import type { CVParserSafeResponse } from '../types/cv-parser';
import type { CVParserServerConfig } from './config';
import { CVRouteError, parserErrorFromResponse } from './cv-errors';
import { toSafeCVResponse } from './cv-mapper';
import type { ValidatedPDFUpload } from './cv-upload';

export async function parseCVWithFastAPI(
  upload: ValidatedPDFUpload,
  config: CVParserServerConfig,
  fetchImplementation: typeof fetch = fetch,
): Promise<CVParserSafeResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const formData = new FormData();
    formData.append('file', new Blob([Uint8Array.from(upload.bytes)], { type: upload.contentType }), upload.filename);

    console.info('[CV Parse] calling FastAPI');
    const response = await fetchImplementation(`${config.apiUrl}/api/v1/cv/parse`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    console.info(`[CV Parse] FastAPI status: ${response.status}`);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) throw parserErrorFromResponse(response.status, payload);
    return toSafeCVResponse(payload);
  } catch (error) {
    if (error instanceof CVRouteError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new CVRouteError(504, 'CV_PARSER_TIMEOUT', 'CV analysis took too long. Please try again.');
    }
    throw new CVRouteError(503, 'CV_PARSER_UNAVAILABLE', 'The CV analysis service is temporarily unavailable.');
  } finally {
    clearTimeout(timeout);
  }
}
