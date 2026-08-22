import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { App } from 'firebase-admin/app';
import { createRequireAdmin } from '../src/server/admin-auth';
import { createAdminUserCreateHandler, createAdminUserDeleteHandler, createAdminUserUpdateHandler } from '../src/server/admin-user-route';
import type { AdminUserRepository } from '../src/server/admin-user-repository';
import { publicRegistrationSchema } from '../src/types/admin';
import type { UserProfile } from '../src/types';

function responseMock() {
  const state: any = { statusCode: 200, body: undefined, ended: false };
  return { state, response: { status(code: number) { state.statusCode = code; return this; }, json(body: unknown) { state.body = body; return this; }, send() { state.ended = true; return this; } } as any };
}

async function authenticate(profile: Record<string, unknown> | null, authorization = 'Bearer token') {
  const request: any = { headers: { authorization } };
  const { state, response } = responseMock();
  let continued = false;
  await createRequireAdmin(() => ({} as App), { async verifyToken() { return { uid: 'admin-uid' }; }, async getProfile() { return profile; } })(request, response, () => { continued = true; });
  return { request, state, continued };
}

const storedUser: UserProfile = { uid: 'target', firstName: 'Alex', lastName: 'Test', email: 'alex@example.test', role: 'CANDIDATE', subscription: 'FREE', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
function repository(): AdminUserRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async create(input) { calls.push(`create:${input.role}`); return { ...storedUser, ...input, uid: 'created', createdAt: '2026-01-01', updatedAt: '2026-01-01' }; },
    async update(uid, input) { calls.push(`update:${uid}`); return { ...storedUser, ...input, uid }; },
    async delete(uid) { calls.push(`delete:${uid}`); return true; },
  };
}

test('Admin middleware rejects unauthenticated, Candidate, Recruiter, and inactive Admin callers', async () => {
  const missing = await authenticate({ role: 'ADMIN', isActive: true }, '');
  assert.equal(missing.state.statusCode, 401);
  for (const profile of [{ role: 'CANDIDATE', isActive: true }, { role: 'RECRUITER', isActive: true }, { role: 'ADMIN', isActive: false }]) {
    const result = await authenticate(profile);
    assert.equal(result.continued, false);
    assert.equal(result.state.statusCode, 403);
  }
});

test('active verified Admin principal is attached from token identity only', async () => {
  const result = await authenticate({ role: 'ADMIN', isActive: true });
  assert.equal(result.continued, true);
  assert.deepEqual(result.request.admin, { uid: 'admin-uid', role: 'ADMIN' });
});

test('all Admin user handlers reject requests without attached verified Admin', async () => {
  const handlers = [createAdminUserCreateHandler, createAdminUserUpdateHandler, createAdminUserDeleteHandler];
  for (const factory of handlers) {
    const repo = repository();
    const { state, response } = responseMock();
    await factory(() => repo)({ params: { uid: 'target' }, body: {} } as any, response, (() => undefined) as any);
    assert.equal(state.statusCode, 401);
    assert.deepEqual(repo.calls, []);
  }
});

test('authorized Admin can create, update, and delete supported users', async () => {
  const repo = repository();
  const createResponse = responseMock();
  await createAdminUserCreateHandler(() => repo)({ admin: { uid: 'admin-uid', role: 'ADMIN' }, body: { firstName: 'New', lastName: 'User', email: 'new@example.test', password: 'secret12', role: 'RECRUITER', subscription: 'PREMIUM', isActive: true } } as any, createResponse.response, (() => undefined) as any);
  assert.equal(createResponse.state.statusCode, 201);
  const updateResponse = responseMock();
  await createAdminUserUpdateHandler(() => repo)({ admin: { uid: 'admin-uid', role: 'ADMIN' }, params: { uid: 'target' }, body: { role: 'RECRUITER', isActive: false } } as any, updateResponse.response, (() => undefined) as any);
  assert.equal(updateResponse.state.statusCode, 200);
  const deleteResponse = responseMock();
  await createAdminUserDeleteHandler(() => repo)({ admin: { uid: 'admin-uid', role: 'ADMIN' }, params: { uid: 'target' } } as any, deleteResponse.response, (() => undefined) as any);
  assert.equal(deleteResponse.state.statusCode, 204);
  assert.deepEqual(repo.calls, ['create:RECRUITER', 'update:target', 'delete:target']);
});

test('Admin update rejects unsupported fields and browser-controlled caller identity', async () => {
  const repo = repository();
  const { state, response } = responseMock();
  await createAdminUserUpdateHandler(() => repo)({ admin: { uid: 'admin-uid', role: 'ADMIN' }, params: { uid: 'target' }, body: { role: 'ADMIN', callerUid: 'attacker', password: 'replacement' } } as any, response, (() => undefined) as any);
  assert.equal(state.statusCode, 400);
  assert.deepEqual(repo.calls, []);
});

test('Admin cannot delete the currently authenticated Admin account', async () => {
  const repo = repository();
  const { state, response } = responseMock();
  await createAdminUserDeleteHandler(() => repo)({ admin: { uid: 'admin-uid', role: 'ADMIN' }, params: { uid: 'admin-uid' } } as any, response, (() => undefined) as any);
  assert.equal(state.statusCode, 409);
  assert.deepEqual(repo.calls, []);
});

test('public registration permits Candidate/Recruiter only and cannot grant Premium', () => {
  assert.equal(publicRegistrationSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'a@example.test', password: 'secret12', role: 'CANDIDATE' }).success, true);
  assert.equal(publicRegistrationSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'a@example.test', password: 'secret12', role: 'RECRUITER' }).success, true);
  assert.equal(publicRegistrationSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'a@example.test', password: 'secret12', role: 'ADMIN' }).success, false);
  assert.equal(publicRegistrationSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'a@example.test', password: 'secret12', role: 'CANDIDATE', subscription: 'PREMIUM' }).success, false);
});

test('Firestore self-service profile updates preserve privileged account fields', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /request\.resource\.data\.role == resource\.data\.role/);
  assert.match(rules, /request\.resource\.data\.subscription == resource\.data\.subscription/);
  assert.match(rules, /request\.resource\.data\.isActive == resource\.data\.isActive/);
  assert.match(rules, /request\.resource\.data\.role in \['CANDIDATE', 'RECRUITER'\]/);
});
