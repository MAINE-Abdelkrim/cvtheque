import { geminiJobDraftSchema, type GeminiJobDraft } from '../types/job';

export function extractValidatedGeminiDraft(responseText: string): { draft: GeminiJobDraft | null; invalid: boolean } {
  const match = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match?.[1]) return { draft: null, invalid: false };
  try {
    const parsed = geminiJobDraftSchema.safeParse(JSON.parse(match[1]));
    if (!parsed.success) return { draft: null, invalid: true };
    const { job_id: _jobId, scoring_weights: _weights, ...draft } = parsed.data;
    return { draft, invalid: false };
  } catch {
    return { draft: null, invalid: true };
  }
}
