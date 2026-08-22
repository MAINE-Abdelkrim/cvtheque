import React from 'react';
import { Building2, BriefcaseBusiness, MapPin, Trash2 } from 'lucide-react';
import type { JobPosting } from '../../types';
import { Badge, StatusBadge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { SectionHeader } from '../ui/page-header';

const workMode: Record<string, string> = { onsite: 'Sur site', hybrid: 'Hybride', remote: 'À distance' };

interface RecruiterJobsListProps {
  jobs: JobPosting[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (jobId: string) => void;
  onDelete: (job: JobPosting) => void;
  onCreate: () => void;
}

export const RecruiterJobsList: React.FC<RecruiterJobsListProps> = ({ jobs, loading, selectedId, onSelect, onDelete, onCreate }) => <section aria-label="Offres du recruteur">
  <Card>
    <CardHeader><SectionHeader title="Mes offres" description="Sélectionnez une offre pour rechercher les profils adaptés." /></CardHeader>
    <CardContent>
      {loading ? <LoadingSkeleton variant="list" /> : jobs.length === 0 ? <EmptyState id="recruiter-jobs-title" title="Aucune offre publiée" description="Créez votre première offre pour commencer à rechercher des candidats." icon={BriefcaseBusiness} actionText="Créer une offre" onAction={onCreate} /> : <div className="space-y-3" role="list" aria-label="Offres du recruteur">{jobs.map(job => {
        const selected = selectedId === job.id;
        const details = [job.contract_type, job.work_mode ? workMode[job.work_mode] ?? job.work_mode : null].filter(Boolean);
        return <article key={job.id} role="listitem" className={`rounded-xl border p-4 transition-colors ${selected ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,var(--surface))]' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'}`}>
          <div className="flex items-start justify-between gap-3">
            <button type="button" aria-pressed={selected} onClick={() => onSelect(job.id)} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
              <span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold text-[var(--foreground)]">{job.title}</span>{selected && <Badge tone="primary">Sélectionnée</Badge>}</span>
              <span className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>{details.map(item => <span key={item as string}>· {item}</span>)}</span>
            </button>
            <div className="flex shrink-0 items-center gap-1"><StatusBadge status={job.status} /><Button variant="ghost" size="sm" aria-label={`Supprimer l’offre ${job.title}`} onClick={() => onDelete(job)}><Trash2 className="h-4 w-4" /></Button></div>
          </div>
          {job.required_skills && job.required_skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{job.required_skills.slice(0, 4).map(skill => <Badge key={skill}>{skill}</Badge>)}{job.required_skills.length > 4 && <Badge>+{job.required_skills.length - 4}</Badge>}</div>}
          {job.createdAt && <p className="mt-3 text-xs text-[var(--muted-foreground)]">Créée le {new Date(job.createdAt).toLocaleDateString('fr-FR')}</p>}
        </article>;
      })}</div>}
    </CardContent>
  </Card>
</section>;
