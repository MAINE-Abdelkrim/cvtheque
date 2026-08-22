import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { deleteCanonicalJob, getMyCanonicalJobs } from '../../lib/api/job-client';
import { matchJobCandidates, MatchingApiError } from '../../lib/api/matching';
import { isFirebaseConfigured } from '../../lib/firebase/client';
import { dbEngine } from '../../lib/firebase/db';
import { useAuth } from '../../providers/auth-provider';
import type { JobPosting } from '../../types';
import type { RecruiterMatchingResponse } from '../../types/matching';
import { RecruiterJobsList } from '../recruiter/recruiter-jobs-list';
import { MatchingResults } from '../recruiter/matching-results';
import { SelectedJobPanel } from '../recruiter/selected-job-panel';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { PageHeader } from '../ui/page-header';

interface RecruiterViewProps { onNavigate?: (path: string) => void; }

export const RecruiterView: React.FC<RecruiterViewProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [matchingResult, setMatchingResult] = useState<RecruiterMatchingResponse | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const selectedJob = useMemo(() => jobs.find(job => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  const navigateToCreate = () => onNavigate?.('/dashboard/recruiter/create-job');

  const loadData = async () => {
    setLoading(true);
    try {
      const jobsData = await (isFirebaseConfigured
        ? getMyCanonicalJobs()
        : dbEngine.getAllJobs().then(items => items.filter(job => job.recruiterId === profile?.uid)));
      setJobs(jobsData);
    } catch {
      toast.error('Erreur lors du chargement de vos offres.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const selectJob = (id: string) => {
    setSelectedJobId(id);
    setMatchingResult(null);
    setMatchingError(null);
  };

  const confirmDelete = async () => {
    if (!jobToDelete || deleting) return;
    setDeleting(true);
    try {
      if (jobToDelete.schemaVersion === 1) await deleteCanonicalJob(jobToDelete.id);
      else await dbEngine.deleteJob(jobToDelete.id);
      if (selectedJobId === jobToDelete.id) {
        setSelectedJobId(null);
        setMatchingResult(null);
        setMatchingError(null);
      }
      setJobToDelete(null);
      toast.success("Offre d'emploi supprimée.");
      await loadData();
    } catch {
      toast.error('Erreur lors de la suppression.');
    } finally {
      setDeleting(false);
    }
  };

  const handleMatchCandidates = async () => {
    if (!selectedJobId || matchingLoading) return;
    setMatchingLoading(true);
    setMatchingError(null);
    setMatchingResult(null);
    try {
      setMatchingResult(await matchJobCandidates(selectedJobId));
    } catch (error) {
      const message = error instanceof MatchingApiError
        ? ({
          AUTH_REQUIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
          JOB_NOT_FOUND: "Cette offre n'est plus disponible ou ne vous appartient pas.",
          JOB_NOT_OPEN: 'Cette offre est fermée et ne peut plus être analysée.',
          MATCHING_ENGINE_UNAVAILABLE: 'Le service de matching est temporairement indisponible.',
          MATCHING_ENGINE_TIMEOUT: "L'analyse a dépassé le délai autorisé. Réessayez plus tard.",
        }[error.code] ?? 'Le matching n’a pas pu être réalisé. Réessayez plus tard.')
        : 'Le matching n’a pas pu être réalisé. Réessayez plus tard.';
      setMatchingError(message);
      toast.error(message);
    } finally {
      setMatchingLoading(false);
    }
  };

  return <div className="space-y-8">
    <PageHeader title="Espace recruteur" description="Gérez vos offres et identifiez les profils les plus adaptés." actions={<Button onClick={navigateToCreate}><Plus className="h-4 w-4" />Créer une offre</Button>} />

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.5fr)]">
      <RecruiterJobsList jobs={jobs} loading={loading} selectedId={selectedJobId} onSelect={selectJob} onDelete={setJobToDelete} onCreate={navigateToCreate} />
      <div className="min-w-0 space-y-6">
        <SelectedJobPanel job={selectedJob} matching={matchingLoading} onMatch={handleMatchCandidates} />
        <MatchingResults loading={matchingLoading} error={matchingError} result={matchingResult} hasSelection={Boolean(selectedJob)} />
      </div>
    </div>

    <Dialog
      open={Boolean(jobToDelete)}
      onClose={() => !deleting && setJobToDelete(null)}
      title="Supprimer cette offre ?"
      description="Cette action supprimera définitivement l’offre."
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setJobToDelete(null)} disabled={deleting}>Annuler</Button><Button variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? 'Suppression…' : 'Supprimer'}</Button></div>}
    ><p className="text-sm text-[var(--muted-foreground)]">L’offre « {jobToDelete?.title} » ne sera plus disponible.</p></Dialog>
  </div>;
};
