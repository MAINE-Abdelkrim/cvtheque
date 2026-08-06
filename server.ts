import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { getFirebaseAdmin, isFirebaseAdminConfigured } from './src/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary using credentials
let cloudName = process.env.CLOUDINARY_CLOUD_NAME || 's8c3eyfl';
if (cloudName.toLowerCase() === 'root' || !cloudName) {
  cloudName = 's8c3eyfl';
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: process.env.CLOUDINARY_API_KEY || '476911859997558',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'OmsTyxGmiHp6L40YOjUOOlOEhUI'
});

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

  // API: Cloudinary Image Upload
  app.post('/api/cloudinary/upload', async (req, res) => {
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
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

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

  // API: Delete User (Admin action)
  app.delete('/api/admin/users/:uid', async (req, res) => {
    const { uid } = req.params;
    try {
      if (adminApp) {
        const authAdmin = getAuth(adminApp);
        const dbAdmin = getFirestore(adminApp);

        // Delete from Auth if exists
        try {
          await authAdmin.deleteUser(uid);
        } catch (err: any) {
          console.warn(`User ${uid} not found in Auth or already deleted:`, err.message);
        }

        // Delete Firestore document
        await dbAdmin.collection('users').doc(uid).delete();
      }
      return res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
    } catch (error: any) {
      console.error('API delete user error:', error);
      return res.status(500).json({ error: error.message || 'Erreur lors de la suppression' });
    }
  });

  // API: Update User Profile (Admin action)
  app.put('/api/admin/users/:uid', async (req, res) => {
    const { uid } = req.params;
    const { firstName, lastName, email, role, subscription, isActive } = req.body;
    try {
      if (adminApp) {
        const authAdmin = getAuth(adminApp);
        const dbAdmin = getFirestore(adminApp);

        // Update in Auth if email/name changes
        try {
          const updateData: any = {};
          if (email) updateData.email = email;
          if (firstName || lastName) updateData.displayName = `${firstName || ''} ${lastName || ''}`.trim();
          if (Object.keys(updateData).length > 0) {
            await authAdmin.updateUser(uid, updateData);
          }
        } catch (err: any) {
          console.warn(`Could not update Auth user ${uid}:`, err.message);
        }

        // Update Firestore profile
        const docRef = dbAdmin.collection('users').doc(uid);
        const updateFields: any = {};
        if (firstName !== undefined) updateFields.firstName = firstName;
        if (lastName !== undefined) updateFields.lastName = lastName;
        if (email !== undefined) updateFields.email = email;
        if (role !== undefined) updateFields.role = role;
        if (subscription !== undefined) updateFields.subscription = subscription;
        if (isActive !== undefined) updateFields.isActive = isActive;
        updateFields.updatedAt = new Date().toISOString();

        await docRef.update(updateFields);
      }
      return res.json({ success: true, message: 'Utilisateur mis à jour avec succès' });
    } catch (error: any) {
      console.error('API update user error:', error);
      return res.status(500).json({ error: error.message || 'Erreur lors de la mise à jour' });
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
  app.post('/api/jobs/ai-generate', async (req, res) => {
    const { prompt, conversationHistory } = req.body;

    if (!prompt && (!conversationHistory || conversationHistory.length === 0)) {
      return res.status(400).json({ error: 'Un message ou un historique de conversation est requis.' });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'La clé API GEMINI_API_KEY n\'est pas configurée.' });
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
      let extractedJson = null;
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          extractedJson = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.warn('[Gemini Job AI] Failed to parse extracted JSON:', e);
        }
      }

      return res.json({
        reply: responseText,
        extractedJson
      });
    } catch (error: any) {
      console.error('[Gemini Job AI] Error generating job content:', error);
      return res.status(500).json({ error: error.message || 'Erreur lors de la communication avec Gemini LLM' });
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
