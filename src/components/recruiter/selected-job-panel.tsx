import React from 'react';
import { Search } from 'lucide-react';
import type { JobPosting } from '../../types';
import { Badge, StatusBadge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { SectionHeader } from '../ui/page-header';

const workMode: Record<string, string> = { onsite: 'Sur site', hybrid: 'Hybride', remote: 'À distance' };

export const SelectedJobPanel: React.FC<{ job: JobPosting | null; matching: boolean; onMatch: () => void }> = ({ job, matching, onMatch }) => {
  if (!job) return <EmptyState title="Sélectionnez une offre" description="Choisissez une offre dans la liste pour consulter ses critères et lancer le matching." icon={Search} />;
  const education = job.required_education?.minimum_level;
  return <Card aria-busy={matching}>
    <CardHeader><SectionHeader title={job.title} description={`${job.company} · ${job.location}`} actions={<StatusBadge status={job.status} />} /></CardHeader>
    <CardContent className="space-y-6">
      <div className="flex flex-wrap gap-2">{job.contract_type && <Badge>{job.contract_type}</Badge>}{job.work_mode && <Badge>{workMode[job.work_mode] ?? job.work_mode}</Badge>}{job.remote_allowed && <Badge tone="info">Télétravail possible</Badge>}</div>
      <dl className="grid gap-5 sm:grid-cols-2">
        <Criteria label="Compétences requises"><TagList values={job.required_skills} /></Criteria>
        <Criteria label="Compétences souhaitées"><TagList values={job.preferred_skills} empty="Aucune exigence supplémentaire" /></Criteria>
        <Criteria label="Expérience minimale" value={`${job.minimum_experience_years ?? 0} an${(job.minimum_experience_years ?? 0) > 1 ? 's' : ''}`} />
        <Criteria label="Formation" value={education || 'Non spécifiée'} />
        <Criteria label="Langues"><TagList values={job.required_languages?.map(language => `${language.name} · ${language.minimum_level}`)} empty="Non spécifiées" /></Criteria>
        <Criteria label="Modalités" value={[job.location, job.work_mode ? workMode[job.work_mode] : null, job.contract_type].filter(Boolean).join(' · ')} />
      </dl>
      <div className="flex justify-end border-t border-[var(--border)] pt-5"><Button onClick={onMatch} disabled={matching || job.status !== 'OPEN'}>{matching ? 'Analyse des profils disponibles…' : 'Rechercher les meilleurs profils'}</Button></div>
    </CardContent>
  </Card>;
};

const Criteria: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => <div><dt className="text-xs font-medium text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1.5 text-sm text-[var(--foreground)]">{children ?? value}</dd></div>;
const TagList: React.FC<{ values?: string[]; empty?: string }> = ({ values, empty = 'Non spécifiées' }) => values?.length ? <span className="flex flex-wrap gap-1.5">{values.map(value => <Badge key={value}>{value}</Badge>)}</span> : <span className="text-[var(--muted-foreground)]">{empty}</span>;
