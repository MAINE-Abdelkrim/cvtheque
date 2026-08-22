import React from 'react';

interface LogoProps { variant?: 'icon' | 'horizontal' | 'full'; height?: number | string; className?: string; animated?: boolean; }

const LogoIcon: React.FC<{ size: number | string }> = ({ size }) => <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="CVthèque"><rect x="1" y="1" width="34" height="34" rx="9" fill="var(--primary)" /><path d="M11 9.5h10l4 4V27H11V9.5Z" fill="none" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinejoin="round" /><path d="M21 9.5v5h4M15 19h7M15 23h5" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export const Logo: React.FC<LogoProps> = ({ variant = 'horizontal', height = 36, className = '' }) => {
  const numericHeight = typeof height === 'number' ? height : 36;
  if (variant === 'icon') return <span className={`inline-flex ${className}`}><LogoIcon size={height} /></span>;
  return <span className={`inline-flex items-center gap-2.5 ${className}`}><LogoIcon size={numericHeight} /><span className="text-base font-semibold tracking-[-0.02em] text-[var(--foreground)]">CVthèque</span></span>;
};
