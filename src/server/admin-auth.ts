import type { NextFunction, Request, Response } from 'express';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../lib/firebase/admin';

export interface AdminPrincipal { uid: string; role: 'ADMIN'; }
export type AdminRequest = Request & { admin?: AdminPrincipal };
export interface AdminAuthServices { verifyToken(app: App, token: string): Promise<{ uid: string }>; getProfile(app: App, uid: string): Promise<Record<string, unknown> | null>; }

const services: AdminAuthServices = {
  async verifyToken(app, token) { return getAuth(app).verifyIdToken(token, true); },
  async getProfile(app, uid) { const snapshot = await getFirestore(app).collection('users').doc(uid).get(); return snapshot.exists ? snapshot.data() ?? null : null; },
};

const deny = (response: Response, status: number, code: string, message: string) => response.status(status).json({ error: { code, message, details: [] } });

export function createRequireAdmin(getAdminApp: () => App | null = getFirebaseAdmin, authServices: AdminAuthServices = services) {
  return async function requireAdmin(request: AdminRequest, response: Response, next: NextFunction) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return deny(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    const token = authorization.slice(7).trim();
    if (!token) return deny(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    const app = getAdminApp();
    if (!app) return deny(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication is temporarily unavailable.');
    let decoded: { uid: string };
    try { decoded = await authServices.verifyToken(app, token); }
    catch { return deny(response, 401, 'AUTH_INVALID', 'The authentication token is invalid or expired.'); }
    try {
      const profile = await authServices.getProfile(app, decoded.uid);
      if (!profile) return deny(response, 403, 'PROFILE_REQUIRED', 'An active administrator profile is required.');
      if (profile.isActive !== true) return deny(response, 403, 'ACCOUNT_INACTIVE', 'This account is inactive.');
      if (profile.role !== 'ADMIN') return deny(response, 403, 'ADMIN_ROLE_REQUIRED', 'Administrator access is required.');
      request.admin = { uid: decoded.uid, role: 'ADMIN' };
      return next();
    } catch { return deny(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication is temporarily unavailable.'); }
  };
}
