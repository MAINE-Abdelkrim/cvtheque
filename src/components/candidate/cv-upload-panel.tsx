import React from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import type { CVUploadStatus } from '../../types/cv-parser';
import { Button } from '../ui/button';

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

const statusMessages: Partial<Record<CVUploadStatus, string>> = {
  validating: 'Vérification du fichier…',
  uploading: 'Envoi du CV…',
  parsing: 'Analyse du CV…',
  success: 'CV analysé et enregistré.',
  cancelled: 'Analyse annulée.',
};

const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

export const CVUploadPanel: React.FC<CVUploadPanelProps> = ({ selectedFile, status, error, isDragging, hasCurrentCV, fileInputRef, onFileChange, onClearFile, onSubmit, onCancel, onDragStateChange }) => {
  const busy = ['validating', 'uploading', 'parsing'].includes(status);
  const openPicker = () => fileInputRef.current?.click();
  return <form onSubmit={onSubmit} className="space-y-4" aria-busy={busy}>
    <input ref={fileInputRef} id="candidate-cv-file" type="file" accept="application/pdf,.pdf" disabled={busy} className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) onFileChange(file); event.target.value = ''; }} />
    {!selectedFile ? <div
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-disabled={busy}
      onClick={() => !busy && openPicker()}
      onKeyDown={event => { if (!busy && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openPicker(); } }}
      onDragOver={event => { event.preventDefault(); if (!busy) onDragStateChange(true); }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={event => { event.preventDefault(); onDragStateChange(false); const file = event.dataTransfer.files?.[0]; if (file && !busy) onFileChange(file); }}
      className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${isDragging ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,var(--surface))]' : 'border-[var(--border-strong)] bg-[var(--surface-secondary)] hover:border-[var(--primary)]'} ${busy ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]"><Upload className="h-5 w-5" /></span>
      <p className="text-base font-semibold text-[var(--foreground)]">Déposez votre CV ici</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">PDF uniquement · 10 Mo maximum</p>
      <Button variant="outline" className="mt-5" onClick={event => { event.stopPropagation(); openPicker(); }}>Choisir un fichier</Button>
    </div> : <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)]"><FileText className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--foreground)]">{selectedFile.name}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">PDF · {fileSize(selectedFile.size)}</p></div></div>
      {!busy && <div className="flex shrink-0 gap-2"><Button variant="ghost" size="sm" onClick={openPicker}>Changer</Button><Button variant="ghost" size="sm" onClick={onClearFile}>Retirer</Button></div>}
    </div>}

    {statusMessages[status] && status !== 'success' && <div role="status" className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">{busy && <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />}{statusMessages[status]}</div>}
    {status === 'success' && <p role="status" className="text-sm text-[var(--success)]">{statusMessages.success}</p>}
    {error && <p role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,transparent)] px-3 py-2.5 text-sm text-[var(--danger)]">{error}</p>}

    {selectedFile && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{busy && <Button variant="outline" onClick={onCancel}>Annuler</Button>}<Button type="submit" disabled={busy}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours…</> : hasCurrentCV ? 'Analyser et remplacer le CV' : 'Analyser le CV'}</Button></div>}
  </form>;
};
