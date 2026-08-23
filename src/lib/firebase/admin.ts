import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

type FirebaseAdminEnvironment = Record<string, string | undefined>;

export type FirebaseAdminCredentialSelection =
  | { kind: 'file'; source: 'explicit_file' | 'legacy_file'; filePath: string }
  | { kind: 'environment'; projectId: string; clientEmail: string; privateKey: string };

export interface FirebaseAdminSelectionOptions {
  env?: FirebaseAdminEnvironment;
  cwd?: string;
  fileExists?: (filePath: string) => boolean;
}

export interface FirebaseAdminInitializationDependencies {
  cert: typeof cert;
  getApps: typeof getApps;
  initializeApp: typeof initializeApp;
}

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function selectFirebaseAdminCredential(
  options: FirebaseAdminSelectionOptions = {},
): FirebaseAdminCredentialSelection | null {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const fileExists = options.fileExists ?? fs.existsSync;
  const explicitFile = nonEmpty(env.FIREBASE_CREDENTIALS_FILE);

  // An explicitly configured file is authoritative. If it is unavailable, do
  // not silently initialize against a legacy project.
  if (explicitFile) {
    const filePath = path.resolve(cwd, explicitFile);
    return fileExists(filePath)
      ? { kind: 'file', source: 'explicit_file', filePath }
      : null;
  }

  const projectId = nonEmpty(env.FIREBASE_PROJECT_ID);
  const clientEmail = nonEmpty(env.FIREBASE_CLIENT_EMAIL);
  const privateKey = nonEmpty(env.FIREBASE_PRIVATE_KEY);
  if (projectId && clientEmail && privateKey) {
    return {
      kind: 'environment',
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  }

  const legacyFile = path.join(cwd, 'firebase-service-account.json');
  return fileExists(legacyFile)
    ? { kind: 'file', source: 'legacy_file', filePath: legacyFile }
    : null;
}

export function initializeSelectedFirebaseAdmin(
  selection: FirebaseAdminCredentialSelection,
  dependencies: FirebaseAdminInitializationDependencies = { cert, getApps, initializeApp },
): App {
  const apps = dependencies.getApps();
  if (apps.length > 0) return apps[0];

  const credential = selection.kind === 'file'
    ? dependencies.cert(selection.filePath)
    : dependencies.cert({
      projectId: selection.projectId,
      clientEmail: selection.clientEmail,
      privateKey: selection.privateKey,
    });
  return dependencies.initializeApp({ credential });
}

const credentialSelection = selectFirebaseAdminCredential();
export const isFirebaseAdminConfigured = credentialSelection !== null;

let adminApp: App | null = null;

export function getFirebaseAdmin(): App | null {
  if (!credentialSelection) return null;
  if (adminApp) return adminApp;

  try {
    adminApp = initializeSelectedFirebaseAdmin(credentialSelection);
    return adminApp;
  } catch {
    console.error('Failed to initialize Firebase Admin SDK.');
    return null;
  }
}
