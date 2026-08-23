import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../../firebase-applet-config.json';
import { resolveFirebaseWebConfig } from './config';

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = resolveFirebaseWebConfig(metaEnv, firebaseAppletConfig);

// Check if keys are actually provided and not default template strings
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your-api-key' &&
  !firebaseConfig.apiKey.startsWith('your')
);

let app;
let auth: any = null;
let db: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error('Failed to initialize Firebase client SDK:', error);
  }
}

export { auth, db };
