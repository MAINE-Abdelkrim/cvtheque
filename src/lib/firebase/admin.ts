import { initializeApp, getApps, cert } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

let projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Check if local service account JSON is available
const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
let serviceAccount: any = null;

if (fs.existsSync(serviceAccountPath)) {
  try {
    const raw = fs.readFileSync(serviceAccountPath, 'utf-8');
    serviceAccount = JSON.parse(raw);
    if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key) {
      projectId = serviceAccount.project_id;
      clientEmail = serviceAccount.client_email;
      privateKey = serviceAccount.private_key;
    }
  } catch (err) {
    console.error('Error reading local firebase-service-account.json:', err);
  }
}

if (privateKey) {
  // Handle newlines in private key
  privateKey = privateKey.replace(/\\n/g, '\n');
}

export const isFirebaseAdminConfigured = !!(projectId && clientEmail && privateKey);

let adminApp: any = null;

export function getFirebaseAdmin() {
  if (!isFirebaseAdminConfigured) {
    return null;
  }

  if (!adminApp) {
    try {
      const apps = getApps();
      if (apps.length === 0) {
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        adminApp = apps[0];
      }
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      return null;
    }
  }

  return adminApp;
}
