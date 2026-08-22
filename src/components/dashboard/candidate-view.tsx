import React, { useEffect, useRef, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CandidateJobsList } from '../candidate/candidate-jobs-list';
import { CVUploadPanel } from '../candidate/cv-upload-panel';
import { CVStructuredResult } from '../cv/cv-structured-result';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { PageHeader, SectionHeader } from '../ui/page-header';
import { CVParserClientError, getCurrentCandidateCV, parseCandidateCV, validateCandidateCVFile } from '../../lib/api/cv-parser-client';
import { dbEngine } from '../../lib/firebase/db';
import { useAuth } from '../../providers/auth-provider';
import type { CandidateCV, JobPosting } from '../../types';
import type { CVParserSafeResponse, CVUploadStatus } from '../../types/cv-parser';

export const CandidateView: React.FC = () => {
  const { profile } = useAuth();
  const [legacyCvs, setLegacyCvs] = useState<CandidateCV[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCVLoading, setCurrentCVLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<CVUploadStatus>('idle');
  const [parseResult, setParseResult] = useState<CVParserSafeResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const replacementStartedRef = useRef(false);

  const loadCandidateData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [cvRecords, openJobs] = await Promise.all([
        dbEngine.getCVsByCandidate(profile.uid),
        dbEngine.getOpenJobs(),
      ]);
      setLegacyCvs(cvRecords);
      setJobs(openJobs);
    } catch {
      toast.error('Erreur lors du chargement de votre espace candidat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCandidateData();
    let active = true;
    setCurrentCVLoading(true);
    void getCurrentCandidateCV()
      .then(result => { if (active && !replacementStartedRef.current && result) { setParseResult(result); setUploadStatus('success'); } })
      .catch(() => { if (active) toast.error('Impossible de charger votre CV actuel. Vous pouvez néanmoins en ajouter un nouveau.'); })
      .finally(() => { if (active) setCurrentCVLoading(false); });
    return () => { active = false; };
  }, [profile]);

  const selectFile = (file: File) => {
    setUploadStatus('validating');
    setUploadError(null);
    try {
      validateCandidateCVFile(file);
      setSelectedFile(file);
      setUploadStatus('selected');
    } catch (error) {
      setSelectedFile(null);
      setUploadStatus('error');
      setUploadError(error instanceof CVParserClientError ? error.message : 'Le fichier sélectionné est invalide.');
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadError(null);
    setUploadStatus(parseResult ? 'success' : 'idle');
  };

  const handleCVParse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setUploadError('Sélectionnez un PDF avant de lancer l’analyse.');
      return;
    }
    const controller = new AbortController();
    replacementStartedRef.current = true;
    uploadAbortRef.current = controller;
    setUploadError(null);
    setUploadStatus('uploading');
    try {
      const pending = parseCandidateCV(selectedFile, controller.signal);
      setUploadStatus('parsing');
      const result = await pending;
      setParseResult(result);
      setSelectedFile(null);
      setUploadStatus('success');
      toast.success('Votre CV a été analysé et enregistré.');
      await loadCandidateData();
    } catch (error) {
      const cancelled = error instanceof CVParserClientError && error.code === 'CANCELLED';
      const message = error instanceof Error ? error.message : "Le CV n'a pas pu être analysé.";
      setUploadStatus(cancelled ? 'cancelled' : 'error');
      setUploadError(message);
      if (!cancelled) toast.error(message);
    } finally {
      uploadAbortRef.current = null;
    }
  };

  const handleDeleteLegacyCv = async (id: string) => {
    try {
      await dbEngine.deleteCV(id);
      toast.success('Ancien CV retiré de votre espace.');
      await loadCandidateData();
    } catch {
      toast.error('Impossible de retirer cet ancien CV.');
    }
  };

  if (!profile) return null;

  return <div className="space-y-10">
    <PageHeader title="Mon espace candidat" description="Gérez votre CV et consultez les offres disponibles." />

    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <SectionHeader title="Mon CV" description={parseResult ? 'Votre profil structuré est à jour.' : 'Ajoutez un PDF pour créer votre profil professionnel.'} />
        <Badge tone={parseResult ? 'success' : 'neutral'}>{parseResult ? 'Enregistré' : 'À ajouter'}</Badge>
      </CardHeader>
      <CardContent>
        <CVUploadPanel
          selectedFile={selectedFile}
          status={uploadStatus}
          error={uploadError}
          isDragging={isDragging}
          hasCurrentCV={Boolean(parseResult)}
          fileInputRef={fileInputRef}
          onFileChange={selectFile}
          onClearFile={clearSelectedFile}
          onSubmit={handleCVParse}
          onCancel={() => uploadAbortRef.current?.abort()}
          onDragStateChange={setIsDragging}
        />
      </CardContent>
    </Card>

    {parseResult && <CVStructuredResult result={parseResult} />}
    {!parseResult && currentCVLoading && <LoadingSkeleton variant="list" />}

    {!parseResult && !loading && legacyCvs.length > 0 && <Card>
      <CardHeader><SectionHeader title="Anciens fichiers" description="Enregistrements conservés uniquement pour compatibilité." /></CardHeader>
      <CardContent className="space-y-2">
        {legacyCvs.map(cv => <div key={cv.id} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3"><FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" /><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--foreground)]">{cv.fileName}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Déposé le {new Date(cv.createdAt).toLocaleDateString('fr-FR')}</p></div></div>
          <Button variant="ghost" size="sm" onClick={() => handleDeleteLegacyCv(cv.id)} aria-label={`Retirer ${cv.fileName}`}><Trash2 className="h-4 w-4" /></Button>
        </div>)}
      </CardContent>
    </Card>}

    <CandidateJobsList jobs={jobs} loading={loading} />
  </div>;
};
