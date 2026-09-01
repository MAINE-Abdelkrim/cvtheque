import React from 'react';
import { FileText, ArrowRight, X, Sparkles, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import type { CVUploadStatus } from '../../types/cv-parser';
import { motion, AnimatePresence } from 'motion/react';

interface CVUploadPanelProps {
  selectedFile: File | null;
  status: CVUploadStatus;
  error: string | null;
  isDragging: boolean;
  hasCurrentCV: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (file: File) => void;
  onClearFile: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  onDragStateChange: (dragging: boolean) => void;
}

const statusSteps: Array<{ key: string; label: string; sub: string }> = [
  { key: '01', label: 'INGESTION', sub: 'Réception du flux binaire PDF' },
  { key: '02', label: 'EXTRACTION', sub: 'Extraction sémantique du texte' },
  { key: '03', label: 'STRUCTURATION', sub: 'Indexation des expériences & compétences' },
  { key: '04', label: 'ÉVALUATION', sub: 'Calcul du score et des signaux' },
];

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

export const CVUploadPanel: React.FC<CVUploadPanelProps> = ({
  selectedFile,
  status,
  error,
  isDragging,
  hasCurrentCV,
  fileInputRef,
  onFileChange,
  onClearFile,
  onSubmit,
  onCancel,
  onDragStateChange,
}) => {
  const busy = ['validating', 'uploading', 'parsing'].includes(status);
  const openPicker = () => fileInputRef.current?.click();

  // Active step index during processing
  const getActiveStep = () => {
    if (status === 'validating') return 0;
    if (status === 'uploading') return 1;
    if (status === 'parsing') return 2;
    if (status === 'success') return 3;
    return 0;
  };

  const activeStepIdx = getActiveStep();

  return (
    <form onSubmit={onSubmit} className="space-y-6 select-none" aria-busy={busy}>
      <input
        ref={fileInputRef}
        id="candidate-cv-file"
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileChange(file);
          event.target.value = '';
        }}
      />

      {/* Main Architectural Dropzone */}
      {!selectedFile && !busy ? (
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            onDragStateChange(true);
          }}
          onDragLeave={() => onDragStateChange(false)}
          onDrop={(e) => {
            e.preventDefault();
            onDragStateChange(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFileChange(file);
          }}
          className={`p-8 sm:p-12 rounded-3xl border border-dashed transition-all cursor-pointer relative group overflow-hidden ${
            isDragging
              ? 'border-[#0047FF] bg-[#0047FF]/10 scale-[1.01]'
              : 'border-[var(--border-strong)] hover:border-[#0047FF]/60 bg-[var(--surface)] hover:bg-[var(--surface-secondary)]'
          }`}
        >
          <div className="absolute top-0 right-0 p-4">
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest">
              [01] INGESTION
            </span>
          </div>

          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] group-hover:border-[#0047FF]/40 group-hover:text-[#0047FF] transition-colors">
              <FileText className="w-6 h-6" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h3 className="text-xl sm:text-2xl font-bold font-display text-[var(--foreground)] tracking-tight">
                DÉPOSEZ VOTRE CV ICI
              </h3>
              <p className="text-xs font-mono text-[var(--muted-foreground)]">
                PDF uniquement · 10 Mo max · Analyse sémantique instantanée
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPicker();
              }}
              className="mt-2 px-5 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--foreground)] font-mono text-xs border border-[var(--border)] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span>PARCOURIR LES FICHIERS</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#0047FF]" />
            </button>
          </div>
        </div>
      ) : selectedFile && !busy ? (
        /* Selected File Card */
        <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] space-y-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#0047FF] uppercase tracking-wider font-bold">
              // DOCUMENT SÉLECTIONNÉ
            </span>
            <button
              type="button"
              onClick={onClearFile}
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Retirer le document"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0047FF]/10 border border-[#0047FF]/30 flex items-center justify-center text-[#0047FF] shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm sm:text-base font-bold text-[var(--foreground)] font-display truncate">
                {selectedFile.name}
              </h4>
              <p className="text-xs font-mono text-[var(--muted-foreground)] mt-0.5">
                FORMAT PDF · {fileSize(selectedFile.size)} · PRÊT POUR L'INGESTION
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={openPicker}
              className="w-full sm:w-auto px-4 py-2 text-xs font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors text-left"
            >
              [ CHANGER DE DOCUMENT ]
            </button>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0047FF] hover:bg-[#0038CC] text-white font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{hasCurrentCV ? 'ANALYSER & REMPLACER LE CV →' : 'LANCER L\'ANALYSE IA →'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Processing / Analyzing Experience */
        <div className="p-8 sm:p-10 rounded-3xl border border-[#0047FF]/30 bg-[var(--surface)] space-y-6 relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div>
              <span className="text-[10px] font-mono text-[#0047FF] uppercase tracking-widest font-bold block">
                // DOCUMENT PROCESSING PIPELINE
              </span>
              <h4 className="text-lg font-bold font-display text-[var(--foreground)] mt-0.5">
                Analyse cognitive du document
              </h4>
            </div>
            <span className="font-mono text-xs text-[var(--muted-foreground)] animate-pulse">
              EN COURS...
            </span>
          </div>

          {/* Steps Sequence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {statusSteps.map((step, idx) => {
              const isCurrent = idx === activeStepIdx;
              const isDone = idx < activeStepIdx || status === 'success';

              return (
                <div
                  key={step.key}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'border-[#0047FF] bg-[#0047FF]/10 text-[var(--foreground)]'
                      : isDone
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-[var(--foreground)]'
                      : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="font-bold">[{step.key}] {step.label}</span>
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-[#0047FF] animate-ping" />
                    ) : null}
                  </div>
                  <p className="text-[11px] font-sans text-[var(--muted-foreground)]">
                    {step.sub}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="font-mono text-[var(--muted-foreground)]">
              Traitement du document par le moteur d'extraction...
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-mono text-[var(--muted-foreground)] hover:text-rose-500 transition-colors"
            >
              [ Annuler ]
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-mono font-bold uppercase tracking-wider text-rose-400 block">
              // ERREUR D'EXTRACTION
            </span>
            <p>{error}</p>
          </div>
        </div>
      )}
    </form>
  );
};
