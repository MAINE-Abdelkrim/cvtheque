import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../lib/firebase/admin';
import type { UserProfile } from '../types';
import type { AdminUserCreateInput, AdminUserUpdateInput } from '../types/admin';

export interface AdminUserRepository {
  create(input: AdminUserCreateInput): Promise<UserProfile>;
  update(uid: string, input: AdminUserUpdateInput): Promise<UserProfile | null>;
  delete(uid: string): Promise<boolean>;
}

export function createAdminUserRepository(): AdminUserRepository {
  const app = getFirebaseAdmin();
  if (!app) throw new Error('FIREBASE_ADMIN_UNAVAILABLE');
  const auth = getAuth(app);
  const db = getFirestore(app);
  return {
    async create(input) {
      const record = await auth.createUser({ email: input.email, password: input.password, displayName: `${input.firstName} ${input.lastName}` });
      const now = new Date().toISOString();
      const profile: UserProfile = { uid: record.uid, firstName: input.firstName, lastName: input.lastName, email: input.email, role: input.role, subscription: input.subscription, isActive: input.isActive, createdAt: now, updatedAt: now };
      try { await db.collection('users').doc(record.uid).set(profile); }
      catch (error) { await auth.deleteUser(record.uid).catch(() => undefined); throw error; }
      return profile;
    },
    async update(uid, input) {
      const ref = db.collection('users').doc(uid);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;
      const previous = snapshot.data() as UserProfile;
      const authUpdate: { email?: string; displayName?: string } = {};
      if (input.email !== undefined) authUpdate.email = input.email;
      if (input.firstName !== undefined || input.lastName !== undefined) authUpdate.displayName = `${input.firstName ?? previous.firstName} ${input.lastName ?? previous.lastName}`.trim();
      if (Object.keys(authUpdate).length) await auth.updateUser(uid, authUpdate);
      const updated = { ...previous, ...input, uid, updatedAt: new Date().toISOString() };
      await ref.update({ ...input, updatedAt: updated.updatedAt });
      return updated;
    },
    async delete(uid) {
      const ref = db.collection('users').doc(uid);
      const snapshot = await ref.get();
      if (!snapshot.exists) return false;
      try { await auth.deleteUser(uid); }
      catch (error: any) { if (error?.code !== 'auth/user-not-found') throw error; }
      await ref.delete();
      return true;
    },
  };
}
