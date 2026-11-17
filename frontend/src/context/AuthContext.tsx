import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserProfile, SystemRoleCode } from '../types/domain';
import { api, SessionResponse } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  activeRole: SystemRoleCode;
  isAuthenticated: boolean;
  /** true mientras se consulta al servidor si existe una sesión previa (cookie). */
  isRestoring: boolean;
  isPrivacyModalOpen: boolean;
  csrfToken: string;
  /** El servidor decide si el selector de roles de pruebas está disponible. */
  roleSwitcherEnabled: boolean;
  login: (provider: string, email: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: SystemRoleCode) => Promise<void>;
  acceptPrivacy: () => Promise<void>;
}

/**
 * Compatibilidad: antes era una constante de compilación. Ahora la habilitación real la
 * decide el backend (ENABLE_DEV_ROLE_SWITCHER) y se expone en `roleSwitcherEnabled`.
 */
export const DEV_ROLE_SWITCHER_ENABLED: boolean = import.meta.env?.VITE_ENABLE_DEV_ROLE_SWITCHER !== 'false';

const idleMinutes = Number(import.meta.env?.VITE_IDLE_TIMEOUT_MINUTES);
const DEFAULT_IDLE_MS = (Number.isFinite(idleMinutes) && idleMinutes > 0 ? idleMinutes : 30) * 60 * 1000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<SystemRoleCode>('researcher');
  const [isRestoring, setIsRestoring] = useState(true);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [roleSwitcherEnabled, setRoleSwitcherEnabled] = useState(false);
  const [idleMs, setIdleMs] = useState(DEFAULT_IDLE_MS);

  const applySession = (s: SessionResponse) => {
    setCsrfToken(s.csrf_token);
    setUser(s.user);
    setActiveRole(s.active_role);
    setRoleSwitcherEnabled(Boolean(s.role_switcher_enabled) && DEV_ROLE_SWITCHER_ENABLED);
    if (s.idle_timeout_minutes) setIdleMs(s.idle_timeout_minutes * 60 * 1000);
    setIsPrivacyModalOpen(!s.user.privacy_accepted_at);
  };

  const clearSession = useCallback(() => {
    setCsrfToken('');
    setUser(null);
    setActiveRole('researcher');
    setIsPrivacyModalOpen(false);
  }, []);

  const logout = useCallback(() => {
    api.logout().catch(() => undefined);
    clearSession();
    window.location.hash = '#/ingresar';
  }, [clearSession]);

  // Restaurar la sesión existente (cookie HttpOnly) al recargar la página
  useEffect(() => {
    let cancelled = false;
    api
      .getSession()
      .then(s => {
        if (!cancelled && s) applySession(s);
      })
      .catch(err => console.error('No se pudo restaurar la sesión:', err))
      .finally(() => !cancelled && setIsRestoring(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Si el servidor responde 401 (sesión expirada o revocada) se vuelve al login
  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      clearSession();
      window.location.hash = '#/ingresar';
    });
    return () => api.setUnauthorizedHandler(null);
  }, [clearSession]);

  // Cierre por inactividad (NFR-004). El servidor también expira la sesión por su cuenta.
  useEffect(() => {
    if (!user) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(logout, idleMs);
    };
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, logout, idleMs]);

  const login = async (provider: string, email: string) => {
    const s = await api.login(provider, email);
    applySession(s);
  };

  const switchRole = async (newRole: SystemRoleCode) => {
    if (!user) return;
    try {
      const s = await api.switchRole(newRole);
      applySession(s);
      window.location.hash = '#/inicio';
    } catch (err: any) {
      alert(err.message || 'No se pudo cambiar de rol.');
    }
  };

  const acceptPrivacy = async () => {
    if (!user) return;
    const updated = await api.acceptPrivacy();
    setUser(updated);
    setIsPrivacyModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        isAuthenticated: !!user,
        isRestoring,
        isPrivacyModalOpen,
        csrfToken,
        roleSwitcherEnabled,
        login,
        logout,
        switchRole,
        acceptPrivacy,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
