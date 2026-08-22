import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { getFirebaseAdmin, isFirebaseAdminConfigured } from './src/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { v2 as cloudinary } from 'cloudinary';
import { createRequireCandidate } from './src/server/cv-auth';
import { createCurrentCVHandler, createCVParseHandler } from './src/server/cv-route';
import { createRequireRecruiter } from './src/server/recruiter-auth';
import { createCandidateOpenJobsHandler, createJobCreateHandler, createJobDeleteHandler, createMyJobsHandler } from './src/server/job-route';
import { extractValidatedGeminiDraft } from './src/server/job-ai';
import { createJobMatchingHandler } from './src/server/matching-route';
import { createRequireAdmin } from './src/server/admin-auth';
import { createAdminUserCreateHandler, createAdminUserDeleteHandler, createAdminUserUpdateHandler } from './src/server/admin-user-route';
import { publicRegistrationSchema } from './src/types/admin';
import {
  createInterviewAnswerHandler,
  createInterviewCancelHandler,
  createInterviewGetHandler,
  createInterviewHistoryHandler,
  createInterviewReportHandler,
  createInterviewStartHandler,
} from './src/server/interview-route';

// Configure Cloudinary using credentials
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing with support for larger files (base64 images)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Firebase Admin Reference
  const adminApp = getFirebaseAdmin();

  // ==========================================
  // BACKEND API ROUTES
  // ==========================================

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      firebaseAdmin: isFirebaseAdminConfigured ? 'configured' : 'simulation_mode',
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/cv/parse', createRequireCandidate(), createCVParseHandler());
  app.get('/api/cv/current', createRequireCandidate(), createCurrentCVHandler());
  app.post('/api/interviews', createRequireCandidate(), createInterviewStartHandler());
  app.get('/api/interviews', createRequireCandidate(), createInterviewHistoryHandler());
  app.get('/api/interviews/:sessionId', createRequireCandidate(), createInterviewGetHandler());
  app.post('/api/interviews/:sessionId/answers', createRequireCandidate(), createInterviewAnswerHandler());
  app.post('/api/interviews/:sessionId/cancel', createRequireCandidate(), createInterviewCancelHandler());
  app.get('/api/interviews/:sessionId/report', createRequireCandidate(), createInterviewReportHandler());
  app.get('/api/jobs/open', createRequireCandidate(), createCandidateOpenJobsHandler());
  app.post('/api/jobs', createRequireRecruiter(), createJobCreateHandler());
  app.get('/api/jobs/mine', createRequireRecruiter(), createMyJobsHandler());
  app.delete('/api/jobs/:jobId', createRequireRecruiter(), createJobDeleteHandler());
  app.post('/api/jobs/:jobId/match', createRequireRecruiter(), createJobMatchingHandler());
  app.post('/api/admin/users', createRequireAdmin(), createAdminUserCreateHandler());
  app.put('/api/admin/users/:uid', createRequireAdmin(), createAdminUserUpdateHandler());
  app.delete('/api/admin/users/:uid', createRequireAdmin(), createAdminUserDeleteHandler());

  // API: Cloudinary Image Upload
  app.post('/api/cloudinary/upload', async (req, res) => {
    if (!cloudinaryConfigured) {
      return res.status(503).json({ error: 'Le service de stockage d\'images n\'est pas configuré.' });
    }
    const { file, path: folderPath } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'Fichier image (base64 ou URL) requis' });
    }

    try {
      console.log(`[Cloudinary API] Uploading profile image to: ${folderPath || 'avatars'}`);
      const uploadResult = await cloudinary.uploader.upload(file, {
        folder: folderPath || 'avatars'
      });

      console.log(`[Cloudinary API] Upload success: ${uploadResult.secure_url}`);
      return res.json({
        success: true,
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height
      });
    } catch (error: any) {
      console.error('[Cloudinary API] Upload error:', error);
      return res.status(500).json({ error: error.message || 'Erreur lors de l\'upload sur Cloudinary' });
    }
  });

  // API: Register User
  app.post('/api/auth/register', async (req, res) => {
    const parsed = publicRegistrationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'REGISTRATION_VALIDATION_FAILED', message: 'Les informations d’inscription sont invalides.', details: [] } });
    const { email, password, firstName, lastName, role } = parsed.data;

    try {
      if (adminApp) {
        const authAdmin = getAuth(adminApp);
        const dbAdmin = getFirestore(adminApp);

        // Create Auth User
        const userRecord = await authAdmin.createUser({
          email,
          password,
          displayName: `${firstName} ${lastName}`
        });

        // Create User Profile in Firestore
        const newProfile = {
          uid: userRecord.uid,
          firstName,
          lastName,
          email,
          role: role || 'CANDIDATE',
          subscription: 'FREE',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await dbAdmin.collection('users').doc(userRecord.uid).set(newProfile);

        return res.status(201).json({
          message: 'Utilisateur créé avec succès via Firebase Admin',
          uid: userRecord.uid,
          user: newProfile
        });
      } else {
        // Fallback simulation register
        const simulatedUid = 'sim-' + Math.random().toString(36).substring(2, 9);
        const newProfile = {
          uid: simulatedUid,
          firstName,
          lastName,
          email,
          role: role || 'CANDIDATE',
          subscription: 'FREE',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        return res.status(201).json({
          message: 'Utilisateur créé avec succès (Mode Simulation)',
          uid: simulatedUid,
          user: newProfile
        });
      }
    } catch (error: any) {
      console.error('API register error:', error);
      return res.status(500).json({ error: error.message || 'Erreur lors de la création de l\'utilisateur' });
    }
  });

  // API: Login mock/proxy
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    return res.json({
      success: true,
      message: 'Login vérifié avec succès',
      email,
      mode: adminApp ? 'firebase_production' : 'simulation'
    });
  });

  // API: Logout proxy
  app.post('/api/auth/logout', (req, res) => {
    return res.json({
      success: true,
      message: 'Logout complété avec succès'
    });
  });

  // API: Gemini LLM Job Creation Assistant
  app.post('/api/jobs/ai-generate', createRequireRecruiter(), async (req: any, res) => {
    if (req.recruiter?.subscription !== 'PREMIUM') {
      return res.status(403).json({ error: { code: 'PREMIUM_REQUIRED', message: 'A Premium recruiter subscription is required.', details: [] } });
    }
    const { prompt, conversationHistory } = req.body ?? {};

    if (typeof prompt !== 'string' || !prompt.trim() || (conversationHistory !== undefined && !Array.isArray(conversationHistory))) {
      return res.status(400).json({ error: { code: 'AI_REQUEST_INVALID', message: 'A valid recruiter message is required.', details: [] } });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: { code: 'AI_UNAVAILABLE', message: 'The AI assistant is temporarily unavailable.', details: [] } });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `Tu es un assistant expert en recrutement et IA RH pour la plateforme CVthèque IA.
Ton rôle est d'échanger avec le recruteur pour définir sa fiche de poste idéale, puis d'extraire systématiquement les paramètres structurés dans un format JSON valide.

Chaque réponse doit contenir des conseils clairs en français pour le recruteur, ET lorsqu'une description de poste se dessine (même partielle), tu DOIS ajouter le bloc JSON structuré exact sous le format suivant à la toute fin de ton message :

\`\`\`json
{
  "job_id": "job-456",
  "job_title": "Backend Developer",
  "company": "Nom de l'entreprise",
  "description": "Nous recherchons un développeur backend chevronné...",
  "required_skills": ["Python", "FastAPI", "PostgreSQL"],
  "preferred_skills": ["Docker", "AWS"],
  "minimum_experience_years": 3,
  "maximum_experience_years": null,
  "required_education": {
    "minimum_level": "Master",
    "preferred_fields": ["Computer Science", "Software Engineering"],
    "mandatory": false
  },
  "required_languages": [
    {
      "name": "French",
      "minimum_level": "fluent",
      "mandatory": true
    },
    {
      "name": "English",
      "minimum_level": "intermediate",
      "mandatory": false
    }
  ],
  "location": "Casablanca",
  "remote_allowed": true,
  "work_mode": "hybrid",
  "contract_type": "CDI",
  "mandatory_requirements": ["Disponibilité immédiate"],
  "scoring_weights": null
}
\`\`\`

Reste courtois, précis, et aide le recruteur à affiner sa recherche. Réponds toujours en français.`;

      const contents: any[] = [];
      if (conversationHistory && Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        }
      }
      if (prompt) {
        contents.push({
          role: 'user',
          parts: [{ text: prompt }]
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      const responseText = response.text || '';

      // Extract JSON block
      const extracted = extractValidatedGeminiDraft(responseText);

      return res.json({
        reply: responseText,
        extractedJson: extracted.draft,
        extractedJsonError: extracted.invalid,
      });
    } catch (error: any) {
      console.error('[Gemini Job AI] generation failed', { errorName: error instanceof Error ? error.name : 'unknown' });
      return res.status(502).json({ error: { code: 'AI_GENERATION_FAILED', message: 'The AI assistant could not generate a response.', details: [] } });
    }
  });

  // API: Get active session profile (User details)
  app.get('/api/auth/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié. Token Bearer requis.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      if (adminApp && token && token !== 'simulated-token') {
        const authAdmin = getAuth(adminApp);
        const decodedToken = await authAdmin.verifyIdToken(token);
        const userRecord = await authAdmin.getUser(decodedToken.uid);
        const dbAdmin = getFirestore(adminApp);
        const userDoc = await dbAdmin.collection('users').doc(decodedToken.uid).get();

        if (userDoc.exists) {
          return res.json({ user: userDoc.data() });
        } else {
          return res.json({
            user: {
              uid: decodedToken.uid,
              email: decodedToken.email,
              firstName: userRecord.displayName?.split(' ')[0] || 'Prénom',
              lastName: userRecord.displayName?.split(' ').slice(1).join(' ') || 'Nom',
              role: 'CANDIDATE',
              subscription: 'FREE',
              isActive: true
            }
          });
        }
      } else {
        // Mock session decode
        return res.json({
          user: {
            uid: 'candidate-123',
            email: 'candidate@cvtheque.ai',
            firstName: 'Alexandre',
            lastName: 'Bernard',
            role: 'CANDIDATE',
            subscription: 'FREE',
            isActive: true
          }
        });
      }
    } catch (error: any) {
      return res.status(401).json({ error: 'Token invalide: ' + error.message });
    }
  });

  // API: Get current profile details (Direct user profiling)
  app.get('/api/users/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    return res.json({
      uid: 'candidate-123',
      email: 'candidate@cvtheque.ai',
      firstName: 'Alexandre',
      lastName: 'Bernard',
      role: 'CANDIDATE',
      subscription: 'FREE',
      isActive: true,
      message: 'Profil récupéré via API direct router'
    });
  });

  // ==========================================
  // VITE DEVELOPMENT MIDDLEWARE & SPA FALLBACK
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CVthèque IA] Server running on http://localhost:${PORT}`);
  });
}

startServer();
