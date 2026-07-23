import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../providers/auth-provider';
import { UserRole } from '../../types';
import { Mail, Lock, User, Briefcase, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const registerSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().min(1, 'L\'adresse e-mail est requise').email('Format d\'adresse e-mail invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['CANDIDATE', 'RECRUITER', 'ADMIN'] as const),
});

type RegisterSchemaType = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
  id?: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, id }) => {
  const { signUp, signInWithGoogle } = useAuth();
  const [authMethod, setAuthMethod] = useState<'select' | 'email' | 'google-role'>('select');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmittingState, setIsSubmittingState] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
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
  const emailValue = watch('email');
  const firstNameValue = watch('firstName');
  const lastNameValue = watch('lastName');

  const handleGoogleSignup = async (role: UserRole) => {
    setIsSubmittingState(true);
    setGeneralError(null);
    try {
      await signInWithGoogle(role);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      console.error('Failed registration with Google:', e);
      setGeneralError(e.message || 'Erreur lors de la création de compte Google.');
    } finally {
      setIsSubmittingState(false);
    }
  };

  const handleNextStep = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    
    if (step === 1) {
      const isNamesValid = await trigger(['firstName', 'lastName']);
      if (isNamesValid) setStep(2);
    } else if (step === 2) {
      const isEmailValid = await trigger('email');
      if (isEmailValid) setStep(3);
    } else if (step === 3) {
      const isPasswordValid = await trigger('password');
      if (isPasswordValid) setStep(4);
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
      setGeneralError(e.message || 'Erreur lors de l\'inscription. Veuillez réessayer.');
    } finally {
      setIsSubmittingState(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step < 4) {
      handleNextStep();
    } else {
      handleSubmit(onSubmit)(e);
    }
  };

  return (
    <div className="space-y-4">
      {generalError && (
        <div className="flex items-start space-x-2 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {authMethod === 'select' ? (
          <motion.div
            key="select-method-register"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <p className="text-center text-xs text-slate-400 mb-2 font-medium">
              Choisissez votre méthode d'inscription :
            </p>

            {/* Direct Google Login/Signup Button */}
            <button
              type="button"
              onClick={() => setAuthMethod('google-role')}
              disabled={isSubmittingState}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-[#0066FF]/40 text-slate-200 transition-all cursor-pointer active:scale-[0.99] group disabled:opacity-50"
            >
              <div className="flex items-center space-x-3.5">
                <div className="bg-white/5 p-2 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" width="24" height="24">
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
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">S'inscrire avec Google</p>
                  <p className="text-[11px] text-slate-400">Création directe et sécurisée</p>
                </div>
              </div>
              <ArrowRight className="w-4.5 h-4.5 text-slate-500 group-hover:text-white transition-colors" />
            </button>

            {/* Email selection Button */}
            <button
              type="button"
              onClick={() => {
                setAuthMethod('email');
                setStep(1);
              }}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-[#7C3AED]/40 text-slate-200 transition-all cursor-pointer active:scale-[0.99] group"
            >
              <div className="flex items-center space-x-3.5">
                <div className="bg-[#7C3AED]/10 p-2 rounded-lg text-[#7C3AED]">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Adresse e-mail</p>
                  <p className="text-[11px] text-slate-400">Inscription par étapes avec e-mail</p>
                </div>
              </div>
              <ArrowRight className="w-4.5 h-4.5 text-slate-500 group-hover:text-white transition-colors" />
            </button>
          </motion.div>
        ) : authMethod === 'google-role' ? (
          <motion.div
            key="google-role-register"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="flex items-center space-x-2 text-xs text-slate-400 mb-2">
              <button
                type="button"
                onClick={() => setAuthMethod('select')}
                className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour</span>
              </button>
              <span>/</span>
              <span className="text-indigo-400 font-medium font-mono text-[10px]">Type de compte</span>
            </div>

            <p className="text-center text-xs text-slate-400 mb-2 font-medium">
              Veuillez sélectionner votre type de compte Google :
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleGoogleSignup('CANDIDATE')}
                disabled={isSubmittingState}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-[#0066FF]/40 text-slate-200 transition-all cursor-pointer active:scale-[0.99] group disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Candidat</p>
                  <p className="text-[11px] text-slate-400">Chercher un emploi et gérer mes CVs</p>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-slate-500 group-hover:text-white transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => handleGoogleSignup('RECRUITER')}
                disabled={isSubmittingState}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-[#0066FF]/40 text-slate-200 transition-all cursor-pointer active:scale-[0.99] group disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Recruteur</p>
                  <p className="text-[11px] text-slate-400">Publier des offres et recruter des talents</p>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-slate-500 group-hover:text-white transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => handleGoogleSignup('ADMIN')}
                disabled={isSubmittingState}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-[#0066FF]/40 text-slate-200 transition-all cursor-pointer active:scale-[0.99] group disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Admin</p>
                  <p className="text-[11px] text-slate-400">Gérer la plateforme et la configuration</p>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>
          </motion.div>
        ) : (
          <form id={id} onSubmit={handleFormSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step-names"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('select')}
                      className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Retour</span>
                    </button>
                    <span>/</span>
                    <span className="text-indigo-400 font-medium">Votre Identité</span>
                  </div>

                  {/* Name Fields (Row) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Prénom</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          {...register('firstName')}
                          type="text"
                          autoFocus
                          placeholder="Alex"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900/45 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 focus:border-[#0066FF] transition-all"
                        />
                      </div>
                      {errors.firstName && (
                        <p className="text-[10px] text-rose-400 font-mono mt-0.5">{errors.firstName.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Nom</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          {...register('lastName')}
                          type="text"
                          placeholder="Bernard"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900/45 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 focus:border-[#0066FF] transition-all"
                        />
                      </div>
                      {errors.lastName && (
                        <p className="text-[10px] text-rose-400 font-mono mt-0.5">{errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-semibold transition-all cursor-pointer"
                  >
                    <span>Suivant</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step-email-reg"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{firstNameValue || 'Retour'}</span>
                    </button>
                    <span>/</span>
                    <span className="text-indigo-400 font-medium">Adresse e-mail</span>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Adresse e-mail</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Mail className="w-4.5 h-4.5" />
                      </div>
                      <input
                        {...register('email')}
                        type="email"
                        autoFocus
                        placeholder="nom@exemple.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/45 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 focus:border-[#0066FF] transition-all"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[10px] text-rose-400 font-mono mt-0.5">{errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-semibold transition-all cursor-pointer"
                  >
                    <span>Suivant</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step-password-reg"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{emailValue || 'Retour'}</span>
                    </button>
                    <span>/</span>
                    <span className="text-indigo-400 font-medium">Mot de passe</span>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Mot de passe</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4.5 h-4.5" />
                      </div>
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        autoFocus
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-800 bg-slate-900/45 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 focus:border-[#0066FF] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-[10px] text-rose-400 font-mono mt-0.5">{errors.password.message}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-semibold transition-all cursor-pointer"
                  >
                    <span>Suivant</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step-role-reg"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Mot de passe</span>
                    </button>
                    <span>/</span>
                    <span className="text-indigo-400 font-medium">Votre rôle</span>
                  </div>

                  {/* Role Selection (SaaS tabs) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Votre profil d'utilisation</label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setValue('role', 'CANDIDATE')}
                        className={`py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          selectedRole === 'CANDIDATE'
                            ? 'bg-[#0066FF] text-white shadow-sm shadow-[#0066FF]/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                        }`}
                      >
                        Candidat
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('role', 'RECRUITER')}
                        className={`py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          selectedRole === 'RECRUITER'
                            ? 'bg-[#0066FF] text-white shadow-sm shadow-[#0066FF]/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                        }`}
                      >
                        Recruteur
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('role', 'ADMIN')}
                        className={`py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          selectedRole === 'ADMIN'
                            ? 'bg-[#0066FF] text-white shadow-sm shadow-[#0066FF]/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                        }`}
                      >
                        Admin
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingState}
                    className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#7C3AED] hover:brightness-110 hover:shadow-lg hover:shadow-[#0066FF]/15 active:scale-98 text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingState ? (
                      <>
                        <Loader2 className="w-4.5 h-4.5 animate-spin mr-2" />
                        <span>Création du compte...</span>
                      </>
                    ) : (
                      <span>Créer mon compte</span>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </AnimatePresence>
    </div>
  );
};
