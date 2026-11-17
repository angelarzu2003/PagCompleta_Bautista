import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TechDetails } from '../../components/ui/TechDetails';
import { api, PublicVerification } from '../../api/client';
import { getHashQueryParam } from '../../utils/routing';
import { formatCurrencyPEN, formatCurrencyUSD, formatDate } from '../../utils/formatters';
import { Download, ShieldCheck, Printer, AlertTriangle } from 'lucide-react';

/** Resolución de adjudicación pública, generada a partir del expediente aprobado. */
export const ResolutionView: React.FC = () => {
  const cvd = getHashQueryParam('cvd') || 'URP-9482-TX-2024';
  const [r, setR] = useState<PublicVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.verifyPublic(cvd).then(setR).catch(err => setError(err.message));
  }, [cvd]);

  if (error) {
    return (
      <Card padding="p-8" className="max-w-xl mx-auto text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <p className="text-sm text-slate-600">{error}</p>
      </Card>
    );
  }
  if (!r) return <div className="py-16 text-center text-sm text-slate-500">Cargando resolución…</div>;

  const resolutionNo = (r.resolution_number || '').replace(/^R\.R\.\s*/, '');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-semibold text-secondary uppercase tracking-wider">Acto Administrativo Oficial • Rectorado URPMP</span>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">Resolución Rectoral {r.resolution_number || '(pendiente)'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} icon={<Printer className="w-4 h-4" />}>
            Imprimir
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => api.downloadPublicCertificate(r.cvd_code).catch(err => alert(err.message))}
            icon={<Download className="w-4 h-4" />}
          >
            Descargar Constancia PDF
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={() => (window.location.hash = `#/verificar?cvd=${encodeURIComponent(r.cvd_code)}`)} icon={<ShieldCheck className="w-4 h-4" />}>
            Verificar Autenticidad
          </Button>
        </div>
      </div>

      <Card padding="p-8" className="space-y-8 bg-white border border-slate-300 shadow-elevated">
        <div className="text-center space-y-2 border-b border-slate-200 pb-6">
          <h2 className="text-base sm:text-lg font-bold text-primary uppercase tracking-wider">Universidad Regional Politécnica y de Posgrado</h2>
          <p className="text-xs font-semibold text-slate-600 font-mono">Rectorado • Secretaría General</p>
          <div className="inline-block mt-2 px-4 py-1 bg-slate-100 rounded-full font-mono text-xs font-bold text-primary border border-slate-200">
            RESOLUCIÓN RECTORAL {resolutionNo ? `Nº ${resolutionNo.replace(/^Nº\s*/, '')}` : ''}
          </div>
        </div>

        <div className="text-xs leading-relaxed text-slate-700 space-y-4 font-serif text-justify">
          <p>
            <strong>VISTO:</strong> El Dictamen Final del Comité Institucional de Ética y Evaluación de Proyectos de Investigación respecto al expediente anónimo{' '}
            <strong>{r.anonymous_code}</strong>
            {r.evaluation_score !== null && (
              <>
                , habiendo obtenido una calificación de <strong>{r.evaluation_score.toFixed(2)} / 100 Puntos</strong>
              </>
            )}
            ; y,
          </p>
          <p>
            <strong>CONSIDERANDO:</strong> Que la propuesta titulada <em>«{r.project_title}»</em>, presentada por la {r.department_name}, reúne los requisitos científicos, éticos y
            normativos de la convocatoria correspondiente, aprobada el {formatDate(r.approved_at)};
          </p>
          <p>
            <strong>SE RESUELVE:</strong>
          </p>
          <p className="pl-4 border-l-2 border-slate-300">
            <strong>ARTÍCULO PRIMERO.-</strong> ADJUDICAR el financiamiento por el monto de{' '}
            <strong>
              {formatCurrencyPEN(r.requested_funding)} ({formatCurrencyUSD(r.requested_funding / 3.75)} USD)
            </strong>{' '}
            al proyecto registrado bajo el código <strong>{r.project_code}</strong>, designando como Investigador Principal a <strong>{r.pi_full_name}</strong>, con periodo
            de ejecución del {formatDate(r.start_date)} al {formatDate(r.end_date)}.
          </p>
          {r.budget_breakdown.length > 0 && (
            <p className="pl-4 border-l-2 border-slate-300">
              <strong>ARTÍCULO SEGUNDO.-</strong> DISPONER el desembolso conforme al cronograma de hitos:{' '}
              {r.budget_breakdown.map((ph, i) => (
                <span key={ph.phase_number}>
                  {ph.percentage}% {ph.name.toLowerCase()} ({formatCurrencyPEN(ph.amount_pen)}){i < r.budget_breakdown.length - 1 ? ', ' : ''}
                </span>
              ))}{' '}
              previa validación de entregables.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-center">
          <div className="space-y-1">
            <div className="h-12 flex items-center justify-center font-mono text-xs text-secondary font-semibold">[Firmado Digitalmente]</div>
            <div className="border-t border-slate-300 pt-2">
              <p className="text-xs font-bold text-primary">Dr. Aurelio Benavides Castro</p>
              <p className="text-[11px] text-slate-500">Rector de la URPMP</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-12 flex items-center justify-center font-mono text-xs text-secondary font-semibold">[Firmado Digitalmente]</div>
            <div className="border-t border-slate-300 pt-2">
              <p className="text-xs font-bold text-primary">Secretaría General</p>
              <p className="text-[11px] text-slate-500">URPMP</p>
            </div>
          </div>
        </div>

        <TechDetails title="Trazabilidad Criptográfica de la Resolución" hash={r.document_hash} cvd={r.cvd_code} oid="2.16.604.1.101.44" />
      </Card>
    </div>
  );
};
