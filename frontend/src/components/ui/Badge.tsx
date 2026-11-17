import React from 'react';
import { ProjectStatus, SystemRoleCode } from '../../types/domain';

interface BadgeProps {
  children?: React.ReactNode;
  status?: ProjectStatus | string;
  role?: SystemRoleCode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  status,
  role,
  variant,
  size = 'md',
  className = '',
}) => {
  let badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = children;

  if (status) {
    switch (status) {
      case 'Approved':
      case 'Closed':
        badgeStyles = 'bg-success-bg text-success-text border-success-border';
        label = label || (status === 'Approved' ? 'Aprobado' : 'Cerrado Formalmente');
        break;
      case 'In progress':
        badgeStyles = 'bg-blue-50 text-blue-700 border-blue-200';
        label = label || 'En Ejecución';
        break;
      case 'Under review':
        badgeStyles = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        label = label || 'En Evaluación';
        break;
      case 'Submitted':
        badgeStyles = 'bg-cyan-50 text-cyan-700 border-cyan-200';
        label = label || 'Enviado';
        break;
      case 'Changes requested':
      case 'Overdue':
        badgeStyles = 'bg-warning-bg text-warning-text border-warning-border';
        label = label || (status === 'Overdue' ? 'Vencido' : 'Observaciones');
        break;
      case 'Rejected':
      case 'Cancelled':
        badgeStyles = 'bg-danger-bg text-danger-text border-danger-border';
        label = label || (status === 'Rejected' ? 'Rechazado' : 'Cancelado');
        break;
      case 'Draft':
        badgeStyles = 'bg-slate-100 text-slate-600 border-slate-200';
        label = label || 'Borrador';
        break;
      case 'Closure requested':
        badgeStyles = 'bg-amber-50 text-amber-800 border-amber-200';
        label = label || 'Cierre Solicitado';
        break;
      default:
        badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200';
    }
  } else if (role) {
    const roleLabels: Record<SystemRoleCode, string> = {
      researcher: 'Investigador Principal',
      student_researcher: 'Estudiante Investigador',
      research_coordinator: 'Coordinador de Investigación',
      committee_member: 'Comité Evaluador',
      department_coordinator: 'Coord. Departamento',
      university_authority: 'Autoridad Universitaria',
      administrator: 'Administrador',
    };
    badgeStyles = 'bg-primary/5 text-primary border-primary/10';
    label = label || roleLabels[role] || role;
  } else if (variant) {
    const variantMap = {
      neutral: 'bg-slate-100 text-slate-700 border-slate-200',
      success: 'bg-success-bg text-success-text border-success-border',
      warning: 'bg-warning-bg text-warning-text border-warning-border',
      danger: 'bg-danger-bg text-danger-text border-danger-border',
      info: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    badgeStyles = variantMap[variant];
  }

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-pill tracking-tight select-none ${sizeClass} ${badgeStyles} ${className}`}
    >
      {label}
    </span>
  );
};
