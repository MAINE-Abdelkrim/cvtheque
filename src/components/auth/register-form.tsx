import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../ui/button';
import { FormField, Input } from '../ui/form-controls';
import { buildPublicSignupInput, getAuthErrorMessage, type PublicSignupRole } from '../../lib/auth/ux';
import { useAuth } from '../../providers/auth-provider';

const schema = z.object({ firstName: z.string().trim().min(1, 'Le prénom est requis.'), lastName: z.string().trim().min(1, 'Le nom est requis.'), email: z.string().email('Saisissez une adresse e-mail valide.'), password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.'), role: z.enum(['CANDIDATE', 'RECRUITER']) });
type Values = z.infer<typeof schema>;

export const RegisterForm: React.FC<{ onSuccess?: () => void; id?: string }> = ({ onSuccess, id }) => {
  const { signUp, signInWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [googleLoading, setGoogleLoading] = useState(false);
  const { register, setValue, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ defaultValues: { firstName: '', lastName: '', email: '', password: '', role: 'CANDIDATE' } });
  const role = watch('role');

  const submit = handleSubmit(async raw => {
    const parsed = schema.safeParse(raw); if (!parsed.success) return;
    setError(undefined);
    try { const value = buildPublicSignupInput(parsed.data); await signUp(value.email, value.password, value.firstName, value.lastName, value.role); onSuccess?.(); }
    catch (cause) { setError(getAuthErrorMessage(cause, 'signup')); }
  });
  const google = async () => {
    setGoogleLoading(true); setError(undefined);
    try { await signInWithGoogle(role); onSuccess?.(); }
    catch (cause) { setError(getAuthErrorMessage(cause, 'signup')); }
    finally { setGoogleLoading(false); }
  };

  const chooseRole = (value: PublicSignupRole) => setValue('role', value, { shouldValidate: true });
  return <form id={id} onSubmit={submit} className="space-y-5" aria-busy={isSubmitting || googleLoading}>
    {error && <div role="alert" className="rounded-[10px] border border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))] px-3 py-2.5 text-sm text-[var(--danger)]">{error}</div>}
    <fieldset><legend className="mb-2 text-sm font-medium text-[var(--foreground)]">Type de compte</legend><div className="grid grid-cols-2 gap-2" role="radiogroup">
      {([['CANDIDATE','Candidat','Gérer mon CV et consulter les offres'],['RECRUITER','Recruteur','Publier des offres et rechercher des profils']] as const).map(([value,label,description]) => <button key={value} type="button" role="radio" aria-checked={role === value} onClick={() => chooseRole(value)} className={`rounded-[10px] border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${role === value ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]' : 'border-[var(--border)] bg-[var(--surface)]'}`}><span className="block text-sm font-semibold text-[var(--foreground)]">{label}</span><span className="mt-1 block text-xs text-[var(--muted-foreground)]">{description}</span></button>)}
    </div></fieldset>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Prénom" htmlFor="signup-first-name" error={errors.firstName?.message} required><Input id="signup-first-name" autoComplete="given-name" {...register('firstName')} /></FormField><FormField label="Nom" htmlFor="signup-last-name" error={errors.lastName?.message} required><Input id="signup-last-name" autoComplete="family-name" {...register('lastName')} /></FormField></div>
    <FormField label="Adresse e-mail" htmlFor="signup-email" error={errors.email?.message} required><Input id="signup-email" type="email" autoComplete="email" {...register('email')} /></FormField>
    <FormField label="Mot de passe" htmlFor="signup-password" helperText="6 caractères minimum" error={errors.password?.message} required><div className="relative"><Input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="pr-11" {...register('password')} /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--muted-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></FormField>
    <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || googleLoading}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Créer mon compte</Button>
    <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]"><span className="h-px flex-1 bg-[var(--border)]" /><span>ou</span><span className="h-px flex-1 bg-[var(--border)]" /></div>
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={google} disabled={isSubmitting || googleLoading}>{googleLoading && <Loader2 className="h-4 w-4 animate-spin" />}Continuer avec Google</Button>
  </form>;
};
