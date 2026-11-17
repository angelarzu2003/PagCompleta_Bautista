import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { SystemRoleCode } from '../../types/domain';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

interface ProtectedRouteProps {
  allowedRoles?: SystemRoleCode[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, activeRole, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center px-4">
        <ShieldAlert className="w-12 h-12 text-secondary mb-4" />
        <h2 className="text-xl font-bold text-primary">Acceso Requerido</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Debe iniciar sesión mediante SSO institucional para acceder a este módulo.
        </p>
        <Button
          type="button"
          variant="primary"
          className="mt-6"
          onClick={() => (window.location.hash = '#/ingresar')}
        >
          Ir al Inicio de Sesión
        </Button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(activeRole)) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center px-4 bg-white rounded-card border border-slate-200 p-8 shadow-soft my-8">
        <div className="w-12 h-12 rounded-full bg-danger-bg text-danger-text flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-primary">Acceso Restringido (403 Forbidden)</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
          Su rol activo no cuenta con los privilegios requeridos para consultar o editar este módulo (Regla BR-010 de la Matriz de Permisos).
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Utilice el selector de roles en la barra superior (modo DEV) para conmutar a un rol autorizado.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-6"
          onClick={() => (window.location.hash = '#/inicio')}
        >
          Volver al Tablero Principal
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
