import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'p-4' | 'p-6' | 'p-8';
  onClick?: () => void;
}

/**
 * Tarjeta de superficie institucional (A5 / BASE.md 3.2).
 * Respeta el respiro visual estricto (mínimo p-4, recomendado p-6 o p-8).
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'p-6',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-card border border-slate-200/90 shadow-soft transition-all duration-200 ${padding} ${
        onClick ? 'cursor-pointer hover:border-secondary/40 hover:shadow-elevated' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
