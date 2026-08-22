import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLElement>> = ({ className = '', ...props }) => <section className={`ui-card ${className}`} {...props} />;
export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => <div className={`border-b border-[var(--border)] px-5 py-4 ${className}`} {...props} />;
export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => <div className={`p-5 ${className}`} {...props} />;
export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => <div className={`border-t border-[var(--border)] px-5 py-4 ${className}`} {...props} />;
