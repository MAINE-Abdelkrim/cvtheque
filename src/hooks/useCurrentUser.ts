import { useAuth } from '../providers/auth-provider';
import { UserProfile } from '../types';

export function useCurrentUser() {
  const { profile, loading, isSimulated } = useAuth();

  return {
    user: profile,
    loading,
    isSimulated,
    isAdmin: profile?.role === 'ADMIN',
    isRecruiter: profile?.role === 'RECRUITER',
    isCandidate: profile?.role === 'CANDIDATE',
    isPremium: profile?.subscription === 'PREMIUM',
  };
}
