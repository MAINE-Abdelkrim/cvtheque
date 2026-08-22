import React from 'react';
import { BriefcaseBusiness, MapPin } from 'lucide-react';
import type { JobPosting } from '../../types';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { SectionHeader } from '../ui/page-header';

const workModeLabels: Record<string, string> = { onsite: 'Sur site', hybrid: 'Hybride', remote: 'À distance' };

export const CandidateJobsList: React.FC<{ jobs: JobPosting[]; loading: boolean }> = ({ jobs, loading }) => <section aria-labelledby="open-jobs-title" className="space-y-5"><SectionHeader title="Offres disponibles" description="Consultez les postes actuellement ouverts." /><div id="open-jobs-title" className="sr-only">Offres disponibles</div>{loading ? <LoadingSkeleton variant="list" /> : jobs.length === 0 ? <EmptyState title="Aucune offre disponible" description="Les nouvelles offres publiées apparaîtront ici." icon={BriefcaseBusiness} /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{jobs.map(job => {
  const conditions = [job.contract_type, job.work_mode ? workModeLabels[job.work_mode] ?? job.work_mode : null].filter(Boolean);
  return <Card key={job.id} className="transition-colors hover:border-[var(--border-strong)]"><CardContent className="space-y-4"><div><h3 className="text-base font-semibold text-[var(--foreground)]">{job.title}</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{job.company}</p></div><div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-[var(--muted-foreground)]"><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{job.location}</span>{conditions.map(condition => <span key={condition as string}>· {condition}</span>)}</div>{job.description && <p className="line-clamp-3 text-sm leading-6 text-[var(--foreground)]">{job.description}</p>}{job.required_skills && job.required_skills.length > 0 && <div className="flex flex-wrap gap-2">{job.required_skills.map(skill => <Badge key={skill}>{skill}</Badge>)}</div>}</CardContent></Card>;
})}</div>}</section>;
