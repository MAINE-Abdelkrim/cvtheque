import type { NextFunction, Request, Response } from 'express';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../lib/firebase/admin';
import { CVRouteError, sendCVError } from './cv-errors';

export interface CandidatePrincipal {
  uid: string;
  role: 'CANDIDATE';
}

export type CandidateRequest = Request & { candidate?: CandidatePrincipal };

interface CandidateAuthServices {
  verifyToken(app: App, token: string): Promise<{ uid: string }>;
  getProfile(app: App, uid: string): Promise<Record<string, unknown> | null>;
}

const firebaseCandidateAuthServices: CandidateAuthServices = {
  async verifyToken(app, token) {
    return getAuth(app).verifyIdToken(token, true);
  },
  async getProfile(app, uid) {
    const snapshot = await getFirestore(app).collection('users').doc(uid).get();
    return snapshot.exists ? (snapshot.data() ?? null) : null;
  },
};

export function createRequireCandidate(
  getAdminApp: () => App | null = getFirebaseAdmin,
  services: CandidateAuthServices = firebaseCandidateAuthServices,
) {
  return async function requireCandidate(request: CandidateRequest, response: Response, next: NextFunction) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return sendCVError(response, new CVRouteError(401, 'AUTH_REQUIRED', 'Authentication is required.'));
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      return sendCVError(response, new CVRouteError(401, 'AUTH_REQUIRED', 'Authentication is required.'));
    }

    const adminApp = getAdminApp();
    if (!adminApp) {
      return sendCVError(response, new CVRouteError(503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication is temporarily unavailable.'));
    }

    let decoded: { uid: string };
    try {
      decoded = await services.verifyToken(adminApp, token);
    } catch {
      return sendCVError(response, new CVRouteError(401, 'AUTH_INVALID', 'The authentication token is invalid or expired.'));
    }

    try {
      const profile = await services.getProfile(adminApp, decoded.uid);
      if (!profile) {
        return sendCVError(response, new CVRouteError(403, 'PROFILE_REQUIRED', 'An active candidate profile is required.'));
      }
      if (profile.isActive !== true) {
        return sendCVError(response, new CVRouteError(403, 'ACCOUNT_INACTIVE', 'This account is inactive.'));
      }
      if (profile.role !== 'CANDIDATE') {
        return sendCVError(response, new CVRouteError(403, 'CANDIDATE_ROLE_REQUIRED', 'Candidate access is required.'));
      }

      request.candidate = { uid: decoded.uid, role: 'CANDIDATE' };
      console.info('[CV Parse] authentication passed');
      console.info('[CV Parse] candidate role passed');
      return next();
    } catch {
      return sendCVError(response, new CVRouteError(503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication is temporarily unavailable.'));
    }
  };
}
