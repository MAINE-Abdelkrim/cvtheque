import React from 'react';
import { useAuth } from '../../providers/auth-provider';

interface GoogleLoginButtonProps {
  id?: string;
  onClick?: () => void;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ id, onClick }) => {
  const { signInWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      if (onClick) onClick();
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.message?.includes('popup-closed-by-user')) {
        return;
      }
      console.error('Failed to log in with Google:', e);
    }
  };

  return (
    <button
      id={id}
      type="button"
      onClick={handleGoogleLogin}
      className="w-full flex items-center justify-center space-x-3 px-5 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-sm font-medium text-[var(--foreground)] transition-all cursor-pointer hover:border-[var(--border-strong)] active:scale-98"
    >
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
      <span>Continuer avec Google</span>
    </button>
  );
};
