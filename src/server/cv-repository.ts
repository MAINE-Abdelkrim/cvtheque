import type { App } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../lib/firebase/admin';
import type { CanonicalPersistedCV, NewCanonicalCV } from '../types/cv-parser';

export const CV_SCHEMA_VERSION = 1;
export const CV_PARSER_VERSION = process.env.CV_PARSER_VERSION?.trim() || 'local-unversioned';
const MAX_CANONICAL_DATA_BYTES = 750 * 1024;

export interface CVRepository {
  findEquivalentCV(uid: string, sha256: string, parserVersion: string, schemaVersion: number): Promise<CanonicalPersistedCV | null>;
  saveCurrentCV(input: NewCanonicalCV): Promise<CanonicalPersistedCV>;
  getCurrentCVByUid(uid: string): Promise<CanonicalPersistedCV | null>;
  getCVHistoryByUid(uid: string): Promise<CanonicalPersistedCV[]>;
  getCurrentCanonicalCVs(): Promise<CanonicalPersistedCV[]>;
}

export function sortCanonicalCVsNewestFirst(records: CanonicalPersistedCV[]): CanonicalPersistedCV[] {
  return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function timestampToISO(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return typeof value === 'string' ? value : new Date(0).toISOString();
}

function isCanonical(data: Record<string, unknown>): boolean {
  const parsing = data.parsing as Record<string, unknown> | undefined;
  return data.status === 'PROCESSED'
    && typeof data.uid === 'string'
    && typeof data.parsedData === 'object'
    && data.parsedData !== null
    && typeof parsing?.schemaVersion === 'number';
}

function mapDocument(id: string, data: Record<string, unknown>): CanonicalPersistedCV | null {
  if (!isCanonical(data)) return null;
  return {
    ...(data as unknown as Omit<CanonicalPersistedCV, 'id' | 'createdAt' | 'updatedAt'>),
    id,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt),
  };
}

export function assertCanonicalCVSize(input: NewCanonicalCV): void {
  const size = Buffer.byteLength(JSON.stringify(input.parsedData), 'utf8');
  if (size > MAX_CANONICAL_DATA_BYTES) {
    throw new Error('Canonical CV data exceeds the persistence size limit.');
  }
}

export class FirebaseAdminCVRepository implements CVRepository {
  constructor(private readonly app: App) {}

  private collection() {
    return getFirestore(this.app).collection('cvs');
  }

  async findEquivalentCV(uid: string, sha256: string, parserVersion: string, schemaVersion: number) {
    const snapshot = await this.collection()
      .where('uid', '==', uid)
      .where('file.sha256', '==', sha256)
      .where('parsing.parserVersion', '==', parserVersion)
      .where('parsing.schemaVersion', '==', schemaVersion)
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    return document ? mapDocument(document.id, document.data()) : null;
  }

  async saveCurrentCV(input: NewCanonicalCV): Promise<CanonicalPersistedCV> {
    assertCanonicalCVSize(input);
    const db = getFirestore(this.app);
    const collection = this.collection();
    const newRef = collection.doc();
    const nowISO = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      const duplicateQuery = collection
        .where('uid', '==', input.uid)
        .where('file.sha256', '==', input.file.sha256)
        .where('parsing.parserVersion', '==', input.parsing.parserVersion)
        .where('parsing.schemaVersion', '==', input.parsing.schemaVersion)
        .limit(1);
      const duplicateSnapshot = await transaction.get(duplicateQuery);
      const duplicate = duplicateSnapshot.docs[0];
      if (duplicate) {
        const mapped = mapDocument(duplicate.id, duplicate.data());
        if (mapped) return mapped;
      }

      const currentQuery = collection
        .where('uid', '==', input.uid)
        .where('isCurrent', '==', true)
        .where('parsing.schemaVersion', '==', CV_SCHEMA_VERSION);
      const currentSnapshot = await transaction.get(currentQuery);
      for (const current of currentSnapshot.docs) {
        if (mapDocument(current.id, current.data())) {
          transaction.update(current.ref, { isCurrent: false, updatedAt: FieldValue.serverTimestamp() });
        }
      }

      transaction.create(newRef, {
        uid: input.uid,
        status: 'PROCESSED',
        isCurrent: true,
        parsedData: input.parsedData,
        file: input.file,
        parsing: input.parsing,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        id: newRef.id,
        uid: input.uid,
        status: 'PROCESSED' as const,
        isCurrent: true,
        parsedData: input.parsedData,
        file: input.file,
        parsing: input.parsing,
        createdAt: nowISO,
        updatedAt: nowISO,
      };
    });
    return result;
  }

  async getCurrentCVByUid(uid: string) {
    const snapshot = await this.collection()
      .where('uid', '==', uid)
      .where('isCurrent', '==', true)
      .where('parsing.schemaVersion', '==', CV_SCHEMA_VERSION)
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    return document ? mapDocument(document.id, document.data()) : null;
  }

  async getCVHistoryByUid(uid: string) {
    const snapshot = await this.collection()
      .where('uid', '==', uid)
      .where('parsing.schemaVersion', '==', CV_SCHEMA_VERSION)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.flatMap((document) => {
      const mapped = mapDocument(document.id, document.data());
      return mapped ? [mapped] : [];
    });
  }

  async getCurrentCanonicalCVs() {
    const snapshot = await this.collection()
      .where('isCurrent', '==', true)
      .where('parsing.schemaVersion', '==', CV_SCHEMA_VERSION)
      .get();
    return sortCanonicalCVsNewestFirst(snapshot.docs.flatMap((document) => {
      const mapped = mapDocument(document.id, document.data());
      return mapped ? [mapped] : [];
    }));
  }
}

export function createCVRepository(): CVRepository {
  const app = getFirebaseAdmin();
  if (!app) throw new Error('Firebase Admin is unavailable.');
  return new FirebaseAdminCVRepository(app);
}
