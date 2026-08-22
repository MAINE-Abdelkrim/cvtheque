import type { RequestHandler } from 'express';
import { ZodError } from 'zod';
import { adminUserCreateSchema, adminUserUpdateSchema } from '../types/admin';
import { createAdminUserRepository, type AdminUserRepository } from './admin-user-repository';
import type { AdminRequest } from './admin-auth';

const error = (response: any, status: number, code: string, message: string, details: string[] = []) => response.status(status).json({ error: { code, message, details } });
const validationDetails = (value: ZodError) => value.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);

export function createAdminUserCreateHandler(repositoryFactory: () => AdminUserRepository = createAdminUserRepository): RequestHandler {
  return async (request: AdminRequest, response) => {
    if (!request.admin) return error(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    try { const user = await repositoryFactory().create(adminUserCreateSchema.parse(request.body)); return response.status(201).json({ user }); }
    catch (cause) { if (cause instanceof ZodError) return error(response, 400, 'ADMIN_USER_VALIDATION_FAILED', 'The user data is invalid.', validationDetails(cause)); return error(response, 503, 'ADMIN_USER_CREATE_FAILED', 'The user could not be created.'); }
  };
}

export function createAdminUserUpdateHandler(repositoryFactory: () => AdminUserRepository = createAdminUserRepository): RequestHandler {
  return async (request: AdminRequest, response) => {
    if (!request.admin) return error(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    const uid = request.params.uid?.trim();
    if (!uid) return error(response, 400, 'TARGET_UID_REQUIRED', 'A target user is required.');
    try { const user = await repositoryFactory().update(uid, adminUserUpdateSchema.parse(request.body)); return user ? response.json({ user }) : error(response, 404, 'USER_NOT_FOUND', 'The user was not found.'); }
    catch (cause) { if (cause instanceof ZodError) return error(response, 400, 'ADMIN_USER_VALIDATION_FAILED', 'The user data is invalid.', validationDetails(cause)); return error(response, 503, 'ADMIN_USER_UPDATE_FAILED', 'The user could not be updated.'); }
  };
}

export function createAdminUserDeleteHandler(repositoryFactory: () => AdminUserRepository = createAdminUserRepository): RequestHandler {
  return async (request: AdminRequest, response) => {
    if (!request.admin) return error(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    const uid = request.params.uid?.trim();
    if (!uid) return error(response, 400, 'TARGET_UID_REQUIRED', 'A target user is required.');
    if (uid === request.admin.uid) return error(response, 409, 'ADMIN_SELF_DELETE_FORBIDDEN', 'Administrators cannot delete their current account.');
    try { return await repositoryFactory().delete(uid) ? response.status(204).send() : error(response, 404, 'USER_NOT_FOUND', 'The user was not found.'); }
    catch { return error(response, 503, 'ADMIN_USER_DELETE_FAILED', 'The user could not be deleted.'); }
  };
}
