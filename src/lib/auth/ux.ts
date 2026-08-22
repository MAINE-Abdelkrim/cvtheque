import type { UserRole } from '../../types';

export type PublicSignupRole = Extract<UserRole, 'CANDIDATE' | 'RECRUITER'>;

export const PUBLIC_SIGNUP_ROLES: readonly PublicSignupRole[] = ['CANDIDATE', 'RECRUITER'];

export function isPublicSignupRole(value: unknown): value is PublicSignupRole {
  return typeof value === 'string' && PUBLIC_SIGNUP_ROLES.includes(value as PublicSignupRole);
}

export function buildPublicSignupInput(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: unknown;
}) {
  if (!isPublicSignupRole(input.role)) throw new Error('SIGNUP_ROLE_INVALID');
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    password: input.password,
    role: input.role,
  };
}

export function buildSelfProfileUpdate(input: { firstName: string; lastName: string; photoURL?: string }) {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    photoURL: input.photoURL?.trim() || undefined,
  };
}

export function getAuthErrorMessage(error: unknown, context: 'login' | 'signup' | 'reset' | 'profile' = 'login') {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Adresse e-mail ou mot de passe incorrect.',
    'auth/user-not-found': 'Adresse e-mail ou mot de passe incorrect.',
    'auth/wrong-password': 'Adresse e-mail ou mot de passe incorrect.',
    'auth/invalid-email': 'Veuillez saisir une adresse e-mail valide.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse e-mail.',
    'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
    'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard.',
    'auth/network-request-failed': 'Connexion impossible. Vérifiez votre réseau puis réessayez.',
    'auth/popup-closed-by-user': 'La connexion Google a été annulée.',
    'auth/popup-blocked': 'La fenêtre de connexion Google a été bloquée par le navigateur.',
    'auth/account-disabled': 'Ce compte est inactif. Contactez un administrateur.',
    'auth/user-disabled': 'Ce compte est inactif. Contactez un administrateur.',
    'auth/profile-missing': 'Le profil associé à ce compte est indisponible.',
  };
  if (messages[code]) return messages[code];
  if (context === 'signup') return "Impossible de créer le compte pour le moment. Veuillez réessayer.";
  if (context === 'reset') return "Impossible d’envoyer le lien pour le moment. Veuillez réessayer.";
  if (context === 'profile') return "Impossible d’enregistrer vos modifications. Veuillez réessayer.";
  return 'Connexion impossible. Vérifiez vos informations puis réessayez.';
}
