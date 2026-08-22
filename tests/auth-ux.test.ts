import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicSignupInput, buildSelfProfileUpdate, getAuthErrorMessage, isPublicSignupRole } from '../src/lib/auth/ux';

test('public signup accepts only candidate and recruiter roles', () => {
  assert.equal(isPublicSignupRole('CANDIDATE'), true);
  assert.equal(isPublicSignupRole('RECRUITER'), true);
  assert.equal(isPublicSignupRole('ADMIN'), false);
  assert.throws(() => buildPublicSignupInput({ firstName:'A', lastName:'B', email:'a@b.test', password:'secret', role:'ADMIN' }));
});

test('public signup payload cannot contain subscription or account status', () => {
  const payload = buildPublicSignupInput({ firstName:' Alex ', lastName:' Martin ', email:' alex@example.test ', password:'secret', role:'CANDIDATE' });
  assert.deepEqual(payload, { firstName:'Alex', lastName:'Martin', email:'alex@example.test', password:'secret', role:'CANDIDATE' });
  assert.equal('subscription' in payload, false);
  assert.equal('isActive' in payload, false);
});

test('self profile update contains no privileged fields', () => {
  const payload = buildSelfProfileUpdate({ firstName:' Alex ', lastName:' Martin ', photoURL:' https://example.test/avatar.png ' });
  assert.deepEqual(payload, { firstName:'Alex', lastName:'Martin', photoURL:'https://example.test/avatar.png' });
  assert.equal('role' in payload, false); assert.equal('subscription' in payload, false); assert.equal('isActive' in payload, false);
});

test('technical authentication errors are mapped to safe French copy', () => {
  assert.equal(getAuthErrorMessage({ code:'auth/invalid-credential', message:'Firebase internal detail' }), 'Adresse e-mail ou mot de passe incorrect.');
  assert.doesNotMatch(getAuthErrorMessage(new Error('raw provider stack'), 'signup'), /raw provider|stack|Firebase/i);
});
