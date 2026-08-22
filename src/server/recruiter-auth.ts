import type { NextFunction, Request, Response } from 'express';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../lib/firebase/admin';

export interface RecruiterPrincipal {
  uid: string;
  role: 'RECRUITER';
  subscription: 'FREE' | 'PREMIUM';
}

export type RecruiterRequest = Request & { recruiter?: RecruiterPrincipal };

export interface RecruiterAuthServices {
  verifyToken(app: App, token: string): Promise<{ uid: string }>;
  getProfile(app: App, uid: string): Promise<Record<string, unknown> | null>;
}

const services: RecruiterAuthServices = {
  async verifyToken(app, token) { return getAuth(app).verifyIdToken(token, true); },
  async getProfile(app, uid) {
    const snapshot = await getFirestore(app).collection('users').doc(uid).get();
    return snapshot.exists ? snapshot.data() ?? null : null;
  },
};

function error(response: Response, status: number, code: string, message: string) {
  return response.status(status).json({ error: { code, message, details: [] } });
}

export function createRequireRecruiter(
  getAdminApp: () => App | null = getFirebaseAdmin,
  authServices: RecruiterAuthServices = services,
) {
  return async function requireRecruiter(request: RecruiterRequest, response: Response, next: NextFunction) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return error(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    const token = authorization.slice(7).trim();
    if (!token) return error(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    const app = getAdminApp();
    if (!app) return error(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication is temporarily unavailable.');
    let decoded: { uid: string };
    try {
      decoded = await authServices.verifyToken(app, token);
    } catch {
      return error(response, 401, 'AUTH_INVALID', 'The authentication token is invalid or expired.');
    }
    try {
      const profile = await authServices.getProfile(app, decoded.uid);
      if (!profile) return error(response, 403, 'PROFILE_REQUIRED', 'An active recruiter profile is required.');
      if (profile.isActive !== true) return error(response, 403, 'ACCOUNT_INACTIVE', 'This account is inactive.');
      if (profile.role !== 'RECRUITER') return error(response, 403, 'RECRUITER_ROLE_REQUIRED', 'Recruiter access is required.');
      const subscription = profile.subscription === 'PREMIUM' ? 'PREMIUM' : 'FREE';
      request.recruiter = { uid: decoded.uid, role: 'RECRUITER', subscription };
      return next();
    } catch {
      return error(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication is temporarily unavailable.');
    }
  };
}
