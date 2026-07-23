import {
  isFirebaseConfigured,
  auth as clientAuth,
  db as clientDb
} from './client';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { UserProfile, CandidateCV, JobPosting, UserRole, SubscriptionTier } from '../../types';
import { storageService } from '../storage-service';

// ==========================================
// PRE-SEEDED MOCK DATA FOR SIMULATION MODE
// ==========================================

export const DEFAULT_MOCK_USERS: UserProfile[] = [
  {
    uid: 'admin-123',
    firstName: 'Thomas',
    lastName: 'Dubois',
    email: 'admin@cvtheque.ai',
    role: 'ADMIN',
    subscription: 'PREMIUM',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
    isActive: true,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    uid: 'recruiter-123',
    firstName: 'Hélène',
    lastName: 'Martin',
    email: 'recruiter@cvtheque.ai',
    role: 'RECRUITER',
    subscription: 'PREMIUM',
    photoURL: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120',
    isActive: true,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    uid: 'candidate-123',
    firstName: 'Alexandre',
    lastName: 'Bernard',
    email: 'candidate@cvtheque.ai',
    role: 'CANDIDATE',
    subscription: 'FREE',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
    isActive: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_MOCK_CVS: CandidateCV[] = [
  {
    id: 'cv-1',
    uid: 'candidate-123',
    fileName: 'Alexandre_Bernard_Resume.pdf',
    fileURL: '#',
    aiScore: 88,
    feedback: 'Excellent CV avec une forte expérience en React, Node.js et architecture Cloud. Quelques améliorations possibles sur la description de la section DevOps.',
    skills: ['React', 'Node.js', 'TypeScript', 'Docker', 'AWS', 'GraphQL'],
    status: 'PROCESSED',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cv-2',
    uid: 'candidate-456',
    fileName: 'Sophie_Lefebvre_Ingenieure_IA.pdf',
    fileURL: '#',
    aiScore: 94,
    feedback: 'Profil exceptionnel en Machine Learning et NLP. Publications scientifiques de haut niveau et projets pratiques solides.',
    skills: ['Python', 'PyTorch', 'NLP', 'TensorFlow', 'MLOps', 'Transformers'],
    status: 'PROCESSED',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cv-3',
    uid: 'candidate-789',
    fileName: 'Marc_Dubois_Product_Manager.pdf',
    fileURL: '#',
    aiScore: 72,
    feedback: 'Bonne expérience en gestion de produit agile. Devrait quantifier davantage l\'impact business de ses lancements de fonctionnalités.',
    skills: ['Product Management', 'Agile', 'Scrum', 'Jira', 'A/B Testing', 'Product Analytics'],
    status: 'PROCESSED',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const DEFAULT_MOCK_JOBS: JobPosting[] = [
  {
    id: 'job-1',
    recruiterId: 'recruiter-123',
    title: 'Lead Full-Stack Engineer React/Node',
    description: 'Nous recherchons un développeur Full-Stack expérimenté pour guider le développement de notre plateforme SaaS.',
    company: 'TechFlow SaaS',
    location: 'Paris (Hybride)',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'job-2',
    recruiterId: 'recruiter-123',
    title: 'Ingénieur Machine Learning Sénior',
    description: 'Rejoignez notre équipe R&D pour concevoir les futurs modèles de recommandation et d\'IA générative.',
    company: 'AI Solutions Inc',
    location: 'Lyon / Télétravail',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'job-3',
    recruiterId: 'recruiter-456',
    title: 'Product Owner Sénior Mobile',
    description: 'Prenez le lead sur nos applications mobiles iOS et Android comptant plus de 2 millions d\'utilisateurs actifs.',
    company: 'AppNation',
    location: 'Bordeaux',
    status: 'CLOSED',
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Ensure mock tables are initialized in LocalStorage with robust checks for empty arrays or parsing errors
function initLocalStorageMock() {
  const usersStr = localStorage.getItem('cv_mock_users');
  let usersOk = false;
  try {
    if (usersStr) {
      const parsed = JSON.parse(usersStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        usersOk = true;
      }
    }
  } catch (e) {}
  if (!usersOk) {
    localStorage.setItem('cv_mock_users', JSON.stringify(DEFAULT_MOCK_USERS));
  }

  const cvsStr = localStorage.getItem('cv_mock_cvs');
  let cvsOk = false;
  try {
    if (cvsStr) {
      const parsed = JSON.parse(cvsStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cvsOk = true;
      }
    }
  } catch (e) {}
  if (!cvsOk) {
    localStorage.setItem('cv_mock_cvs', JSON.stringify(DEFAULT_MOCK_CVS));
  }

  const jobsStr = localStorage.getItem('cv_mock_jobs');
  let jobsOk = false;
  try {
    if (jobsStr) {
      const parsed = JSON.parse(jobsStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        jobsOk = true;
      }
    }
  } catch (e) {}
  if (!jobsOk) {
    localStorage.setItem('cv_mock_jobs', JSON.stringify(DEFAULT_MOCK_JOBS));
  }
}

// ==========================================
// DB OPERATIONS ENGINE
// ==========================================

export const dbEngine = {
  // --- USER PROFILE ACTIONS ---

  async createUserProfile(profile: UserProfile): Promise<void> {
    if (isFirebaseConfigured && clientDb) {
      await setDoc(doc(clientDb, 'users', profile.uid), {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      initLocalStorageMock();
      const users = JSON.parse(localStorage.getItem('cv_mock_users') || '[]');
      const index = users.findIndex((u: any) => u.uid === profile.uid);
      if (index !== -1) {
        users[index] = profile;
      } else {
        users.push(profile);
      }
      localStorage.setItem('cv_mock_users', JSON.stringify(users));
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (isFirebaseConfigured && clientDb) {
      const snap = await getDoc(doc(clientDb, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString()
        } as UserProfile;
      }
      return null;
    } else {
      initLocalStorageMock();
      const users = JSON.parse(localStorage.getItem('cv_mock_users') || '[]');
      const user = users.find((u: any) => u.uid === uid);
      return user || null;
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        } as UserProfile;
      });
    } else {
      initLocalStorageMock();
      return JSON.parse(localStorage.getItem('cv_mock_users') || '[]');
    }
  },

  async updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (isFirebaseConfigured && clientDb) {
      await updateDoc(doc(clientDb, 'users', uid), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } else {
      initLocalStorageMock();
      const users = JSON.parse(localStorage.getItem('cv_mock_users') || '[]');
      const index = users.findIndex((u: any) => u.uid === uid);
      if (index !== -1) {
        users[index] = {
          ...users[index],
          ...data,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('cv_mock_users', JSON.stringify(users));
      }
    }
  },

  async deleteUserProfile(uid: string): Promise<void> {
    if (isFirebaseConfigured && clientDb) {
      await deleteDoc(doc(clientDb, 'users', uid));
    } else {
      initLocalStorageMock();
      const users = JSON.parse(localStorage.getItem('cv_mock_users') || '[]');
      const filtered = users.filter((u: any) => u.uid !== uid);
      localStorage.setItem('cv_mock_users', JSON.stringify(filtered));
    }
  },

  // --- CV ACTIONS ---

  async uploadCV(uid: string, fileName: string, fileData?: string, file?: File): Promise<CandidateCV> {
    // Standard simulator scores generated based on skill keywords
    const keywords = ['react', 'node', 'javascript', 'typescript', 'python', 'ia', 'ml', 'cloud', 'aws', 'docker', 'product', 'agile', 'devops'];
    const lowerName = fileName.toLowerCase();
    const matchedSkills = keywords.filter(kw => lowerName.includes(kw));
    
    // Simulate scoring
    let aiScore = Math.floor(Math.random() * 25) + 65; // base score 65 - 90
    if (lowerName.includes('senior') || lowerName.includes('lead') || lowerName.includes('ingenieur')) {
      aiScore += 8;
    }
    if (aiScore > 99) aiScore = 99;

    let feedback = "Le CV a été extrait avec succès par notre IA d'analyse sémantique. ";
    if (aiScore >= 85) {
      feedback += "Recommandation d'entretien technique prioritaire. Excellent positionnement sur les compétences clés du marché.";
    } else if (aiScore >= 75) {
      feedback += "Bon profil général. Des clarifications lors de l'entretien seront pertinentes sur les projets récents.";
    } else {
      feedback += "Profil junior ou compétences désalignées par rapport au poste. Pertinent pour un rôle de support ou d'apprentissage.";
    }

    let fileURL = fileData || '#';
    if (file) {
      try {
        const storagePath = `users/${uid}/cvs/${Date.now()}_${fileName}`;
        fileURL = await storageService.uploadFile(file, storagePath);
      } catch (err) {
        console.error('Failed to upload file to StorageService:', err);
      }
    }

    const newCv: CandidateCV = {
      id: 'cv-' + Math.random().toString(36).substring(2, 9),
      uid,
      fileName,
      fileURL,
      aiScore,
      feedback,
      skills: matchedSkills.length > 0 ? matchedSkills.map(s => s.toUpperCase()) : ['GENERAL IT'],
      status: 'PROCESSED',
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && clientDb) {
      const docRef = await addDoc(collection(clientDb, 'cvs'), {
        ...newCv,
        createdAt: serverTimestamp()
      });
      newCv.id = docRef.id;
      return newCv;
    } else {
      initLocalStorageMock();
      const cvs = JSON.parse(localStorage.getItem('cv_mock_cvs') || '[]');
      cvs.push(newCv);
      localStorage.setItem('cv_mock_cvs', JSON.stringify(cvs));
      return newCv;
    }
  },

  async getAllCVs(): Promise<CandidateCV[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'cvs'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as CandidateCV;
      });
    } else {
      initLocalStorageMock();
      return JSON.parse(localStorage.getItem('cv_mock_cvs') || '[]');
    }
  },

  async getCVsByCandidate(uid: string): Promise<CandidateCV[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'cvs'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as CandidateCV;
      });
    } else {
      initLocalStorageMock();
      const cvs = JSON.parse(localStorage.getItem('cv_mock_cvs') || '[]');
      return cvs.filter((cv: any) => cv.uid === uid);
    }
  },

  async deleteCV(id: string): Promise<void> {
    if (isFirebaseConfigured && clientDb) {
      await deleteDoc(doc(clientDb, 'cvs', id));
    } else {
      initLocalStorageMock();
      const cvs = JSON.parse(localStorage.getItem('cv_mock_cvs') || '[]');
      const filtered = cvs.filter((cv: any) => cv.id !== id);
      localStorage.setItem('cv_mock_cvs', JSON.stringify(filtered));
    }
  },

  // --- JOB ACTIONS ---

  async createJob(job: Omit<JobPosting, 'id' | 'createdAt'>): Promise<JobPosting> {
    const newJob: JobPosting = {
      ...job,
      id: 'job-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && clientDb) {
      const docRef = await addDoc(collection(clientDb, 'jobs'), {
        ...newJob,
        createdAt: serverTimestamp()
      });
      newJob.id = docRef.id;
      return newJob;
    } else {
      initLocalStorageMock();
      const jobs = JSON.parse(localStorage.getItem('cv_mock_jobs') || '[]');
      jobs.push(newJob);
      localStorage.setItem('cv_mock_jobs', JSON.stringify(jobs));
      return newJob;
    }
  },

  async getAllJobs(): Promise<JobPosting[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'jobs'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as JobPosting;
      });
    } else {
      initLocalStorageMock();
      return JSON.parse(localStorage.getItem('cv_mock_jobs') || '[]');
    }
  },

  async deleteJob(id: string): Promise<void> {
    if (isFirebaseConfigured && clientDb) {
      await deleteDoc(doc(clientDb, 'jobs', id));
    } else {
      initLocalStorageMock();
      const jobs = JSON.parse(localStorage.getItem('cv_mock_jobs') || '[]');
      const filtered = jobs.filter((j: any) => j.id !== id);
      localStorage.setItem('cv_mock_jobs', JSON.stringify(filtered));
    }
  }
};
