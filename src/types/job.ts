import { z } from 'zod';

const trimmed = z.string().trim();
const requiredText = trimmed.min(1).max(10_000);
const stringArray = z.array(trimmed.min(1).max(200)).max(100).default([])
  .transform((items) => [...new Set(items)]);

export const educationRequirementSchema = z.object({
  minimum_level: trimmed.max(200).default(''),
  preferred_fields: stringArray,
  mandatory: z.boolean().default(false),
}).strict();

export const languageRequirementSchema = z.object({
  name: trimmed.min(1).max(100),
  minimum_level: z.enum(['beginner', 'intermediate', 'fluent', 'native']),
  mandatory: z.boolean(),
}).strict();

export const canonicalJobInputSchema = z.object({
  title: requiredText.max(200),
  company: requiredText.max(200),
  location: requiredText.max(300),
  description: requiredText,
  required_skills: stringArray,
  preferred_skills: stringArray,
  minimum_experience_years: z.number().int().min(0).max(80).default(0),
  maximum_experience_years: z.number().int().min(0).max(80).nullable().default(null),
  required_education: educationRequirementSchema.default({ minimum_level: '', preferred_fields: [], mandatory: false }),
  required_languages: z.array(languageRequirementSchema).max(50).default([]),
  remote_allowed: z.boolean().default(false),
  work_mode: z.enum(['onsite', 'hybrid', 'remote']).nullable().default(null),
  contract_type: z.enum(['CDI', 'CDD', 'Freelance', 'Stage', 'Alternance']).nullable().default(null),
  mandatory_requirements: stringArray,
}).strict().superRefine((job, context) => {
  if (job.maximum_experience_years !== null && job.maximum_experience_years < job.minimum_experience_years) {
    context.addIssue({ code: 'custom', path: ['maximum_experience_years'], message: 'Maximum experience must be greater than or equal to minimum experience.' });
  }
});

export const geminiJobDraftSchema = z.object({
  job_id: z.string().optional(),
  job_title: trimmed.min(1).max(200).optional(),
  company: trimmed.min(1).max(200).optional(),
  location: trimmed.min(1).max(300).optional(),
  description: trimmed.min(1).max(10_000).optional(),
  required_skills: stringArray.optional(),
  preferred_skills: stringArray.optional(),
  minimum_experience_years: z.number().int().min(0).max(80).optional(),
  maximum_experience_years: z.number().int().min(0).max(80).nullable().optional(),
  required_education: educationRequirementSchema.optional(),
  required_languages: z.array(languageRequirementSchema).max(50).optional(),
  remote_allowed: z.boolean().optional(),
  work_mode: z.enum(['onsite', 'hybrid', 'remote']).optional(),
  contract_type: z.enum(['CDI', 'CDD', 'Freelance', 'Stage', 'Alternance']).optional(),
  mandatory_requirements: stringArray.optional(),
  scoring_weights: z.unknown().optional(),
}).strict().superRefine((job, context) => {
  if (job.minimum_experience_years !== undefined
    && job.maximum_experience_years != null
    && job.maximum_experience_years < job.minimum_experience_years) {
    context.addIssue({ code: 'custom', path: ['maximum_experience_years'], message: 'Invalid experience range.' });
  }
});

export type CanonicalJobInput = z.infer<typeof canonicalJobInputSchema>;
export type GeminiJobDraft = z.infer<typeof geminiJobDraftSchema>;

export interface CanonicalJob extends CanonicalJobInput {
  id: string;
  recruiterId: string;
  status: 'OPEN' | 'CLOSED';
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
}
