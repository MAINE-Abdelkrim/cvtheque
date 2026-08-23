import assert from 'node:assert/strict';
import test from 'node:test';
import type { App } from 'firebase-admin/app';
import {
  initializeSelectedFirebaseAdmin,
  selectFirebaseAdminCredential,
} from '../src/lib/firebase/admin';
import { resolveFirebaseWebConfig } from '../src/lib/firebase/config';

test('explicit Admin credential file takes precedence over environment and legacy fallback', () => {
  const existing = new Set(['C:\\workspace\\selected.json', 'C:\\workspace\\firebase-service-account.json']);
  const selection = selectFirebaseAdminCredential({
    cwd: 'C:\\workspace',
    env: {
      FIREBASE_CREDENTIALS_FILE: 'selected.json',
      FIREBASE_PROJECT_ID: 'environment-project',
      FIREBASE_CLIENT_EMAIL: 'environment@example.invalid',
      FIREBASE_PRIVATE_KEY: 'fake-key',
    },
    fileExists: filePath => existing.has(filePath),
  });
  assert.deepEqual(selection, {
    kind: 'file',
    source: 'explicit_file',
    filePath: 'C:\\workspace\\selected.json',
  });
});

test('missing explicit Admin credential never falls through to legacy credential', () => {
  const selection = selectFirebaseAdminCredential({
    cwd: 'C:\\workspace',
    env: { FIREBASE_CREDENTIALS_FILE: 'missing.json' },
    fileExists: filePath => filePath.endsWith('firebase-service-account.json'),
  });
  assert.equal(selection, null);
});

test('legacy Admin credential remains available as final rollback fallback', () => {
  const selection = selectFirebaseAdminCredential({
    cwd: 'C:\\workspace',
    env: {},
    fileExists: filePath => filePath.endsWith('firebase-service-account.json'),
  });
  assert.equal(selection?.kind, 'file');
  assert.equal(selection?.source, 'legacy_file');
});

test('Admin initialization passes a selected fake file to mocked SDK dependencies', () => {
  const calls: string[] = [];
  const fakeApp = {} as App;
  const result = initializeSelectedFirebaseAdmin(
    { kind: 'file', source: 'explicit_file', filePath: 'C:\\fake\\credential.json' },
    {
      cert(value) {
        calls.push(String(value));
        return {} as ReturnType<typeof import('firebase-admin/app').cert>;
      },
      getApps: () => [],
      initializeApp(options) {
        assert.ok(options.credential);
        calls.push('initialize');
        return fakeApp;
      },
    },
  );
  assert.equal(result, fakeApp);
  assert.deepEqual(calls, ['C:\\fake\\credential.json', 'initialize']);
});

test('all populated VITE Firebase values override legacy and applet fallbacks', () => {
  const vite = {
    VITE_FIREBASE_API_KEY: 'vite-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'vite-auth-domain',
    VITE_FIREBASE_PROJECT_ID: 'vite-project',
    VITE_FIREBASE_STORAGE_BUCKET: 'vite-storage',
    VITE_FIREBASE_MESSAGING_SENDER_ID: 'vite-sender',
    VITE_FIREBASE_APP_ID: 'vite-app',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'legacy-project',
  };
  const resolved = resolveFirebaseWebConfig(vite, {
    apiKey: 'fallback-api-key', authDomain: 'fallback-auth-domain', projectId: 'fallback-project',
    storageBucket: 'fallback-storage', messagingSenderId: 'fallback-sender', appId: 'fallback-app',
  });
  assert.deepEqual(resolved, {
    apiKey: 'vite-api-key', authDomain: 'vite-auth-domain', projectId: 'vite-project',
    storageBucket: 'vite-storage', messagingSenderId: 'vite-sender', appId: 'vite-app',
  });
});
