import React from 'react';
import { FileQuestion } from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export const NotFound: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const home = profile ? `/dashboard/${profile.role.toLowerCase()}` : '/login';
  return <div className="flex min-h-[60vh] items-center justify-center px-4"><Card className="w-full max-w-md"><CardContent className="p-8 text-center"><FileQuestion className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" /><h1 className="mt-4 text-xl font-semibold text-[var(--foreground)]">Page introuvable</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">Cette page n’existe pas ou n’est plus disponible.</p><Button className="mt-6" onClick={() => onNavigate(home)}>Retour au tableau de bord</Button></CardContent></Card></div>;
};
