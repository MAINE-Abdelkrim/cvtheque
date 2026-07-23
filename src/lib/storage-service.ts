export interface StorageService {
  /**
   * Uploads a file or binary blob to the designated storage path.
   * Returns a promise resolving to the public/accessible URL of the uploaded file.
   */
  uploadFile(file: File | Blob, path: string): Promise<string>;

  /**
   * Deletes a file located at the specified storage path.
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Retrieves the secure/public URL of the file located at the specified path.
   */
  getFileUrl(path: string): Promise<string>;
}

/**
 * High-fidelity Client-Side Mock Storage Service.
 * Allows Sprint 1 to run completely offline/mocked or alongside Firestore.
 * Utilizes base64 encoding and object URLs to provide a fully functional local experience.
 */
export class LocalMockStorageService implements StorageService {
  private fileStore = new Map<string, { dataUrl: string; blobUrl: string }>();

  async uploadFile(file: File | Blob, path: string): Promise<string> {
    console.group(`[LocalMockStorageService] Uploading file`);
    console.log(`Path: ${path}`);
    console.log(`Size: ${file.size} bytes`);
    console.log(`Type: ${file.type}`);
    console.groupEnd();

    // Create standard object URL for local previewing during the current session
    const blobUrl = URL.createObjectURL(file);

    // Also read as a data URL (base64) so it can theoretically persist in memory/local storage if desired
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        this.fileStore.set(path, { dataUrl, blobUrl });
        resolve(blobUrl); // Return the blobUrl for immediate, safe, local download/viewing
      };
      reader.onerror = () => {
        reject(new Error('Erreur lors du décodage binaire du fichier simulé.'));
      };
      reader.readAsDataURL(file);
    });
  }

  async deleteFile(path: string): Promise<void> {
    console.log(`[LocalMockStorageService] Deleting file at: ${path}`);
    const fileData = this.fileStore.get(path);
    if (fileData) {
      URL.revokeObjectURL(fileData.blobUrl);
      this.fileStore.delete(path);
    }
  }

  async getFileUrl(path: string): Promise<string> {
    const fileData = this.fileStore.get(path);
    if (fileData) {
      return fileData.blobUrl;
    }
    // Return a beautiful generic mock resume URL if not found, to make the UI populated and fully styled
    return `https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=1200&auto=format&fit=crop`;
  }
}

/**
 * Placeholder for future Firebase Storage integration.
 * In a future sprint, this will be populated with the actual Firebase Storage SDK imports
 * and API calls, and swapped into the exported storageService.
 */
export class FirebaseStorageService implements StorageService {
  async uploadFile(file: File | Blob, path: string): Promise<string> {
    throw new Error(
      'Service de stockage Firebase non implémenté pour le Sprint 1. Les fichiers sont gérés par le LocalMockStorageService.'
    );
  }

  async deleteFile(path: string): Promise<void> {
    throw new Error(
      'Service de stockage Firebase non implémenté pour le Sprint 1. Les fichiers sont gérés par le LocalMockStorageService.'
    );
  }

  async getFileUrl(path: string): Promise<string> {
    throw new Error(
      'Service de stockage Firebase non implémenté pour le Sprint 1. Les fichiers sont gérés par le LocalMockStorageService.'
    );
  }
}

/**
 * Cloudinary Secure Storage Service.
 * Uploads files to our Node.js server endpoint which safely proxies to Cloudinary.
 */
export class CloudinaryStorageService implements StorageService {
  async uploadFile(file: File | Blob, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        try {
          const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : 'general';
          const response = await fetch('/api/cloudinary/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file: base64data,
              path: folder
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Erreur lors de l'upload de l'image.");
          }

          const data = await response.json();
          if (data.success && data.url) {
            resolve(data.url);
          } else {
            throw new Error('URL de retour invalide.');
          }
        } catch (error: any) {
          reject(error);
        }
      };
      reader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier.'));
      };
      reader.readAsDataURL(file);
    });
  }

  async deleteFile(path: string): Promise<void> {
    console.log(`[CloudinaryStorageService] Supprimer le fichier au chemin : ${path}`);
  }

  async getFileUrl(path: string): Promise<string> {
    return path;
  }
}

// Current operational service exports.
// Swap between LocalMockStorageService and CloudinaryStorageService by editing this line.
export const storageService: StorageService = new CloudinaryStorageService();
