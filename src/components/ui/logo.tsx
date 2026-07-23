import React from 'react';

interface LogoProps {
  className?: string;
  height?: number | string;
  variant?: 'full' | 'icon' | 'horizontal';
  animated?: boolean;
}

export const LogoIcon: React.FC<{ className?: string; height?: number | string; animated?: boolean }> = ({
  className = '',
  height = 40,
  animated = false,
}) => {
  return (
    <svg
      viewBox="0 0 160 160"
      className={`${className} ${animated ? 'animate-pulse' : ''}`}
      style={{ height, width: 'auto' }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Document Body Gradient */}
        <linearGradient id="docBgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B192C" />
          <stop offset="100%" stopColor="#1E3E62" />
        </linearGradient>

        {/* Brand Main Gradient (Blue to Purple) */}
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="0.8">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="50%" stopColor="#5B21B6" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>

        {/* CV Text Gradient */}
        <linearGradient id="cvTextGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Circuits Gradient */}
        <linearGradient id="circuitGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="60%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Glow Filter for High-tech feel */}
        <filter id="logoGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Main Document Body (with folded top-right corner) */}
      <path
        d="M35 25 H105 L125 45 V125 C125 130.523 120.523 135 115 135 H35 C29.477 135 25 130.523 25 125 V35 C25 29.477 29.477 25 35 25 Z"
        fill="url(#docBgGrad)"
        stroke="url(#logoGrad)"
        strokeWidth="2.5"
      />

      {/* Folded Corner */}
      <path
        d="M105 25 V45 H125 L105 25 Z"
        fill="#0066FF"
        stroke="url(#logoGrad)"
        strokeWidth="1.5"
      />

      {/* User Silhouette Inside the Document */}
      <circle cx="58" cy="50" r="10" fill="#E2E8F0" />
      <path
        d="M44 72 C44 64.268 50.268 58 58 58 C65.732 58 72 64.268 72 72 H44 Z"
        fill="#E2E8F0"
      />

      {/* Three Horizontal Text Lines next to the profile */}
      <rect x="80" y="44" width="30" height="3" rx="1.5" fill="#94A3B8" />
      <rect x="80" y="52" width="22" height="3" rx="1.5" fill="#94A3B8" />
      <rect x="80" y="60" width="35" height="3" rx="1.5" fill="#94A3B8" />

      {/* Three List Bars on the left middle */}
      <rect x="34" y="84" width="14" height="2" rx="1" fill="#64748B" />
      <rect x="34" y="90" width="14" height="2" rx="1" fill="#64748B" />
      <rect x="34" y="96" width="14" height="2" rx="1" fill="#64748B" />

      {/* 'CV' Styled text in the document footer */}
      <text
        x="38"
        y="125"
        fill="url(#cvTextGrad)"
        fontFamily="system-ui, sans-serif"
        fontSize="34"
        fontWeight="800"
        letterSpacing="-1"
      >
        CV
      </text>

      {/* Branching AI / Circuit Traces emerging from the right */}
      {/* Trace 1 (Top right) */}
      <path
        d="M102 100 H112 L124 88 H134"
        stroke="url(#circuitGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={animated ? 'animate-pulse' : ''}
      />
      <circle cx="134" cy="88" r="3.5" fill="#A855F7" filter="url(#logoGlow)" />

      {/* Trace 2 (Middle upper right) */}
      <path
        d="M94 110 H110 L126 94 H146"
        stroke="url(#circuitGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="146" cy="94" r="3.5" fill="#6366F1" filter="url(#logoGlow)" />

      {/* Trace 3 (Middle right) */}
      <path
        d="M110 115 L124 101 H152"
        stroke="url(#circuitGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="152" cy="101" r="3.5" fill="#38BDF8" filter="url(#logoGlow)" />

      {/* Trace 4 (Bottom right) */}
      <path
        d="M105 124 H120 L132 112 H142"
        stroke="url(#circuitGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="142" cy="112" r="3.5" fill="#A855F7" />
    </svg>
  );
};

export const LogoText: React.FC<{ className?: string; height?: number | string }> = ({
  className = '',
  height = 40,
}) => {
  return (
    <svg
      viewBox="0 0 340 100"
      className={className}
      style={{ height, width: 'auto' }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Brand Text Gradient */}
        <linearGradient id="textGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="85%" stopColor="#7C3AED" />
        </linearGradient>

        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0066FF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#6366F1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* CVthèque IA Text */}
      <text
        x="10"
        y="52"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="46"
        fontWeight="800"
        letterSpacing="-0.5"
      >
        <tspan fill="#0066FF">CV</tspan>
        <tspan fill="#F8FAFC" className="logo-theque-text">thèque</tspan>
        <tspan fill="#A855F7"> IA</tspan>
      </text>

      {/* Sparkle star */}
      <path
        d="M260 14 L263 21 L270 24 L263 27 L260 34 L257 27 L250 24 L257 21 Z"
        fill="#A855F7"
      />

      {/* Tagline separator lines */}
      <line x1="10" y1="72" x2="65" y2="72" stroke="#0066FF" strokeWidth="1.5" />
      <line x1="275" y1="72" x2="330" y2="72" stroke="#7C3AED" strokeWidth="1.5" />

      {/* Tagline Text */}
      <text
        x="170"
        y="76"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="10"
        fontWeight="700"
        letterSpacing="2.5"
        fill="#94A3B8"
        textAnchor="middle"
      >
        TROUVEZ LE TALENT, GAGNEZ L'AVENIR
      </text>
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({
  className = '',
  height = 44,
  variant = 'full',
  animated = false,
}) => {
  if (variant === 'icon') {
    return <LogoIcon className={className} height={height} animated={animated} />;
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center space-x-2.5 ${className}`}>
        <LogoIcon height={height} animated={animated} />
        <LogoText height={typeof height === 'number' ? height * 0.9 : height} />
      </div>
    );
  }

  // Default Vertical full logo
  return (
    <div className={`flex flex-col items-center text-center space-y-4 ${className}`}>
      <LogoIcon height={typeof height === 'number' ? height * 1.5 : height} animated={animated} />
      <LogoText height={height} />
    </div>
  );
};
