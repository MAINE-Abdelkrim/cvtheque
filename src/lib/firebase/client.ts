import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || metaEnv.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseAppletConfig?.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || metaEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig?.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || metaEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseAppletConfig?.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || metaEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig?.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || metaEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig?.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || metaEnv.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseAppletConfig?.appId,
};

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
