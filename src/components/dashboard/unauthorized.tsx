import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export const Unauthorized: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const home = profile ? `/dashboard/${profile.role.toLowerCase()}` : '/login';
  return <div className="flex min-h-[60vh] items-center justify-center px-4"><Card className="w-full max-w-md"><CardContent className="p-8 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--danger)_9%,var(--surface))] text-[var(--danger)]"><ShieldAlert className="h-6 w-6" /></span><h1 className="mt-5 text-xl font-semibold text-[var(--foreground)]">Accès non autorisé</h1><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Votre compte ne permet pas d’accéder à cette page.</p><Button className="mt-6" onClick={() => onNavigate(home)}>Retour au tableau de bord</Button></CardContent></Card></div>;
};
