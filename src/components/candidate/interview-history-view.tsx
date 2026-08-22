import React, { useEffect, useState } from 'react';
import { CalendarDays, History, Loader2, MessageSquareText } from 'lucide-react';
import { getInterviewErrorMessage, listInterviews } from '../../lib/api/interview-client';
import type { CandidateInterviewHistoryItem } from '../../types/interview-frontend';
import { INTERVIEW_SESSION_STORAGE_KEY } from './interview-view';
import { Badge, type BadgeTone } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { PageHeader } from '../ui/page-header';

const PAGE_SIZE = 20;
const typeLabels: Record<CandidateInterviewHistoryItem['interviewType'], string> = { general: 'Général', behavioral: 'Comportemental', technical: 'Technique', mixed: 'Mixte' };
const statusPresentation: Record<CandidateInterviewHistoryItem['status'], { label: string; tone: BadgeTone }> = {
  CREATED: { label: 'Créé', tone: 'neutral' },
  IN_PROGRESS: { label: 'En cours', tone: 'info' },
  COMPLETED: { label: 'Terminé', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

export function appendInterviewHistory(current: CandidateInterviewHistoryItem[], incoming: CandidateInterviewHistoryItem[]): CandidateInterviewHistoryItem[] {
  const known = new Set(current.map(item => item.sessionId));
  return [...current, ...incoming.filter(item => !known.has(item.sessionId))];
}

export function openInterviewFromHistory(sessionId: string, navigate: (path: string) => void, storage: Pick<Storage, 'setItem'> = sessionStorage): void {
  storage.setItem(INTERVIEW_SESSION_STORAGE_KEY, sessionId);
  navigate('/dashboard/candidate/interview');
}

export const InterviewHistoryView: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [items, setItems] = useState<CandidateInterviewHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = async (cursor?: string) => {
    cursor ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const result = await listInterviews(PAGE_SIZE, cursor);
      setItems(current => cursor ? appendInterviewHistory(current, result.interviews) : result.interviews);
      setNextCursor(result.nextCursor);
    } catch (cause) { setError(getInterviewErrorMessage(cause)); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => { void load(); }, []);

  return <div className="space-y-6">
    <PageHeader title="Mes entretiens" description="Consultez vos entretiens précédents, reprenez une session en cours ou ouvrez un rapport terminé." actions={<Button onClick={() => onNavigate('/dashboard/candidate/interview')}><MessageSquareText className="h-4 w-4" />Nouvel entretien</Button>} />
    {error && <div role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-4 text-sm text-[var(--danger)]">{error}</div>}
    <InterviewHistoryContent loading={loading} items={items} onOpen={sessionId => openInterviewFromHistory(sessionId, onNavigate)} onStart={() => onNavigate('/dashboard/candidate/interview')} />
    {!loading && nextCursor && <div className="flex justify-center"><Button variant="outline" onClick={() => void load(nextCursor)} disabled={loadingMore}>{loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}Afficher plus</Button></div>}
    {!loading && error && items.length === 0 && <div className="flex justify-center"><Button variant="outline" onClick={() => void load()}>Réessayer</Button></div>}
  </div>;
};

export const InterviewHistoryContent: React.FC<{ loading: boolean; items: CandidateInterviewHistoryItem[]; onOpen: (sessionId: string) => void; onStart: () => void }> = ({ loading, items, onOpen, onStart }) => loading ? <LoadingSkeleton variant="list" /> : items.length === 0 ? <EmptyState title="Aucun entretien" description="Vos entretiens apparaîtront ici après la création de votre première session." icon={History} actionText="Commencer un entretien" onAction={onStart} /> : <InterviewHistoryList items={items} onOpen={onOpen} />;

export const InterviewHistoryList: React.FC<{ items: CandidateInterviewHistoryItem[]; onOpen: (sessionId: string) => void }> = ({ items, onOpen }) => <div className="space-y-3">{items.map(item => { const status = statusPresentation[item.status]; const percentage = Math.min(100, Math.round((item.questionsAnswered / item.maxQuestions) * 100)); return <Card key={item.sessionId}><CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[var(--foreground)]">Entretien {typeLabels[item.interviewType].toLowerCase()}</h2><Badge tone={status.tone}>{status.label}</Badge></div><p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><CalendarDays className="h-3.5 w-3.5" />{new Date(item.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'medium' })}</p><div className="mt-3 max-w-md"><div className="mb-1 flex justify-between text-xs text-[var(--muted-foreground)]"><span>Progression</span><span>{item.questionsAnswered} / {item.maxQuestions}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${percentage}%` }} /></div></div>{item.status === 'COMPLETED' && <div className="mt-3 flex flex-wrap gap-2 text-sm"><span className="font-medium">Score : {item.overallScore ?? '—'}/100</span>{item.classification && <span className="text-[var(--muted-foreground)]">· {item.classification}</span>}</div>}</div><div className="shrink-0 sm:text-right">{item.status === 'IN_PROGRESS' && <Button onClick={() => onOpen(item.sessionId)}>Reprendre</Button>}{item.status === 'COMPLETED' && <Button variant="outline" onClick={() => onOpen(item.sessionId)}>Voir le rapport</Button>}</div></CardContent></Card>; })}</div>;
