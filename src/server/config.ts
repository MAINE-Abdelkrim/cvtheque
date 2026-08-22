const DEFAULT_CV_PARSER_API_URL = 'http://127.0.0.1:8001';
const DEFAULT_CV_PARSER_TIMEOUT_MS = 60_000;
const DEFAULT_CV_UPLOAD_MAX_BYTES = 10_485_760;
const DEFAULT_INTERVIEW_ENGINE_TIMEOUT_MS = 30_000;

function positiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export interface CVParserServerConfig {
  apiUrl: string;
  timeoutMs: number;
  maxUploadBytes: number;
}

export function getCVParserServerConfig(): CVParserServerConfig {
  const configuredUrl = process.env.CV_PARSER_API_URL?.trim();
  let apiUrl = configuredUrl || DEFAULT_CV_PARSER_API_URL;

  try {
    const url = new URL(apiUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    apiUrl = url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('CV_PARSER_API_URL must be a valid HTTP(S) URL.');
  }

  return {
    apiUrl,
    timeoutMs: positiveInteger('CV_PARSER_TIMEOUT_MS', process.env.CV_PARSER_TIMEOUT_MS, DEFAULT_CV_PARSER_TIMEOUT_MS),
    maxUploadBytes: positiveInteger('CV_UPLOAD_MAX_BYTES', process.env.CV_UPLOAD_MAX_BYTES, DEFAULT_CV_UPLOAD_MAX_BYTES),
  };
}

export interface InterviewEngineServerConfig {
  baseUrl: string;
  apiToken: string;
  timeoutMs: number;
}

export function getInterviewEngineServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): InterviewEngineServerConfig {
  const configuredUrl = environment.INTERVIEW_ENGINE_BASE_URL?.trim();
  const apiToken = environment.INTERVIEW_ENGINE_API_TOKEN?.trim();
  if (!configuredUrl || !apiToken) {
    throw new Error('Interview Engine server configuration is incomplete.');
  }

  let baseUrl: string;
  try {
    const url = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    baseUrl = url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('INTERVIEW_ENGINE_BASE_URL must be a valid HTTP(S) URL.');
  }

  return {
    baseUrl,
    apiToken,
    timeoutMs: positiveInteger(
      'INTERVIEW_ENGINE_TIMEOUT_MS',
      environment.INTERVIEW_ENGINE_TIMEOUT_MS,
      DEFAULT_INTERVIEW_ENGINE_TIMEOUT_MS,
    ),
  };
}
