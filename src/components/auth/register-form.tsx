import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../providers/auth-provider';
import { UserRole } from '../../types';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email address is required').email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['CANDIDATE', 'RECRUITER', 'ADMIN'] as const),
});

type RegisterSchemaType = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
  id?: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, id }) => {
  const { signUp, signInWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmittingState, setIsSubmittingState] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<RegisterSchemaType>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'CANDIDATE',
    }
  });

  const selectedRole = watch('role');

  const handleGoogleSignup = async (role: UserRole) => {
    setIsSubmittingState(true);
    setGeneralError(null);
    try {
      await signInWithGoogle(role);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.message?.includes('popup-closed-by-user')) {
        return;
      }
      console.error('Failed registration with Google:', e);
      setGeneralError(e.message || 'Google registration failed.');
    } finally {
      setIsSubmittingState(false);
    }
  };

  const onSubmit = async (data: RegisterSchemaType) => {
    setIsSubmittingState(true);
    setGeneralError(null);
    try {
      await signUp(data.email, data.password, data.firstName, data.lastName, data.role);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      console.error('Registration error:', e);
      setGeneralError(e.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmittingState(false);
    }
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {generalError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono space-y-1">
          <div className="font-bold uppercase tracking-wider">// REGISTRATION FAILED</div>
          <div>{generalError}</div>
        </div>
      )}

      {/* Google Registration Button */}
      <button
        type="button"
        onClick={() => handleGoogleSignup(selectedRole)}
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
        <span className="font-bold">G — SIGN UP WITH GOOGLE</span>
      </button>

      {/* Editorial Divider */}
      <div className="flex items-center space-x-4 text-[var(--muted-foreground)] font-mono text-[10px] tracking-widest uppercase">
        <div className="flex-1 h-px bg-white/10" />
        <span>OR</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <form id={id} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Role Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold tracking-widest text-[var(--muted-foreground)] uppercase">
            // 01 / SELECT YOUR ROLE
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setValue('role', 'CANDIDATE')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRole === 'CANDIDATE'
                  ? 'bg-[#0047FF]/10 border-[#0047FF] text-[var(--foreground)]'
                  : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold uppercase truncate">CANDIDATE</span>
                {selectedRole === 'CANDIDATE' && <Check className="w-3.5 h-3.5 text-[#0047FF]" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setValue('role', 'RECRUITER')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRole === 'RECRUITER'
                  ? 'bg-[#0047FF]/10 border-[#0047FF] text-[var(--foreground)]'
                  : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold uppercase truncate">RECRUITER</span>
                {selectedRole === 'RECRUITER' && <Check className="w-3.5 h-3.5 text-[#0047FF]" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setValue('role', 'ADMIN')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedRole === 'ADMIN'
                  ? 'bg-[#0047FF]/10 border-[#0047FF] text-[var(--foreground)]'
                  : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold uppercase truncate">ADMIN</span>
                {selectedRole === 'ADMIN' && <Check className="w-3.5 h-3.5 text-[#0047FF]" />}
              </div>
            </button>
          </div>
        </div>

        {/* Identity Section */}
        <div className="space-y-3 pt-2">
          <label className="text-[10px] font-mono font-bold tracking-widest text-[var(--muted-foreground)] uppercase">
            // 02 / PROFESSIONAL IDENTITY
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <input
                {...register('firstName')}
                type="text"
                placeholder="First Name"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-[#0047FF] transition-all"
              />
              {errors.firstName && (
                <p className="text-[10px] text-rose-400 font-mono">● {errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <input
                {...register('lastName')}
                type="text"
                placeholder="Last Name"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-[#0047FF] transition-all"
              />
              {errors.lastName && (
                <p className="text-[10px] text-rose-400 font-mono">● {errors.lastName.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="space-y-3 pt-2">
          <label className="text-[10px] font-mono font-bold tracking-widest text-[var(--muted-foreground)] uppercase">
            // 03 / ACCOUNT CREDENTIALS
          </label>
          
          <div className="space-y-1">
            <input
              {...register('email')}
              type="email"
              placeholder="name@example.com"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-[#0047FF] transition-all"
            />
            {errors.email && (
              <p className="text-[10px] text-rose-400 font-mono">● {errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1 relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min 6 chars)"
              className="w-full px-4 pr-10 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-[#0047FF] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground-secondary)] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {errors.password && (
              <p className="text-[10px] text-rose-400 font-mono">● {errors.password.message}</p>
            )}
          </div>
        </div>

        {/* Primary Action */}
        <button
          type="submit"
          disabled={isSubmittingState}
          className="w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-xl bg-[#0047FF] hover:bg-blue-600 active:scale-[0.99] text-[var(--foreground)] text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0047FF]/20 mt-4"
        >
          {isSubmittingState ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span>CREATING PROFILE...</span>
            </>
          ) : (
            <>
              <span>CREATE PROFILE</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
