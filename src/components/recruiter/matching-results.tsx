import React from 'react';
import { AlertCircle, FileText, Search } from 'lucide-react';
import type { RecruiterMatchingResponse } from '../../types/matching';
import { Card, CardContent, CardHeader } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { SectionHeader } from '../ui/page-header';
import { RecruiterCandidateMatchCard } from './candidate-match-card';

interface MatchingResultsProps { loading: boolean; error: string | null; result: RecruiterMatchingResponse | null; hasSelection: boolean; }

export const MatchingResults: React.FC<MatchingResultsProps> = ({ loading, error, result, hasSelection }) => {
  if (!hasSelection) return null;
  return <section aria-labelledby="matching-results-title" aria-busy={loading}>
    <Card>
      <CardHeader><div id="matching-results-title"><SectionHeader title="Résultats du matching" description="Profils classés selon les critères de l’offre sélectionnée." /></div></CardHeader>
      <CardContent>
        {loading ? <div role="status" aria-label="Analyse des profils disponibles"><p className="mb-4 text-sm text-[var(--muted-foreground)]">Analyse des profils disponibles…</p><LoadingSkeleton variant="list" /></div>
          : error ? <div role="alert" className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,transparent)] p-4 text-sm text-[var(--danger)]"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>
          : !result ? <EmptyState title="Matching non lancé" description="Lancez la recherche pour identifier les profils les plus adaptés à cette offre." icon={Search} />
          : result.topCandidates.length === 0 ? <EmptyState title="Aucun candidat disponible" description="Aucun CV candidat actuel n'est disponible pour cette offre." icon={FileText} />
          : <div className="space-y-6"><div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-[var(--surface-secondary)] px-4 py-3 text-sm"><SummaryValue label="Profils évalués" value={result.evaluatedCandidates} /><SummaryValue label="Profils éligibles" value={result.eligibleCandidates} /><SummaryValue label="Profils invalides" value={result.invalidCandidates} /><SummaryValue label="Profils affichés" value={result.topCandidates.length} /></div>{result.summary && <p className="text-sm leading-6 text-[var(--muted-foreground)]">{result.summary}</p>}<ol className="space-y-5" aria-label="Classement des candidats">{result.topCandidates.map(candidate => <li key={candidate.cvId}><RecruiterCandidateMatchCard candidate={candidate} /></li>)}</ol></div>}
      </CardContent>
    </Card>
  </section>;
};

const SummaryValue: React.FC<{ label: string; value: number }> = ({ label, value }) => <span><strong className="font-semibold tabular-nums text-[var(--foreground)]">{value}</strong><span className="ml-1.5 text-[var(--muted-foreground)]">{label}</span></span>;
