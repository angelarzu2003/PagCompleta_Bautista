import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white border-t border-slate-200 py-6 px-4 md:px-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-primary">
            Universidad Regional Politécnica y de Posgrado (URPMP)
          </p>
          <p className="text-[12px] text-slate-500">
            Plataforma Universitaria de Gestión de Proyectos de Investigación © 2026. Todos los derechos reservados.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[12px]">
          <a href="#/normativa" className="hover:text-secondary transition-colors">
            Normativas Académicas
          </a>
          <span className="text-slate-300">|</span>
          <a href="#/verificar" className="hover:text-secondary transition-colors">
            Portal CVD
          </a>
          <span className="text-slate-300">|</span>
          <a href="#/ingresar" className="hover:text-secondary transition-colors">
            Aviso de Privacidad
          </a>
        </div>
      </div>
    </footer>
  );
};
