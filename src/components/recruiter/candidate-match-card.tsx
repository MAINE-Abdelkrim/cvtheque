import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { RecruiterCandidateMatch } from '../../types/matching';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader } from '../ui/card';
import { MatchCriterion } from './match-criterion';

export const RecruiterCandidateMatchCard: React.FC<{ candidate: RecruiterCandidateMatch }> = ({ candidate }) => <Card>
  <CardHeader>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-secondary)] text-sm font-semibold text-[var(--foreground)]" aria-label={`Rang ${candidate.rank}`}>#{candidate.rank}</span>
        <div className="min-w-0"><h3 className="truncate text-base font-semibold text-[var(--foreground)]">{candidate.candidateName ?? 'Profil candidat'}</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{candidate.matchLevel}</p></div>
      </div>
      <div className="flex shrink-0 items-center gap-3"><Badge tone={candidate.eligible ? 'success' : 'danger'}>{candidate.eligible ? 'Éligible' : 'Non éligible'}</Badge><div className="text-right"><p className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">{candidate.score}%</p><p className="text-xs text-[var(--muted-foreground)]">Score global</p></div></div>
    </div>
  </CardHeader>
  <CardContent className="space-y-6">
    {candidate.summary && <p className="max-w-3xl text-sm leading-6 text-[var(--foreground)]">{candidate.summary}</p>}

    <section aria-labelledby={`skills-${candidate.cvId}`}><h4 id={`skills-${candidate.cvId}`} className="text-sm font-semibold text-[var(--foreground)]">Compétences requises</h4>{candidate.requiredSkills.display && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{candidate.requiredSkills.display}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><SkillGroup title="Correspondantes" values={candidate.requiredSkills.matched} matched /><SkillGroup title="Manquantes" values={candidate.requiredSkills.missing} /></div></section>

    <section aria-label="Évaluation des critères" className="grid gap-3 md:grid-cols-2"><MatchCriterion label="Expérience" status={candidate.experience.status} display={candidate.experience.display} detail={candidate.experience.candidateYears !== null ? `${candidate.experience.candidateYears} an${candidate.experience.candidateYears > 1 ? 's' : ''}${candidate.experience.requiredYears !== null ? ` · ${candidate.experience.requiredYears} an${candidate.experience.requiredYears > 1 ? 's' : ''} requis` : ''}` : undefined} /><MatchCriterion label="Formation" status={candidate.education.status} display={candidate.education.display} /><MatchCriterion label="Langues" status={candidate.languages.status} display={candidate.languages.display} /><MatchCriterion label="Lieu et mode de travail" status={candidate.locationAndWorkMode.status} display={candidate.locationAndWorkMode.display} /><MatchCriterion label="Contrat" status={candidate.contract.status} display={candidate.contract.display} /></section>

    {(candidate.strengths.length > 0 || candidate.gaps.length > 0) && <div className="grid gap-5 border-t border-[var(--border)] pt-5 md:grid-cols-2">{candidate.strengths.length > 0 && <EvidenceList title="Points forts" items={candidate.strengths} />}{candidate.gaps.length > 0 && <EvidenceList title="Points d’attention" items={candidate.gaps} warning />}</div>}

    {!candidate.eligible && <section className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-4" aria-label="Critères obligatoires non satisfaits"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" /><div><h4 className="text-sm font-semibold text-[var(--danger)]">Critères obligatoires non satisfaits</h4>{candidate.eligibilityMessage && <p className="mt-1 text-sm text-[var(--foreground)]">{candidate.eligibilityMessage}</p>}{candidate.mandatoryFailures.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">{candidate.mandatoryFailures.map(item => <li key={item}>{item}</li>)}</ul>}</div></div></section>}
  </CardContent>
</Card>;

const SkillGroup: React.FC<{ title: string; values: string[]; matched?: boolean }> = ({ title, values, matched = false }) => <div><p className="text-xs font-medium text-[var(--muted-foreground)]">{title}</p>{values.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{values.map(skill => <Badge key={skill} tone={matched ? 'success' : 'danger'}>{matched ? <Check className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}{skill}</Badge>)}</div> : <p className="mt-2 text-sm text-[var(--muted-foreground)]">Aucune</p>}</div>;

const EvidenceList: React.FC<{ title: string; items: string[]; warning?: boolean }> = ({ title, items, warning = false }) => <section><h4 className="text-sm font-semibold text-[var(--foreground)]">{title}</h4><ul className="mt-2 space-y-2 text-sm text-[var(--muted-foreground)]">{items.map(item => <li key={item} className="flex items-start gap-2"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${warning ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'}`} aria-hidden="true" />{item}</li>)}</ul></section>;
