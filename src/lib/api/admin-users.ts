import { auth } from '../firebase/client';
import type { UserProfile } from '../../types';
import type { AdminUserCreateInput, AdminUserUpdateInput } from '../../types/admin';

export class AdminUserApiError extends Error { constructor(public readonly code: string, message: string, public readonly status: number) { super(message); } }

async function request(path: string, init: RequestInit) {
  const user = auth?.currentUser;
  if (!user) throw new AdminUserApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
  const token = await user.getIdToken();
  const response = await fetch(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (response.status === 204) return null;
  const payload: any = await response.json().catch(() => null);
  if (!response.ok) throw new AdminUserApiError(payload?.error?.code ?? 'ADMIN_USER_REQUEST_FAILED', payload?.error?.message ?? 'The administration request failed.', response.status);
  return payload;
}

export async function createAdminUser(input: AdminUserCreateInput): Promise<UserProfile> { return (await request('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).user; }
export async function updateAdminUser(uid: string, input: AdminUserUpdateInput): Promise<UserProfile> { return (await request(`/api/admin/users/${encodeURIComponent(uid)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).user; }
export async function deleteAdminUser(uid: string): Promise<void> { await request(`/api/admin/users/${encodeURIComponent(uid)}`, { method: 'DELETE' }); }
