export interface FirebaseWebConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

type FirebaseWebEnvironment = Record<string, string | undefined>;

export function resolveFirebaseWebConfig(
  env: FirebaseWebEnvironment,
  fallback: FirebaseWebConfig,
): FirebaseWebConfig {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || env.NEXT_PUBLIC_FIREBASE_API_KEY || fallback.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || fallback.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || fallback.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || fallback.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || fallback.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || env.NEXT_PUBLIC_FIREBASE_APP_ID || fallback.appId,
  };
}
