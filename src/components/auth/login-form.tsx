import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../providers/auth-provider';
import { UserRole } from '../../types';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const loginSchema = z.object({
  email: z.string().min(1, 'L\'adresse e-mail est requise').email('Format d\'adresse e-mail invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

type LoginSchemaType = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
  onForgotPasswordClick?: () => void;
  id?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onForgotPasswordClick, id }) => {
  const { signIn, signInWithGoogle, signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmittingState, setIsSubmittingState] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginSchemaType>({
    defaultValues: {
      email: '',
      password: '',
    }
  });

  const handleGoogleLogin = async (role: UserRole) => {
    setIsSubmittingState(true);
    setGeneralError(null);
    try {
      await signInWithGoogle(role);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.message?.includes('popup-closed-by-user')) {
        return;
      }
      console.error('Failed to log in with Google:', e);
      setGeneralError(e.message || 'Authentication Google échouée.');
    } finally {
      setIsSubmittingState(false);
    }
  };

  const onSubmit = async (data: LoginSchemaType) => {
    setIsSubmittingState(true);
    setGeneralError(null);
    try {
      await signIn(data.email, data.password);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      console.error('Login error:', e);
      setGeneralError(e.message || 'Identifiants invalides ou erreur de connexion.');
    } finally {
      setIsSubmittingState(false);
    }
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {generalError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono space-y-1">
          <div className="font-bold uppercase tracking-wider">// AUTHENTICATION FAILED</div>
          <div>{generalError}</div>
        </div>
      )}

      {/* Google Authentication Button */}
      <button
        type="button"
        onClick={() => handleGoogleLogin('CANDIDATE')}
        disabled={isSubmittingState}
        className="w-full flex items-center justify-center space-x-3 py-3.5 px-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[#0047FF]/50 text-[var(--foreground)] text-xs font-mono uppercase tracking-wider transition-all cursor-pointer active:scale-[0.99] group disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" width="24" height="24">
          <path
            fill="#EA4335"
            d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.09 14.99 0 12 0 7.354 0 3.374 2.69 1.468 6.6l3.798 3.165z"
          />
          <path
            fill="#4285F4"
            d="M16.04 15.345c-1.077.733-2.5 1.164-4.04 1.164a7.076 7.076 0 0 1-6.734-4.856l-3.798 3.165C3.374 21.31 7.354 24 12 24c4.682 0 8.7-2.718 10.532-6.682l-4.232-3.3c-1.127.655-1.427.818-2.26 1.327z"
          />
          <path
            fill="#FBBC05"
            d="M1.468 17.4l3.798-3.165a7.048 7.048 0 0 1 0-4.47L1.468 6.6a11.968 11.968 0 0 0 0 10.8z"
          />
          <path
            fill="#34A853"
            d="M22.532 6.6h-10.5v4.8h6.24a5.34 5.34 0 0 1-2.24 3.51l4.232 3.3C22.7 15.709 24 12.182 24 8.4c0-.627-.064-1.227-.182-1.8z"
          />
        </svg>
        <span className="font-bold">G — CONTINUE WITH GOOGLE</span>
      </button>

      {/* Editorial Divider */}
      <div className="flex items-center space-x-4 text-[var(--muted-foreground)] font-mono text-[10px] tracking-widest uppercase">
        <div className="flex-1 h-px bg-white/10" />
        <span>OR</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email Field */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold tracking-widest text-[var(--muted-foreground)] uppercase">
            EMAIL ADDRESS
          </label>
          <div className="relative">
            <input
              {...register('email')}
              type="email"
              placeholder="name@example.com"
              className="w-full px-4 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-[#0047FF] transition-all"
            />
          </div>
          {errors.email && (
            <p className="text-[10px] text-rose-400 font-mono mt-1">● {errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono font-bold tracking-widest text-[var(--muted-foreground)] uppercase">
              PASSWORD
            </label>
            {onForgotPasswordClick && (
              <button
                type="button"
                onClick={onForgotPasswordClick}
                className="text-[10px] font-mono text-[#0047FF] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="w-full px-4 pr-10 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-[#0047FF] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground-secondary)] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-[10px] text-rose-400 font-mono mt-1">● {errors.password.message}</p>
          )}
        </div>

        {/* Primary Action */}
        <button
          type="submit"
          disabled={isSubmittingState}
          className="w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-xl bg-[#0047FF] hover:bg-blue-600 active:scale-[0.99] text-[var(--foreground)] text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0047FF]/20"
        >
          {isSubmittingState ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span>AUTHENTICATING...</span>
            </>
          ) : (
            <>
              <span>CONTINUE</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

    </div>
  );
};
