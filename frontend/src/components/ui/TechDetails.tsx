import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, Copy, Check } from 'lucide-react';

interface TechDetailsProps {
  title?: string;
  hash?: string;
  cvd?: string;
  blockNumber?: string | number;
  oid?: string;
  children?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * Componente de Divulgación Progresiva (<TechDetails>).
 * Cumple con NFR-014 y Fase 0: Muestra en primer plano el sello de confianza
 * y oculta hashes SHA-256, OIDs, y metadatos criptográficos extensos dentro de un acordeón.
 */
export const TechDetails: React.FC<TechDetailsProps> = ({
  title = 'Trazabilidad de Seguridad e Integridad Criptográfica',
  hash,
  cvd,
  blockNumber,
  oid,
  children,
  className = '',
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden bg-surface-sunken/40 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-medium text-slate-700 hover:bg-slate-100/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold text-primary">{title}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
            Integridad Verificada
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-200 bg-white space-y-3 text-xs">
          {cvd && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Código de Verificación Digital (CVD):</span>
              <span className="font-mono font-semibold text-primary tabular-nums bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {cvd}
              </span>
            </div>
          )}

          {blockNumber && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Bloque Ledger Inmutable:</span>
              <span className="font-mono text-slate-800 tabular-nums">#{blockNumber}</span>
            </div>
          )}

          {oid && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Identificador OID Institucional:</span>
              <span className="font-mono text-slate-800 tabular-nums">{oid}</span>
            </div>
          )}

          {hash && (
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Hash Criptográfico SHA-256:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(hash)}
                  className="inline-flex items-center gap-1 text-[11px] text-secondary hover:underline"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado' : 'Copiar hash'}
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 break-all select-all tabular-nums">
                {hash}
              </div>
            </div>
          )}

          {children}
        </div>
      )}
    </div>
  );
};
