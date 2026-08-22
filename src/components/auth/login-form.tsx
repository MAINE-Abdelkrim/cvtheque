import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../ui/button';
import { FormField, Input } from '../ui/form-controls';
import { getAuthErrorMessage } from '../../lib/auth/ux';
import { useAuth } from '../../providers/auth-provider';

const schema = z.object({ email: z.string().email('Saisissez une adresse e-mail valide.'), password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.') });
type Values = z.infer<typeof schema>;

export const LoginForm: React.FC<{ onSuccess?: () => void; onForgotPasswordClick?: () => void; id?: string }> = ({ onSuccess, onForgotPasswordClick, id }) => {
  const { signIn, signInWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [googleLoading, setGoogleLoading] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ defaultValues: { email: '', password: '' } });

  const submit = handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) return;
    setError(undefined);
    try { await signIn(parsed.data.email, parsed.data.password); onSuccess?.(); }
    catch (cause) { setError(getAuthErrorMessage(cause, 'login')); }
  });

  const google = async () => {
    setGoogleLoading(true); setError(undefined);
    try { await signInWithGoogle(); onSuccess?.(); }
    catch (cause) { setError(getAuthErrorMessage(cause, 'login')); }
    finally { setGoogleLoading(false); }
  };

  return <form id={id} onSubmit={submit} className="space-y-5" aria-busy={isSubmitting || googleLoading}>
    {error && <div role="alert" className="rounded-[10px] border border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))] px-3 py-2.5 text-sm text-[var(--danger)]">{error}</div>}
    <FormField label="Adresse e-mail" htmlFor="login-email" error={errors.email?.message} required>
      <Input id="login-email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} />
    </FormField>
    <FormField label="Mot de passe" htmlFor="login-password" error={errors.password?.message} required>
      <div className="relative"><Input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-11" {...register('password')} aria-invalid={!!errors.password} /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--muted-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
    </FormField>
    {onForgotPasswordClick && <button type="button" onClick={onForgotPasswordClick} className="text-sm font-medium text-[var(--primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">Mot de passe oublié ?</button>}
    <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || googleLoading}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Se connecter</Button>
    <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]"><span className="h-px flex-1 bg-[var(--border)]" /><span>ou</span><span className="h-px flex-1 bg-[var(--border)]" /></div>
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={google} disabled={isSubmitting || googleLoading}>{googleLoading && <Loader2 className="h-4 w-4 animate-spin" />}Continuer avec Google</Button>
  </form>;
};
