import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

/**
 * Botón conforme a la regla de jerarquía de acción única de BASE.md (Sección 3.2):
 * - variant="primary": ÚNICO botón CTA primario (#0051d5) permitido por vista.
 * - type="button" por defecto para prevenir envíos involuntarios de formularios.
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  type = 'button', // Explícito según NFR-014
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-component transition-all duration-200 focus-visible:outline-2 focus-visible:outline-secondary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2 min-h-[40px]',
    lg: 'text-base px-6 py-3 gap-2.5 min-h-[48px]',
  };

  const variantStyles = {
    primary:
      'bg-secondary text-white hover:bg-secondary-hover shadow-sm active:scale-[0.99] font-semibold',
    secondary:
      'border border-slate-200 bg-white text-primary hover:bg-surface-sunken hover:border-slate-300 shadow-xs',
    outline:
      'border border-secondary text-secondary hover:bg-secondary-light/40 bg-transparent',
    ghost:
      'text-primary/80 hover:text-primary hover:bg-surface-sunken bg-transparent',
    danger:
      'border border-danger-border bg-danger-bg text-danger-text hover:bg-red-100',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
