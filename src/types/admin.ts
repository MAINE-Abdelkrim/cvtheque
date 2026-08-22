import { z } from 'zod';

const text = z.string().trim().min(1).max(200);
const email = z.string().trim().email().max(320);

export const publicRegistrationSchema = z.object({
  firstName: text,
  lastName: text,
  email,
  password: z.string().min(6).max(128),
  role: z.enum(['CANDIDATE', 'RECRUITER']).default('CANDIDATE'),
}).strict();

export const adminUserCreateSchema = z.object({
  firstName: text,
  lastName: text,
  email,
  password: z.string().min(6).max(128),
  role: z.enum(['CANDIDATE', 'RECRUITER', 'ADMIN']),
  subscription: z.enum(['FREE', 'PREMIUM']),
  isActive: z.boolean(),
}).strict();

export const adminUserUpdateSchema = adminUserCreateSchema.omit({ password: true }).partial().strict().refine(value => Object.keys(value).length > 0, 'At least one supported field is required.');

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
