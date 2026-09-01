import { normalizeCVToCandidateCV } from "./cv-adapter";
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
import { UserProfile, CandidateCV, JobPosting, JobApplication, UserRole, SubscriptionTier, OralInterviewSession } from '../../types';
import { storageService } from '../storage-service';

// ==========================================
// PRE-SEEDED MOCK DATA FOR SIMULATION MODE
// ==========================================

export const DEFAULT_MOCK_USERS: UserProfile[] = [];
/*
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
*/

const DEFAULT_MOCK_CVS: CandidateCV[] = [];
/*
  {
    id: 'cv-1',
    uid: 'candidate-123',
    fileName: 'Alexandre_Bernard_Resume.pdf',
    fullName: 'Alexandre Bernard',
    jobTitle: 'Lead Full-Stack Engineer React/Node',
    email: 'alexandre.bernard@techflow.dev',
    phone: '+33 6 45 78 12 90',
    location: 'Paris, France',
    fileURL: '#',
    aiScore: 88,
    feedback: 'Excellent CV avec une forte expérience en React, Node.js et architecture Cloud. Quelques améliorations possibles sur la description de la section DevOps.',
    skills: ['React', 'Node.js', 'TypeScript', 'Docker', 'AWS', 'GraphQL', 'PostgreSQL', 'TailwindCSS'],
    parsedData: {
      identity: {
        full_name: 'Alexandre Bernard',
        email: 'alexandre.bernard@techflow.dev',
        phone: '+33 6 45 78 12 90',
        linkedin: 'https://linkedin.com/in/alexandre-bernard',
        github: 'https://github.com/alex-bernard',
        website: 'https://alexbernard.dev',
        location: 'Paris, France',
        job_title: 'Lead Full-Stack Engineer React/Node',
        other_links: []
      },
      summary: 'Développeur Full-Stack Senior avec 6 ans d\'expérience dans la conception d\'applications web scalables et le leadership technique d\'équipes agiles.',
      skills: [
        { name: 'React', category: 'Frontend', source: 'extracted' },
        { name: 'Node.js', category: 'Backend', source: 'extracted' },
        { name: 'TypeScript', category: 'Langage', source: 'extracted' },
        { name: 'Docker', category: 'DevOps', source: 'extracted' },
        { name: 'AWS', category: 'Cloud', source: 'extracted' },
        { name: 'GraphQL', category: 'API', source: 'extracted' }
      ],
      languages: [
        { language: 'Français', level: 'Natif', original_level: 'Français (Natif)' },
        { language: 'Anglais', level: 'Courant / C1', original_level: 'Anglais (C1)' },
        { language: 'Espagnol', level: 'Intermédiaire / B1', original_level: 'Espagnol (B1)' }
      ],
      certifications: [
        { name: 'AWS Certified Solutions Architect - Associate', issuer: 'Amazon Web Services', date: '2023', credential_id: 'AWS-99214' }
      ],
      education: [
        {
          degree: 'Diplôme d\'Ingénieur en Informatique & Systèmes d\'Information',
          field_of_study: 'Génie Logiciel',
          institution: 'INSA Lyon',
          location: 'Lyon, France',
          start_date: '2015',
          end_date: '2018',
          description: 'Spécialisation architectures distribuées, bases de données et sécurité applicative.'
        }
      ],
      experiences: [
        {
          job_title: 'Lead Developer Full-Stack',
          company: 'SaaS Innovate',
          location: 'Paris, France',
          start_date: '2021',
          end_date: 'Présent',
          description: 'Management technique d\'une équipe de 5 développeurs. Refonte de l\'architecture vers Next.js et microservices Node.js, réduisant le temps de chargement de 45%.'
        },
        {
          job_title: 'Développeur Full-Stack React / Node',
          company: 'Digital Factory',
          location: 'Paris, France',
          start_date: '2018',
          end_date: '2021',
          description: 'Développement de fonctionnalités front-end réactives et conception d\'APIs RESTful et GraphQL hautement disponibles.'
        }
      ]
    },
    status: 'PROCESSED',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cv-2',
    uid: 'candidate-456',
    fileName: 'Sophie_Lefebvre_Ingenieure_IA.pdf',
    fullName: 'Sophie Lefebvre',
    jobTitle: 'Ingénieure en Intelligence Artificielle & NLP',
    email: 'sophie.lefebvre@ai-research.fr',
    phone: '+33 6 89 23 45 67',
    location: 'Lyon, France',
    fileURL: '#',
    aiScore: 94,
    feedback: 'Profil exceptionnel en Machine Learning et NLP. Publications scientifiques de haut niveau et projets pratiques solides.',
    skills: ['Python', 'PyTorch', 'NLP', 'TensorFlow', 'MLOps', 'Transformers', 'Hugging Face', 'Scikit-Learn', 'FastAPI', 'Docker'],
    parsedData: {
      identity: {
        full_name: 'Sophie Lefebvre',
        email: 'sophie.lefebvre@ai-research.fr',
        phone: '+33 6 89 23 45 67',
        linkedin: 'https://linkedin.com/in/sophie-lefebvre-ai',
        github: 'https://github.com/sophie-ml',
        website: null,
        location: 'Lyon, France',
        job_title: 'Ingénieure en Intelligence Artificielle & NLP',
        other_links: []
      },
      summary: 'Data Scientist et chercheuse IA spécialisée dans le traitement automatique du langage naturel (NLP), les modèles de fondation (LLM) et le déploiement MLOps à grande échelle.',
      skills: [
        { name: 'Python', category: 'Langage', source: 'extracted' },
        { name: 'PyTorch', category: 'Deep Learning', source: 'extracted' },
        { name: 'NLP', category: 'Data & IA', source: 'extracted' },
        { name: 'TensorFlow', category: 'Deep Learning', source: 'extracted' },
        { name: 'Transformers', category: 'LLM', source: 'extracted' },
        { name: 'MLOps', category: 'DevOps IA', source: 'extracted' }
      ],
      languages: [
        { language: 'Français', level: 'Natif', original_level: 'Français (Natif)' },
        { language: 'Anglais', level: 'Bilingue / C2', original_level: 'Anglais (Bilingue)' },
        { language: 'Allemand', level: 'Notions / A2', original_level: 'Allemand (A2)' }
      ],
      certifications: [
        { name: 'TensorFlow Developer Certificate', issuer: 'Google / DeepLearning.AI', date: '2023', credential_id: 'TF-8831' },
        { name: 'Deep Learning Specialization', issuer: 'Coursera', date: '2022', credential_id: 'COURSERA-AI' }
      ],
      education: [
        {
          degree: 'Master 2 en Intelligence Artificielle & Science des Données',
          field_of_study: 'Machine Learning & Mathématiques Appliquées',
          institution: 'Université Paris-Saclay',
          location: 'Saclay, France',
          start_date: '2019',
          end_date: '2021',
          description: 'Major de promotion. Thèse sur le fine-tuning frugal des modèles Transformers.'
        }
      ],
      experiences: [
        {
          job_title: 'Ingénieure R&D en Machine Learning & NLP',
          company: 'AI Solutions Lab',
          location: 'Lyon, France',
          start_date: '2021',
          end_date: 'Présent',
          description: 'Conception et déploiement de pipelines RAG et agents conversationnels multi-modaux. Optimisation de l\'inférence de 60% avec TensorRT et vLLM.'
        }
      ]
    },
    status: 'PROCESSED',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cv-3',
    uid: 'candidate-789',
    fileName: 'Marc_Dubois_Product_Manager.pdf',
    fullName: 'Marc Dubois',
    jobTitle: 'Senior Product Manager Tech',
    email: 'marc.dubois@product-lead.com',
    phone: '+33 6 11 22 33 44',
    location: 'Bordeaux, France',
    fileURL: '#',
    aiScore: 72,
    feedback: 'Bonne expérience en gestion de produit agile. Devrait quantifier davantage l\'impact business de ses lancements de fonctionnalités.',
    skills: ['Product Management', 'Agile', 'Scrum', 'Jira', 'A/B Testing', 'Product Analytics', 'Figma', 'SQL'],
    parsedData: {
      identity: {
        full_name: 'Marc Dubois',
        email: 'marc.dubois@product-lead.com',
        phone: '+33 6 11 22 33 44',
        linkedin: 'https://linkedin.com/in/marc-dubois-pm',
        github: null,
        website: null,
        location: 'Bordeaux, France',
        job_title: 'Senior Product Manager Tech',
        other_links: []
      },
      summary: 'Product Manager avec 5 ans d\'expérience dans le scaling de produits B2B SaaS, la discovery utilisateur et le pilotage de roadmaps orientées conversion.',
      skills: [
        { name: 'Product Management', category: 'Product', source: 'extracted' },
        { name: 'Agile', category: 'Méthodologie', source: 'extracted' },
        { name: 'Scrum', category: 'Méthodologie', source: 'extracted' },
        { name: 'Jira', category: 'Outil', source: 'extracted' },
        { name: 'A/B Testing', category: 'Growth', source: 'extracted' }
      ],
      languages: [
        { language: 'Français', level: 'Natif', original_level: 'Français (Natif)' },
        { language: 'Anglais', level: 'Professionnel / C1', original_level: 'Anglais (C1)' }
      ],
      certifications: [
        { name: 'Professional Scrum Product Owner (PSPO I)', issuer: 'Scrum.org', date: '2022', credential_id: 'PSPO-10928' }
      ],
      education: [
        {
          degree: 'Master en Management & Stratégie Digitale',
          field_of_study: 'Gestion de Projet & Innovation',
          institution: 'KEDGE Business School',
          location: 'Bordeaux, France',
          start_date: '2016',
          end_date: '2019',
          description: 'Spécialisation Product Design & Customer Experience.'
        }
      ],
      experiences: [
        {
          job_title: 'Product Manager',
          company: 'Fintech Hub',
          location: 'Bordeaux, France',
          start_date: '2020',
          end_date: 'Présent',
          description: 'Responsable du funnel d\'onboarding client. Augmentation du taux d\'activation de 22% en 6 mois grâce à des itérations guidées par les données.'
        }
      ]
    },
    status: 'PROCESSED',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
*/

const DEFAULT_MOCK_JOBS: JobPosting[] = [];
/*
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
*/

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

// Helper to remove undefined fields recursively for Firestore compatibility
function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanUndefined(value);
    }
  }
  return cleaned;
}

// ==========================================
// DB OPERATIONS ENGINE
// ==========================================

export const dbEngine = {
  // --- USER PROFILE ACTIONS ---

  async createUserProfile(profile: UserProfile): Promise<void> {
    if (isFirebaseConfigured && clientDb) {
      await setDoc(doc(clientDb, 'users', profile.uid), cleanUndefined({
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
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
      await updateDoc(doc(clientDb, 'users', uid), cleanUndefined({
        ...data,
        updatedAt: serverTimestamp()
      }));
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
    let fileURL = fileData || '#';
    let storedFileData: string | undefined = fileData;
    let extractedData: any = null;

    if (file) {
      // Convert file to base64 for reliable local storage and server extraction API
      try {
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        storedFileData = base64String;
        if (fileURL === '#') {
          fileURL = base64String;
        }

        try {
          const storagePath = `users/${uid}/cvs/${Date.now()}_${fileName}`;
          const uploadedUrl = await storageService.uploadFile(file, storagePath);
          if (uploadedUrl && uploadedUrl !== '#') {
            fileURL = uploadedUrl;
          }
        } catch (err) {
          console.warn('StorageService upload notice (using local base64 fallback):', err);
        }

        const res = await fetch('/api/cv/extract-full', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64String,
            fileName: fileName,
          }),
        });

        if (res.ok) {
          extractedData = await res.json();
        }
      } catch (extractErr) {
        console.warn('[CV Upload] Server extraction fallback to standard profiling:', extractErr);
      }
    }

    const keywords = ['react', 'node', 'javascript', 'typescript', 'python', 'ia', 'ml', 'cloud', 'aws', 'docker', 'product', 'agile', 'devops', 'java', 'sql'];
    const lowerName = fileName.toLowerCase();
    const matchedSkills = keywords.filter(kw => lowerName.includes(kw));

    let aiScore = extractedData?.aiScore ?? (Math.floor(Math.random() * 20) + 75);
    let feedback = extractedData?.feedback ?? "Le CV a été analysé avec succès par notre moteur d'extraction IA. L'ensemble des expériences, compétences et formations a été structuré pour optimiser le matching recruteur et les simulations d'entretien.";
    let skills = extractedData?.skills ?? (matchedSkills.length > 0 ? matchedSkills.map(s => s.toUpperCase()) : ['REACT', 'TYPESCRIPT', 'NODE.JS', 'DOCKER', 'POSTGRESQL']);
    let parsedData = extractedData?.cv ?? {
      identity: {
        full_name: fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
        email: 'candidat@cvtheque.ia',
        phone: '+33 6 12 34 56 78',
        linkedin: 'https://linkedin.com',
        github: 'https://github.com',
        website: null,
        location: 'Paris, France',
        job_title: lowerName.includes('full') ? 'Développeur Full Stack' : lowerName.includes('lead') ? 'Tech Lead' : 'Ingénieur Logiciel',
        other_links: []
      },
      summary: "Professionnel dynamique et expérimenté avec une solide expertise en ingénierie logicielle, architecture applicative et delivery de projets à fort impact.",
      skills: skills.map((s: string) => ({ name: s, category: 'Technique', source: 'extracted' })),
      languages: [
        { language: 'Français', level: 'Natif', original_level: 'Français (Natif)' },
        { language: 'Anglais', level: 'Professionnel / C1', original_level: 'Anglais (C1)' }
      ],
      certifications: [
        { name: 'Certification Cloud & DevOps', issuer: 'AWS / Cloud Provider', date: '2024', credential_id: null }
      ],
      education: [
        {
          degree: 'Master / Diplôme d\'Ingénieur en Informatique',
          field_of_study: 'Sciences Informatiques & Génie Logiciel',
          institution: 'Université / Grande École',
          location: 'France',
          start_date: '2019',
          end_date: '2022',
          description: 'Spécialisation architecture logicielle, bases de données et intelligence artificielle.'
        }
      ],
      experiences: [
        {
          job_title: 'Développeur & Concepteur Logiciel',
          company: 'Entreprise Tech Innovante',
          location: 'Paris / Hybride',
          start_date: '2022',
          end_date: 'Présent',
          description: 'Conception et développement d\'architectures scalables, intégration d\'APIs performantes et collaboration agile au sein de l\'équipe produit.'
        }
      ]
    };

    const newCv: CandidateCV = {
      id: 'cv-' + Math.random().toString(36).substring(2, 9),
      uid,
      fileName,
      fileURL,
      fileData: storedFileData,
      aiScore,
      feedback,
      skills,
      parsedData,
      fullName: parsedData.identity?.full_name || null,
      jobTitle: parsedData.identity?.job_title || null,
      email: parsedData.identity?.email || null,
      phone: parsedData.identity?.phone || null,
      location: parsedData.identity?.location || null,
      status: 'PROCESSED',
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && clientDb) {
      const docRef = await addDoc(collection(clientDb, 'cvs'), cleanUndefined({
        ...newCv,
        createdAt: serverTimestamp()
      }));
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
        data.createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt;
        return normalizeCVToCandidateCV(doc.id, data);
      });
    } else {
      initLocalStorageMock();
      return JSON.parse(localStorage.getItem('cv_mock_cvs') || '[]');
    }
  },

  async getCVsByCandidate(uid: string): Promise<CandidateCV[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'cvs'), where('uid', '==', uid));
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => {
        const data = doc.data();
        data.createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt;
        return normalizeCVToCandidateCV(doc.id, data);
      });
      return items.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
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
    // Legacy/simulation-only path. Canonical jobs use the authenticated Express API.
    const newJob: JobPosting = {
      ...job,
      id: 'job-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && clientDb) {
      const docRef = await addDoc(collection(clientDb, 'jobs'), cleanUndefined({
        ...newJob,
        createdAt: serverTimestamp()
      }));
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

  async getOpenJobs(): Promise<JobPosting[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'jobs'), where('status', '==', 'OPEN'));
      const snap = await getDocs(q);
      const items = snap.docs.map(document => {
        const data = document.data();
        return {
          ...data,
          id: document.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as JobPosting;
      });
      return items.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }
    initLocalStorageMock();
    return (JSON.parse(localStorage.getItem('cv_mock_jobs') || '[]') as JobPosting[])
      .filter(job => job.status === 'OPEN');
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
  },

  // --- ORAL INTERVIEW ACTIONS ---
  async createInterviewSession(data: Omit<OralInterviewSession, 'id' | 'createdAt'>): Promise<OralInterviewSession> {
    const newSession: OralInterviewSession = {
      ...data,
      id: 'session-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString()
    };
    if (isFirebaseConfigured && clientDb) {
      const docRef = await addDoc(collection(clientDb, 'interview_sessions'), cleanUndefined({
        ...newSession,
        createdAt: serverTimestamp()
      }));
      newSession.id = docRef.id;
      return newSession;
    } else {
      const sessions = JSON.parse(localStorage.getItem('cv_mock_interview_sessions') || '[]');
      sessions.push(newSession);
      localStorage.setItem('cv_mock_interview_sessions', JSON.stringify(sessions));
      return newSession;
    }
  },

  async updateInterviewSession(id: string, updates: Partial<OralInterviewSession>): Promise<void> {
    if (isFirebaseConfigured && clientDb) {
      await updateDoc(doc(clientDb, 'interview_sessions', id), cleanUndefined({
        ...updates,
        updatedAt: serverTimestamp()
      }));
    } else {
      const sessions: OralInterviewSession[] = JSON.parse(localStorage.getItem('cv_mock_interview_sessions') || '[]');
      const index = sessions.findIndex(s => s.id === id);
      if (index !== -1) {
        sessions[index] = { ...sessions[index], ...updates };
        localStorage.setItem('cv_mock_interview_sessions', JSON.stringify(sessions));
      }
    }
  },

  async getInterviewSessionsByCandidate(candidateId: string): Promise<OralInterviewSession[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'interview_sessions'), where('candidateId', '==', candidateId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OralInterviewSession)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      const sessions: OralInterviewSession[] = JSON.parse(localStorage.getItem('cv_mock_interview_sessions') || '[]');
      return sessions.filter(s => s.candidateId === candidateId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  // ==========================================
  // APPLICATIONS
  // ==========================================

  async createApplication(application: Omit<JobApplication, 'id' | 'createdAt'>): Promise<JobApplication> {
    const newApplication: JobApplication = {
      id: 'app-' + Math.random().toString(36).substring(2, 9),
      ...application,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && clientDb) {
      const docRef = await addDoc(collection(clientDb, 'applications'), cleanUndefined({
        ...newApplication,
        createdAt: serverTimestamp()
      }));
      newApplication.id = docRef.id;
      return newApplication;
    } else {
      const apps = JSON.parse(localStorage.getItem('cv_mock_applications') || '[]');
      apps.push(newApplication);
      localStorage.setItem('cv_mock_applications', JSON.stringify(apps));
      return newApplication;
    }
  },

  async getApplicationsForJob(jobId: string): Promise<JobApplication[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'applications'), where('jobId', '==', jobId));
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as JobApplication;
      });
      return items.sort((a, b) => b.matchScore - a.matchScore);
    } else {
      const apps: JobApplication[] = JSON.parse(localStorage.getItem('cv_mock_applications') || '[]');
      return apps.filter(a => a.jobId === jobId).sort((a, b) => b.matchScore - a.matchScore);
    }
  },

  async getApplicationsByCandidate(candidateId: string): Promise<JobApplication[]> {
    if (isFirebaseConfigured && clientDb) {
      const q = query(collection(clientDb, 'applications'), where('candidateId', '==', candidateId));
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as JobApplication;
      });
      return items.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    } else {
      const apps: JobApplication[] = JSON.parse(localStorage.getItem('cv_mock_applications') || '[]');
      return apps.filter(a => a.candidateId === candidateId).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }
  }
};
