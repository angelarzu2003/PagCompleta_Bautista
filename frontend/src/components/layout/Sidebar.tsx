import React from 'react';
import {
  LayoutDashboard,
  FilePlus,
  FolderKanban,
  FileSearch,
  Files,
  BarChart3,
  BookOpen,
  Settings,
  ShieldCheck,
  Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SystemRoleCode } from '../../types/domain';
import { lastProjectId } from '../../utils/routing';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  allowedRoles?: SystemRoleCode[];
  badge?: string;
}

export const Sidebar: React.FC<{ onCloseMobile?: () => void }> = ({ onCloseMobile }) => {
  const { activeRole } = useAuth();
  const currentHash = window.location.hash || '#/inicio';
  const projectRef = encodeURIComponent(lastProjectId() || 'actual');

  // Matriz de navegación filtrada por los 7 roles globales (BR-010)
  const navItems: NavItem[] = [
    {
      name: 'Inicio / Tablero',
      href: '#/inicio',
      icon: LayoutDashboard,
    },
    {
      name: 'Nueva Propuesta',
      href: '#/proyectos/nuevo',
      icon: FilePlus,
      allowedRoles: ['researcher'], // Solo PI puede postular
    },
    {
      name: 'Expediente Maestro',
      href: `#/proyectos/${projectRef}`,
      icon: FolderKanban,
      allowedRoles: ['researcher', 'student_researcher', 'research_coordinator', 'committee_member', 'department_coordinator'],
    },
    {
      name: 'Bandeja de Revisión',
      href: '#/revision',
      icon: FileSearch,
      allowedRoles: ['research_coordinator', 'committee_member'],
    },
    {
      name: 'Gestor Documental',
      href: `#/proyectos/${projectRef}/documentos`,
      icon: Files,
      allowedRoles: ['researcher', 'student_researcher', 'research_coordinator', 'department_coordinator'],
    },
    {
      name: 'Productos Científicos (V05)',
      href: '#/productos',
      icon: Award,
      allowedRoles: ['researcher', 'research_coordinator', 'university_authority'],
    },
    {
      name: 'Subsanación Redline (V07)',
      href: '#/subsanacion',
      icon: FileSearch,
      allowedRoles: ['researcher', 'research_coordinator'],
    },
    {
      name: 'Dictamen Colegiado (V08)',
      href: '#/dictamen-colegiado',
      icon: ShieldCheck,
      allowedRoles: ['committee_member', 'research_coordinator'],
    },
    {
      name: 'Reportes e Indicadores',
      href: '#/reportes',
      icon: BarChart3,
      allowedRoles: ['research_coordinator', 'department_coordinator', 'university_authority', 'researcher'],
    },
    {
      name: 'Asistente Normativo IA',
      href: '#/normativa',
      icon: BookOpen,
      // Todos los roles autenticados pueden consultar normativa
    },
    {
      name: 'Administración y Bitácora',
      href: '#/administracion',
      icon: Settings,
      allowedRoles: ['administrator'], // Solo Administrador
    },
    {
      name: 'Portal Público QR / CVD',
      href: '#/verificar',
      icon: ShieldCheck,
      badge: 'Público',
    },
    {
      name: 'Resolución Rectoral',
      href: '#/resolucion?cvd=URP-9482-TX-2024',
      icon: Award,
    },
  ];

  // Filtrar según el rol activo
  const visibleItems = navItems.filter(item => {
    if (!item.allowedRoles) return true;
    return item.allowedRoles.includes(activeRole);
  });

  return (
    <aside className="w-[270px] bg-primary text-white flex flex-col h-full shrink-0 select-none border-r border-primary-dark">
      {/* Brand Header */}
      <div className="h-20 px-6 flex items-center gap-3 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-secondary to-blue-400 p-2 flex items-center justify-center text-white shadow-md">
          <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
            URPMP
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary/30 text-blue-200 border border-secondary/40">
              v1.1
            </span>
          </span>
          <span className="text-[11px] text-slate-300 font-medium truncate max-w-[170px]">
            Gestión de Proyectos
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-1.5">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Menú Institucional
        </div>
        {visibleItems.map(item => {
          const isActive = currentHash === item.href || (item.href !== '#/inicio' && currentHash.startsWith(item.href));
          const Icon = item.icon;

          return (
            <a
              key={item.name}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-secondary text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-slate-200">
                  {item.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Footer del Sidebar con versión institucional */}
      <div className="p-4 border-t border-white/10 text-[11px] text-slate-400 bg-primary-dark/40 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">Universidad Politécnica</span>
          <span className="font-mono text-[10px] text-emerald-400">● Conectado</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-normal">
          Firma Criptográfica SHA-256 Activa
        </p>
      </div>
    </aside>
  );
};
