import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps { title: string; description: string; icon: LucideIcon; actionText?: string; onAction?: () => void; id?: string; }

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon: Icon, actionText, onAction, id }) => <div id={id} className="ui-card flex flex-col items-center justify-center px-6 py-10 text-center"><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--muted-foreground)]"><Icon className="h-5 w-5" /></span><h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{description}</p>{actionText && onAction && <Button className="mt-5" onClick={onAction}>{actionText}</Button>}</div>;
