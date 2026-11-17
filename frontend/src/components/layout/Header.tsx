import React, { useEffect, useState } from 'react';
import {
  Menu,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppNotification, SystemRoleCode } from '../../types/domain';
import { api } from '../../api/client';
import { formatDate } from '../../utils/formatters';

interface HeaderProps {
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { user, activeRole, switchRole, logout, roleSwitcherEnabled } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [search, setSearch] = useState('');

  // Notificaciones reales del usuario (se refrescan cada minuto)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () =>
      api
        .getNotifications()
        .then(list => !cancelled && setNotifications(list))
        .catch(() => undefined);
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user, activeRole]);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const roleLabels: Record<SystemRoleCode, string> = {
    researcher: 'Investigador Principal (PI)',
    student_researcher: 'Estudiante Investigador',
    research_coordinator: 'Coordinador de Investigación',
    committee_member: 'Comité Evaluador',
    department_coordinator: 'Coordinador Departamento',
    university_authority: 'Autoridad Universitaria',
    administrator: 'Administrador del Sistema',
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => undefined);
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  };

  const openNotification = async (notif: AppNotification) => {
    if (!notif.read_at) {
      await api.markNotificationRead(notif.id).catch(() => undefined);
      setNotifications(prev => prev.map(n => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n)));
    }
    if (notif.project_id && activeRole !== 'administrator' && activeRole !== 'university_authority') {
      window.location.hash = `#/proyectos/${notif.project_id}`;
      setIsNotifOpen(false);
    }
  };

  // Búsqueda por código PID, CVD o título entre los proyectos visibles para el usuario
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = search.trim().toLowerCase();
    if (!term) return;
    if (/^urp-/i.test(term)) {
      window.location.hash = `#/verificar?cvd=${encodeURIComponent(search.trim())}`;
      return;
    }
    try {
      const projects = await api.getProjects();
      const match = projects.find(
        p => p.code.toLowerCase().includes(term) || p.title.toLowerCase().includes(term) || (p.anonymous_code || '').toLowerCase().includes(term)
      );
      if (match) window.location.hash = `#/proyectos/${match.id}`;
      else alert('No se encontró ningún proyecto visible para su rol con ese criterio.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200/90 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Lado Izquierdo: Botón Mobile + Buscador */}
      <div className="flex items-center gap-3 md:gap-6 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
          aria-label="Abrir menú lateral"
        >
          <Menu className="w-6 h-6" />
        </button>

        <form onSubmit={handleSearch} className="relative w-full max-w-md hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar proyectos"
            placeholder="Buscar por código PID, CVD o título de proyecto..."
            className="w-full pl-9 pr-4 py-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
          />
        </form>
      </div>

      {/* Lado Derecho: Rol Switcher (DEV), Notificaciones, Perfil */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Selector de Rol Activo - Visible en desarrollo (A5 / BASE.md 5.0) */}
        {roleSwitcherEnabled && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-secondary/30 bg-secondary-light/30 text-secondary text-xs font-semibold hover:bg-secondary-light/50 transition-colors"
              title="Herramienta de pruebas de roles en desarrollo"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="truncate max-w-[150px]">{roleLabels[activeRole]}</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-card shadow-modal border border-slate-200 py-1.5 z-50">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Conmutar Rol Activo (DEV)
                </div>
                {(Object.keys(roleLabels) as SystemRoleCode[]).map(roleKey => (
                  <button
                    type="button"
                    key={roleKey}
                    onClick={() => {
                      switchRole(roleKey);
                      setIsRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                      activeRole === roleKey
                        ? 'bg-secondary text-white font-semibold'
                        : 'text-primary hover:bg-slate-50'
                    }`}
                  >
                    <span>{roleLabels[roleKey]}</span>
                    {activeRole === roleKey && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Centro de Notificaciones (Popover colapsado por defecto FR-033..036) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded-full text-slate-600 hover:bg-surface-sunken relative focus:outline-none"
            aria-label="Centro de Notificaciones"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger-action text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-card shadow-modal border border-slate-200 overflow-hidden z-50 animate-in fade-in duration-150">
              <div className="px-4 py-3 border-b border-slate-100 bg-surface-sunken/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">Notificaciones</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary font-semibold">
                    {unreadCount} no leídas
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[11px] text-secondary hover:underline font-medium"
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No tienes notificaciones pendientes
                  </div>
                ) : (
                  notifications.map(notif => {
                    const isUnread = !notif.read_at;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => openNotification(notif)}
                        className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                          isUnread ? 'bg-blue-50/40' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {notif.kind === 'due_in_1_day' || notif.kind === 'overdue_today' ? (
                            <AlertTriangle className="w-4 h-4 text-danger-action" />
                          ) : notif.kind === 'due_in_7_days' ? (
                            <Clock className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-primary">{notif.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            {notif.message}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {formatDate(notif.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* Perfil de Usuario y Logout */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary text-white font-semibold text-xs flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-bold text-primary truncate max-w-[160px]">
              {user?.full_name}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {roleLabels[activeRole]}
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Cerrar Sesión"
            className="p-2 text-slate-400 hover:text-danger-action hover:bg-danger-bg rounded-lg transition-colors ml-1"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
