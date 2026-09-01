import React from 'react';

interface LogoProps {
  variant?: 'icon' | 'horizontal' | 'full';
  height?: number | string;
  className?: string;
  animated?: boolean;
}

const LogoIcon: React.FC<{ size: number | string }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="CVthèque IA"
    className="shrink-0"
  >
    <rect width="36" height="36" rx="8" fill="var(--primary)" />
    <path
      d="M10 12H22M10 18H26M10 24H18"
      stroke="#FFFFFF"
      strokeWidth="2.5"
      strokeLinecap="square"
    />
    <circle cx="24" cy="24" r="3" fill="#FFFFFF" />
  </svg>
);

export const Logo: React.FC<LogoProps> = ({
  variant = 'horizontal',
  height = 36,
  className = '',
}) => {
  const numericHeight = typeof height === 'number' ? height : 36;

  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <LogoIcon size={height} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-3 select-none ${className}`}>
      <LogoIcon size={numericHeight} />
      <span className="flex flex-col">
        <span className="font-display text-base font-extrabold tracking-tight text-[var(--foreground)] leading-none">
          CVTHÈQUE
        </span>
        <span className="font-mono text-[9px] font-semibold tracking-widest text-[var(--primary)] uppercase mt-0.5">
          INTELLIGENCE
        </span>
      </span>
    </span>
  );
};
