export type UserRole = 'ADMIN' | 'RECRUITER' | 'CANDIDATE';
export type SubscriptionTier = 'FREE' | 'PREMIUM';

export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  subscription: SubscriptionTier;
  photoURL?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateCV {
  id: string;
  uid: string;
  fileName: string;
  fileURL?: string;
  aiScore?: number;
  feedback?: string;
  skills?: string[];
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  createdAt: string;
}

export interface JobPosting {
  id: string;
  recruiterId: string;
  title: string;
  description: string;
  company: string;
  location: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
}
