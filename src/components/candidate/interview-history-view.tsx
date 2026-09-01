import React, { useEffect, useState } from 'react';
import { CalendarDays, History, Loader2, MessageSquareText, ArrowLeft, ArrowRight, CheckCircle2, Clock, Award, AlertCircle } from 'lucide-react';
import { getInterviewErrorMessage, listInterviews } from '../../lib/api/interview-client';
import type { CandidateInterviewHistoryItem } from '../../types/interview-frontend';
import { INTERVIEW_SESSION_STORAGE_KEY } from './interview-view';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { EmptyState } from '../ui/empty-state';
import { Badge, type BadgeTone } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

const PAGE_SIZE = 20;
const typeLabels: Record<CandidateInterviewHistoryItem['interviewType'], string> = { 
  general: 'GÉNÉRAL', 
  behavioral: 'COMPORTEMENTAL', 
  technical: 'TECHNIQUE', 
  mixed: 'MIXTE' 
};

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
    } catch (cause) { 
      setError(getInterviewErrorMessage(cause)); 
    } finally { 
      setLoading(false); 
      setLoadingMore(false); 
    }
  };

  useEffect(() => { 
    void load(); 
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-28 select-none">
      {/* Top Editorial Eyebrow & Title */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/dashboard/candidate')}
              className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
              // PERFORMANCE ARCHIVE
            </span>
            <span className="h-px w-8 bg-white/10" />
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
              HISTORIQUE COGNITIF
            </span>
          </div>

          <button
            onClick={() => onNavigate('/dashboard/candidate/interview')}
            className="px-5 py-2.5 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>NOUVEL ENTRETIEN</span>
          </button>
        </div>

        <div className="border-b border-[var(--border)] pb-8 space-y-3">
          <h1 className="text-3xl sm:text-5xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase leading-[1.04]">
            HISTORIQUE DES ENTRETIENS IA.<br />
            <span className="text-[var(--muted-foreground)]">ARCHIVE DE PERFORMANCE.</span>
          </h1>
          <p className="text-sm sm:text-base text-[var(--muted-foreground)] font-sans max-w-2xl leading-relaxed">
            Consultez l'ensemble de vos simulations orales passées, examinez vos rapports d'évaluation par piliers ou reprenez une session non finalisée.
          </p>
        </div>
      </section>

      {error && (
        <div role="alert" className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-xs font-mono text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <InterviewHistoryContent 
        loading={loading} 
        items={items} 
        onOpen={sessionId => openInterviewFromHistory(sessionId, onNavigate)} 
        onStart={() => onNavigate('/dashboard/candidate/interview')} 
      />

      {!loading && nextCursor && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => void load(nextCursor)}
            disabled={loadingMore}
            className="px-6 py-3 rounded-2xl bg-[var(--surface-elevated)] hover:bg-white/10 text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] transition-colors cursor-pointer flex items-center gap-2"
          >
            {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>AFFICHER PLUS D'ENTRETIENS</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const InterviewHistoryContent: React.FC<{
  loading: boolean;
  items: CandidateInterviewHistoryItem[];
  onOpen: (sessionId: string) => void;
  onStart: () => void;
}> = ({ loading, items, onOpen, onStart }) => {
  if (loading) return <LoadingSkeleton variant="list" />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucun entretien"
        description="Vos entretiens apparaîtront ici après la création de votre première session."
        icon={History}
        actionText="Commencer un entretien"
        onAction={onStart}
      />
    );
  }
  return <InterviewHistoryList items={items} onOpen={onOpen} />;
};

export const InterviewHistoryList: React.FC<{
  items: CandidateInterviewHistoryItem[];
  onOpen: (sessionId: string) => void;
}> = ({ items, onOpen }) => {
  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        const formattedIdx = idx < 9 ? `[0${idx + 1}]` : `[${idx + 1}]`;
        const isCompleted = item.status === 'COMPLETED';
        const isResumable = item.status === 'IN_PROGRESS';
        const percentage = Math.min(100, Math.round((item.questionsAnswered / item.maxQuestions) * 100));

        return (
          <div
            key={item.sessionId}
            className="p-6 sm:p-7 rounded-3xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6"
          >
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#0047FF]">
                  {formattedIdx}
                </span>
                <span className="text-xs font-mono text-[var(--muted-foreground)]">
                  {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isCompleted
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isResumable
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : 'bg-[var(--surface-elevated)] text-[var(--muted-foreground)] border border-[var(--border)]'
                  }`}
                >
                  {statusPresentation[item.status]?.label || item.status}
                </span>
              </div>

              <h3 className="text-lg font-bold font-display text-[var(--foreground)] truncate">
                ENTRETIEN {typeLabels[item.interviewType] || 'TECHNIQUE'}
              </h3>

              {/* Progress bar */}
              <div className="max-w-md space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-[var(--muted-foreground)]">
                  <span>Progression</span>
                  <span>{item.questionsAnswered} / {item.maxQuestions} questions</span>
                </div>
                <div className="h-1.5 bg-[var(--surface-elevated)] rounded-full overflow-hidden border border-[var(--border)]">
                  <div
                    className="h-full bg-[#0047FF] rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {item.status === 'COMPLETED' && (
                <div className="text-xs font-mono text-[var(--foreground-secondary)] pt-1">
                  <span className="font-bold text-[#0047FF]">Score : {item.overallScore ?? '—'}/100</span>
                  {item.classification && <span className="text-[var(--muted-foreground)]"> · {item.classification}</span>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 border-[var(--border)] pt-4 sm:pt-0">
              {item.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => onOpen(item.sessionId)}
                  className="px-4 py-2.5 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
                >
                  <span>Reprendre</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {item.status === 'COMPLETED' && (
                <button
                  onClick={() => onOpen(item.sessionId)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-white/10 text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span>Voir le rapport</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#0047FF]" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
