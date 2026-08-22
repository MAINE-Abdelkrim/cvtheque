import { auth } from '../firebase/client';
import { geminiJobDraftSchema, type CanonicalJob, type CanonicalJobInput, type GeminiJobDraft } from '../../types/job';

export class JobClientError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

async function token(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new JobClientError('AUTH_REQUIRED', 'Please sign in with your recruiter account.', 401);
  return user.getIdToken();
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const idToken = await token();
  return fetch(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${idToken}` } });
}

export async function jobPayloadOrError<T>(response: Response): Promise<T> {
  const payload: any = await response.json().catch(() => null);
  if (!response.ok) {
    const structured = typeof payload?.error === 'object' ? payload.error : null;
    throw new JobClientError(structured?.code ?? 'JOB_REQUEST_FAILED', structured?.message ?? 'The job request failed.', response.status);
  }
  return payload as T;
}

export async function createCanonicalJob(input: CanonicalJobInput): Promise<CanonicalJob> {
  return jobPayloadOrError(await request('/api/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }));
}

export async function getMyCanonicalJobs(): Promise<CanonicalJob[]> {
  const result = await jobPayloadOrError<{ jobs: CanonicalJob[] }>(await request('/api/jobs/mine', { method: 'GET' }));
  return result.jobs;
}

export async function deleteCanonicalJob(jobId: string): Promise<void> {
  const response = await request(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
  if (!response.ok) await jobPayloadOrError(response);
}

export async function generateJobDraft(prompt: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const result = await jobPayloadOrError<{ reply: string; extractedJson: unknown; extractedJsonError?: boolean }>(await request('/api/jobs/ai-generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, conversationHistory }),
  }));
  if (result.extractedJson === null) return { reply: result.reply, draft: null, invalidDraft: result.extractedJsonError === true };
  const parsed = geminiJobDraftSchema.safeParse(result.extractedJson);
  return { reply: result.reply, draft: parsed.success ? parsed.data : null, invalidDraft: !parsed.success } as { reply: string; draft: GeminiJobDraft | null; invalidDraft: boolean };
}
