import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TechDetails } from '../../components/ui/TechDetails';
import { api, PublicVerification } from '../../api/client';
import { getHashQueryParam } from '../../utils/routing';
import { formatCurrencyPEN, formatDate } from '../../utils/formatters';
import { ShieldCheck, Download, ExternalLink, Search, XCircle } from 'lucide-react';

const DEFAULT_CVD = 'URP-9482-TX-2024';

/** Verificación pública de documentos por Código de Verificación Digital (V13 / RF-10). No requiere sesión. */
export const PublicVerificationView: React.FC = () => {
  const [code, setCode] = useState(getHashQueryParam('cvd') || DEFAULT_CVD);
  const [record, setRecord] = useState<PublicVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async (cvd: string) => {
    if (!cvd.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setRecord(await api.verifyPublic(cvd.trim()));
    } catch (err: any) {
      setRecord(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.history.replaceState(null, '', `#/verificar?cvd=${encodeURIComponent(code.trim())}`);
    verify(code);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4 px-2">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Código CVD (ej. URP-9482-TX-2024)"
            aria-label="Código de Verificación Digital"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" isLoading={loading}>
          Verificar
        </Button>
      </form>

      {error && (
        <Card padding="p-6" className="text-center space-y-3 border-2 border-red-200">
          <XCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-lg font-bold text-primary">Documento no encontrado</h1>
          <p className="text-xs text-slate-500">{error}</p>
        </Card>
      )}

      {record && (
        <Card padding="p-6" className={`text-center space-y-6 border-2 shadow-elevated ${record.valid ? 'border-emerald-500/20' : 'border-red-300'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ring-8 ${record.valid ? 'bg-emerald-50 text-emerald-600 ring-emerald-500/10' : 'bg-red-50 text-red-600 ring-red-500/10'}`}>
            <ShieldCheck className="w-9 h-9 stroke-[2.2]" />
          </div>

          <div className="space-y-1">
            <span
              className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                record.valid ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
              }`}
            >
              {record.valid ? 'Documento Auténtico y Vigente' : 'Documento Anulado'}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tight mt-2">Verificación Digital Institucional (CVD)</h1>
            <p className="text-xs text-slate-500 font-mono">
              Código CVD: <strong className="text-primary tabular-nums">{record.cvd_code}</strong>
            </p>
          </div>

          <div className="bg-surface-sunken p-4 rounded-xl border border-slate-200 text-left text-xs space-y-3">
            <div className="border-b border-slate-200/80 pb-2">
              <span className="text-slate-400 block text-[11px]">Proyecto de Investigación Acreditado:</span>
              <p className="font-bold text-primary text-sm mt-0.5 leading-snug">{record.project_title}</p>
              <span className="font-mono text-xs text-secondary font-bold block mt-1">{record.project_code}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Investigador Principal:</span>
                <p className="font-semibold text-primary">{record.pi_full_name}</p>
                {/* NFR-009: DNI enmascarado en vistas públicas */}
                <span className="font-mono text-slate-500 text-[11px]">DNI: {record.pi_masked_national_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Resolución de Adjudicación:</span>
                <p className="font-semibold text-primary">{record.resolution_number || '—'}</p>
                {record.evaluation_score !== null && <span className="text-slate-500 text-[11px]">Calificación: {record.evaluation_score.toFixed(2)} / 100 Pts</span>}
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Monto adjudicado:</span>
                <p className="font-mono font-semibold text-primary">{formatCurrencyPEN(record.requested_funding)}</p>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Periodo de ejecución:</span>
                <p className="text-primary">
                  {formatDate(record.start_date)} – {formatDate(record.end_date)}
                </p>
              </div>
            </div>
          </div>

          <TechDetails title="Huella de Integridad del Registro" hash={record.document_hash} cvd={record.cvd_code} oid="2.16.604.1.101.44">
            <div className="text-[11px] text-slate-500 space-y-1 pt-1">
              <p>• La huella SHA-256 se recalcula en el servidor con los datos oficiales del expediente en cada consulta.</p>
              <p>• Aprobado el {formatDate(record.approved_at)} · {record.department_name}</p>
            </div>
          </TechDetails>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (window.location.hash = `#/resolucion?cvd=${encodeURIComponent(record.cvd_code)}`)}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              Ver Resolución Completa
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => api.downloadPublicCertificate(record.cvd_code).catch(err => alert(err.message))}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Descargar Constancia Oficial (PDF)
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
