import type { App } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../lib/firebase/admin';
import { canonicalJobInputSchema, type CanonicalJob, type CanonicalJobInput } from '../types/job';

export const JOB_SCHEMA_VERSION = 1 as const;

export interface JobRepository {
  createCanonicalJob(recruiterId: string, input: CanonicalJobInput): Promise<CanonicalJob>;
  getCanonicalJobById(jobId: string): Promise<CanonicalJob | null>;
  getJobsByRecruiter(recruiterId: string): Promise<CanonicalJob[]>;
  getOpenCanonicalJobs(): Promise<CanonicalJob[]>;
  deleteRecruiterJob(jobId: string, recruiterId: string): Promise<boolean>;
}

function toISO(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate(): Date }).toDate().toISOString();
  return typeof value === 'string' ? value : new Date(0).toISOString();
}

function mapJob(id: string, data: Record<string, unknown>): CanonicalJob | null {
  if (data.schemaVersion !== JOB_SCHEMA_VERSION || typeof data.recruiterId !== 'string') return null;
  if (data.status !== 'OPEN' && data.status !== 'CLOSED') return null;
  const content = canonicalJobInputSchema.safeParse({
    title: data.title,
    company: data.company,
    location: data.location,
    description: data.description,
    required_skills: data.required_skills,
    preferred_skills: data.preferred_skills,
    minimum_experience_years: data.minimum_experience_years,
    maximum_experience_years: data.maximum_experience_years,
    required_education: data.required_education,
    required_languages: data.required_languages,
    remote_allowed: data.remote_allowed,
    work_mode: data.work_mode,
    contract_type: data.contract_type,
    mandatory_requirements: data.mandatory_requirements,
  });
  if (!content.success) return null;
  return {
    id,
    recruiterId: data.recruiterId,
    ...content.data,
    status: data.status,
    schemaVersion: JOB_SCHEMA_VERSION,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

export function sortCanonicalJobsNewestFirst(jobs: CanonicalJob[]): CanonicalJob[] {
  return [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export class FirebaseAdminJobRepository implements JobRepository {
  constructor(private readonly app: App) {}
  private collection() { return getFirestore(this.app).collection('jobs'); }

  async createCanonicalJob(recruiterId: string, input: CanonicalJobInput) {
    const reference = this.collection().doc();
    await reference.create({
      recruiterId,
      ...input,
      status: 'OPEN',
      schemaVersion: JOB_SCHEMA_VERSION,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const snapshot = await reference.get();
    const mapped = mapJob(snapshot.id, snapshot.data() ?? {});
    if (!mapped) throw new Error('Created job could not be validated.');
    return mapped;
  }

  async getCanonicalJobById(jobId: string) {
    const snapshot = await this.collection().doc(jobId).get();
    return snapshot.exists ? mapJob(snapshot.id, snapshot.data() ?? {}) : null;
  }

  async getJobsByRecruiter(recruiterId: string) {
    // Owner-scoped reads must remain available even before optional composite
    // indexes are deployed. Canonical validation and ordering are applied after
    // the single-field owner query; legacy documents are still excluded.
    const snapshot = await this.collection()
      .where('recruiterId', '==', recruiterId)
      .get();
    return sortCanonicalJobsNewestFirst(snapshot.docs.flatMap((document) => {
      const mapped = mapJob(document.id, document.data());
      return mapped ? [mapped] : [];
    }));
  }

  async getOpenCanonicalJobs() {
    const snapshot = await this.collection()
      .where('status', '==', 'OPEN')
      .where('schemaVersion', '==', JOB_SCHEMA_VERSION)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.flatMap((document) => {
      const mapped = mapJob(document.id, document.data());
      return mapped ? [mapped] : [];
    });
  }

  async deleteRecruiterJob(jobId: string, recruiterId: string) {
    const db = getFirestore(this.app);
    const reference = this.collection().doc(jobId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;
      const job = mapJob(snapshot.id, snapshot.data() ?? {});
      if (!job || job.recruiterId !== recruiterId) return false;
      transaction.delete(reference);
      return true;
    });
  }
}

export function createJobRepository(): JobRepository {
  const app = getFirebaseAdmin();
  if (!app) throw new Error('Firebase Admin is unavailable.');
  return new FirebaseAdminJobRepository(app);
}
