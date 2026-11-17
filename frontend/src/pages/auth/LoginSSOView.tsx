import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, CheckCircle2, School, ArrowRight, Lock, UserCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { api, LoginAccount } from '../../api/client';

const ROLE_LABELS: Record<string, string> = {
  researcher: 'Investigador Principal',
  student_researcher: 'Estudiante Investigador',
  research_coordinator: 'Coordinación de Investigación',
  committee_member: 'Comité Evaluador',
  department_coordinator: 'Coordinación de Departamento',
  university_authority: 'Autoridad Universitaria',
  administrator: 'Administración del Sistema',
};

export const LoginSSOView: React.FC = () => {
  const { login } = useAuth();
  const [selectedProvider, setSelectedProvider] = useState<'entra' | 'google' | 'saml'>('entra');
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLoginAccounts()
      .then(list => {
        setAccounts(list);
        if (list.length) setSelectedEmail(list.find(a => a.roles.includes('researcher'))?.email || list[0].email);
      })
      .catch(err => setError(err.message));
  }, []);

  const handleLogin = async () => {
    if (!selectedEmail) {
      setError('Seleccione su cuenta institucional.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await login(selectedProvider, selectedEmail);
      window.location.hash = '#/inicio';
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-100 flex flex-col justify-between py-8 px-4 relative overflow-hidden">
      {/* Marca de agua institucional de fondo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-[0.03]">
        <School className="w-[600px] h-[600px] text-primary" />
      </div>

      {/* Header Institucional Superior */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary p-2 flex items-center justify-center text-white shadow-md">
            <School className="w-6 h-6" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-primary block">URPMP</span>
            <span className="text-xs text-slate-500 hidden sm:block">Plataforma de Proyectos de Investigación</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Acceso Seguro SSO</span>
        </div>
      </header>

      {/* Tarjeta Central de Acceso (V01) */}
      <main className="w-full max-w-[580px] mx-auto z-10 my-8">
        <div className="bg-white/95 backdrop-blur-md rounded-[28px] border border-slate-200/90 shadow-modal p-8 sm:p-12 flex flex-col gap-8">
          {/* Identidad y Bienvenida */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center ring-4 ring-secondary/5 mb-1">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Acceso Institucional
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
              Inicie sesión mediante su proveedor de identidad federado.
            </p>
          </div>

          {/* Selector de Proveedor SSO (FR-001, CON-002: Cero contraseñas locales) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 text-[11px] font-mono text-slate-500 font-semibold uppercase tracking-wider">
              <span>1. Seleccionar Proveedor</span>
              <span className="text-secondary bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                OIDC / SAML 2.0
              </span>
            </div>

            {/* Microsoft Entra ID */}
            <button
              type="button"
              onClick={() => setSelectedProvider('entra')}
              className={`w-full py-3.5 px-5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between transition-all duration-200 ${
                selectedProvider === 'entra'
                  ? 'border-secondary bg-blue-50/50 text-primary shadow-xs ring-2 ring-secondary/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="grid grid-cols-2 gap-0.5 w-4 h-4 shrink-0">
                  <span className="bg-[#f25022] rounded-xs" />
                  <span className="bg-[#7fba00] rounded-xs" />
                  <span className="bg-[#00a4ef] rounded-xs" />
                  <span className="bg-[#ffb900] rounded-xs" />
                </div>
                <span>Microsoft Entra ID (@urpmp.edu.pe)</span>
              </div>
              {selectedProvider === 'entra' ? (
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-300" />
              )}
            </button>

            {/* Google Workspace */}
            <button
              type="button"
              onClick={() => setSelectedProvider('google')}
              className={`w-full py-3.5 px-5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between transition-all duration-200 ${
                selectedProvider === 'google'
                  ? 'border-secondary bg-blue-50/50 text-primary shadow-xs ring-2 ring-secondary/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google Workspace Institucional</span>
              </div>
              {selectedProvider === 'google' ? (
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-300" />
              )}
            </button>

            {/* SAML Institucional */}
            <button
              type="button"
              onClick={() => setSelectedProvider('saml')}
              className={`w-full py-3.5 px-5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between transition-all duration-200 ${
                selectedProvider === 'saml'
                  ? 'border-secondary bg-blue-50/50 text-primary shadow-xs ring-2 ring-secondary/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
                <span>SAML 2.0 Institucional (Docentes / Investigadores)</span>
              </div>
              {selectedProvider === 'saml' ? (
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-300" />
              )}
            </button>
          </div>

          {/* Selección de cuenta institucional (IdP local de la plataforma) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 text-[11px] font-mono text-slate-500 font-semibold uppercase tracking-wider">
              <span>2. Cuenta Institucional</span>
              <span className="text-slate-500 bg-surface-sunken px-2 py-0.5 rounded-full border border-slate-200">
                {accounts.length} cuentas
              </span>
            </div>
            <label htmlFor="login-account" className="sr-only">Cuenta institucional</label>
            <div className="relative">
              <UserCircle2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="login-account"
                value={selectedEmail}
                onChange={e => setSelectedEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.email}>
                    {a.full_name} — {a.roles.map(r => ROLE_LABELS[r] || r).join(', ')}
                  </option>
                ))}
              </select>
            </div>
            {selectedEmail && (
              <p className="text-[11px] text-slate-500 font-mono px-1">
                {selectedEmail} · {accounts.find(a => a.email === selectedEmail)?.department_name}
              </p>
            )}
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Único Botón CTA Primario (#0051d5) de la vista */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            onClick={handleLogin}
            className="w-full shadow-md"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Entrar con Cuenta Institucional
          </Button>

          {/* Aviso Legal de Cero Contraseñas Locales (CON-002) */}
          <div className="p-3.5 rounded-xl bg-surface-sunken border border-slate-200 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Seguridad Institucional:</strong> La URPMP nunca solicitará ni almacenará contraseñas en este portal. La autenticación es delegada directamente a los servidores autorizados.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Mínimo */}
      <footer className="w-full text-center text-xs text-slate-400 z-10 py-2">
        Plataforma URPMP • Trazabilidad y Seguridad Institucional Certificada
      </footer>
    </div>
  );
};
