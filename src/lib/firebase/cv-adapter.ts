import { CandidateCV } from '../../types';
import { CanonicalPersistedCV } from '../../types/cv-parser';

export function normalizeCVToCandidateCV(id: string, data: any): CandidateCV {
  const isCanonical = data.parsing?.schemaVersion === 1;

  if (isCanonical) {
    const canonical = data as CanonicalPersistedCV;
    return {
      id: id,
      uid: canonical.uid,
      fileName: canonical.file?.originalName || 'document.pdf',
      fileURL: undefined,
      aiScore: 85, // Default or calculate from canonical
      feedback: "CV Analysé (v1)",
      skills: canonical.parsedData?.skills?.map(s => s.name) || [],
      parsedData: canonical.parsedData,
      fullName: canonical.parsedData?.identity?.full_name || null,
      jobTitle: canonical.parsedData?.identity?.job_title || null,
      email: canonical.parsedData?.identity?.email || null,
      phone: canonical.parsedData?.identity?.phone || null,
      location: canonical.parsedData?.identity?.location || null,
      status: canonical.status === 'PROCESSED' ? 'PROCESSED' : 'PENDING',
      createdAt: canonical.createdAt,
    };
  }

  // Fallback for old documents
  return {
    id: id,
    uid: data.uid,
    fileName: data.fileName || 'document.pdf',
    fileURL: data.fileURL,
    aiScore: data.aiScore,
    feedback: data.feedback,
    skills: data.skills || [],
    parsedData: data.parsedData,
    fullName: data.fullName || data.parsedData?.identity?.full_name || null,
    jobTitle: data.jobTitle || data.parsedData?.identity?.job_title || null,
    email: data.email || data.parsedData?.identity?.email || null,
    phone: data.phone || data.parsedData?.identity?.phone || null,
    location: data.location || data.parsedData?.identity?.location || null,
    status: data.status || 'PROCESSED',
    createdAt: data.createdAt,
  };
}
