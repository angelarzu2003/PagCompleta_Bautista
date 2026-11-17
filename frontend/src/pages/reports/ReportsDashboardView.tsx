import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { api, Catalogs, ReportSummary } from '../../api/client';
import { Project } from '../../types/domain';
import { formatCurrencyPEN, formatDate } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { Download, FileSpreadsheet, Filter, CheckCircle2, AlertTriangle } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  Draft: 'Borrador',
  Submitted: 'Enviado',
  'Under review': 'En evaluación',
  Approved: 'Aprobado',
  Rejected: 'Rechazado',
  'Changes requested': 'Subsanación',
  'In progress': 'En ejecución',
  Suspended: 'Suspendido',
  'Closure requested': 'Cierre solicitado',
  Closed: 'Cerrado',
  Cancelled: 'Cancelado',
};

export const ReportsDashboardView: React.FC = () => {
  const { activeRole } = useAuth();
  const [selectedReportKind, setSelectedReportKind] = useState<'projects' | 'products' | 'overdue' | 'sheet'>('projects');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetProjectId, setSheetProjectId] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    api.getCatalogs().then(setCatalogs).catch(() => undefined);
  }, []);

  useEffect(() => {
    setError(null);
    api
      .getReportSummary({ department_id: filterDepartment, year: filterYear })
      .then(r => {
        setReport(r);
        setSheetProjectId(prev => (r.projects.some(p => p.id === prev) ? prev : r.projects[0]?.id || ''));
      })
      .catch(err => setError(err.message));
  }, [filterDepartment, filterYear, activeRole]);

  const projects = report?.projects || [];
  const validatedProducts = report?.products || [];
  const overdue = report?.overdue || [];
  const sheetProject = projects.find(p => p.id === sheetProjectId);

  const hasResults =
    selectedReportKind === 'projects'
      ? projects.length > 0
      : selectedReportKind === 'products'
      ? validatedProducts.length > 0
      : selectedReportKind === 'overdue'
      ? overdue.length > 0
      : Boolean(sheetProject);

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!hasResults) {
      alert('La exportación está deshabilitada porque no existen registros que coincidan con los filtros.');
      return;
    }
    setIsExporting(true);
    try {
      const kind = selectedReportKind === 'sheet' ? 'projects' : selectedReportKind;
      await api.exportReport(kind, format, { department_id: filterDepartment, year: filterYear });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const projectColumns: Column<Project>[] = [
    { key: 'code', header: 'Código', render: p => <span className="font-mono font-bold text-secondary">{p.code}</span>, mobileLabel: 'Código' },
    {
      key: 'title',
      header: 'Proyecto',
      render: p => (
        <div>
          <span className="font-semibold text-primary">{p.title}</span>
          <span className="text-[11px] text-slate-500 block">
            {p.department_name} · {p.pi_full_name}
          </span>
        </div>
      ),
      mobileLabel: 'Proyecto',
    },
    { key: 'requested_funding', header: 'Monto (PEN)', render: p => <span className="font-mono tabular-nums text-slate-800">{formatCurrencyPEN(p.requested_funding)}</span>, mobileLabel: 'Monto' },
    { key: 'status', header: 'Estado', render: p => <Badge status={p.status} />, mobileLabel: 'Estado' },
    { key: 'progress', header: 'Avance', render: p => <span className="font-mono font-bold text-primary">{p.overall_progress || 0}%</span>, mobileLabel: 'Avance' },
  ];

  const statusEntries = Object.entries(report?.by_status || {}).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusEntries.map(([, n]) => n));
  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() + 1 - i));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-semibold text-secondary uppercase tracking-wider">Módulo Institucional de Reportes (UC-010, FR-037..041)</span>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">Dashboard y Generador de Reportes Oficiales</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasResults || isExporting}
            onClick={() => handleExport('csv')}
            icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
          >
            Exportar Excel (CSV)
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!hasResults} isLoading={isExporting} onClick={() => handleExport('pdf')} icon={<Download className="w-4 h-4" />}>
            Exportar PDF
          </Button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

      {/* Indicadores agregados */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="p-6">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Proyectos</span>
            <p className="text-2xl font-bold text-primary font-mono">{report.totals.projects}</p>
            <span className="text-[11px] text-slate-500">{report.totals.in_progress} en ejecución · avance medio {report.totals.average_progress}%</span>
          </Card>
          <Card padding="p-6">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Financiamiento adjudicado</span>
            <p className="text-lg font-bold text-primary font-mono">{formatCurrencyPEN(report.totals.approved_funding)}</p>
            <span className="text-[11px] text-slate-500">Solicitado total: {formatCurrencyPEN(report.totals.requested_funding)}</span>
          </Card>
          <Card padding="p-6">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Productos validados</span>
            <p className="text-2xl font-bold text-primary font-mono">{report.totals.validated_products}</p>
            <span className="text-[11px] text-slate-500">Solo validados por Coordinación (BR-013)</span>
          </Card>
          <Card padding="p-6">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entregables vencidos</span>
            <p className={`text-2xl font-bold font-mono ${report.totals.overdue_deliverables ? 'text-danger-action' : 'text-emerald-700'}`}>{report.totals.overdue_deliverables}</p>
            <span className="text-[11px] text-slate-500">En proyectos en ejecución (FR-039)</span>
          </Card>
        </div>
      )}

      {statusEntries.length > 0 && (
        <Card padding="p-6" className="space-y-2">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Distribución por estado</h2>
          {statusEntries.map(([status, n]) => (
            <div key={status} className="flex items-center gap-3 text-xs">
              <span className="w-36 shrink-0 text-slate-600">{STATUS_LABELS[status] || status}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-secondary h-2.5 rounded-full" style={{ width: `${(n / maxStatus) * 100}%` }} />
              </div>
              <span className="w-6 text-right font-mono font-bold text-primary">{n}</span>
            </div>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'projects', label: '1. Proyectos por Estado (FR-037)' },
          { key: 'products', label: '2. Productos Validados (FR-038)' },
          { key: 'overdue', label: '3. Avance y Vencidos (FR-039)' },
          { key: 'sheet', label: '4. Ficha Técnica (FR-041)' },
        ].map(r => (
          <button
            type="button"
            key={r.key}
            onClick={() => setSelectedReportKind(r.key as any)}
            className={`p-3.5 rounded-xl border text-xs font-bold text-left transition-all ${
              selectedReportKind === r.key ? 'bg-secondary text-white border-secondary shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Card padding="p-4" className="flex flex-col sm:flex-row items-center gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-semibold shrink-0">
          <Filter className="w-4 h-4" />
          <span>Filtros Institucionales:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 w-full">
          <select
            value={filterDepartment}
            onChange={e => setFilterDepartment(e.target.value)}
            aria-label="Departamento"
            disabled={activeRole === 'department_coordinator'}
            className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
          >
            <option value="all">{activeRole === 'department_coordinator' ? 'Mi Facultad / Departamento' : 'Todas las Facultades / Departamentos'}</option>
            {(catalogs?.departments || [])
              .filter(d => d.id.startsWith('dept-') && !['dept-investigacion', 'dept-etica', 'dept-rectorado', 'dept-ti'].includes(d.id))
              .map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} aria-label="Periodo" className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs">
            <option value="all">Todos los periodos</option>
            {years.map(y => (
              <option key={y} value={y}>
                Periodo {y} (proyectos vigentes)
              </option>
            ))}
          </select>
        </div>
      </Card>

      {selectedReportKind === 'projects' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-primary">Reporte 1: Proyectos de Investigación por Estado (FR-037)</h2>
          <DataTable columns={projectColumns} data={projects} keyExtractor={p => p.id} emptyMessage="No existen registros que coincidan con los filtros." />
        </div>
      )}

      {selectedReportKind === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-bold text-primary">Reporte 2: Productos Científicos Validados por Coordinación (FR-038)</h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">Regla BR-013: Exclusivamente productos validados</span>
          </div>
          {validatedProducts.length === 0 && <Card padding="p-6" className="text-center text-xs text-slate-500">Sin productos validados para los filtros seleccionados.</Card>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {validatedProducts.map(prod => (
              <Card key={prod.id} padding="p-6" className="space-y-2">
                <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">{prod.type.replace('_', ' ')}</span>
                <h3 className="text-xs font-bold text-primary">{prod.title}</h3>
                <p className="text-[11px] text-slate-500">
                  {prod.authors} · {prod.venue}
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Validado por {prod.validator_name}
                  </span>
                  <span className="font-mono text-slate-400">{formatDate(prod.validated_at)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedReportKind === 'overdue' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-primary">Reporte 3: Avance y Monitoreo de Entregables Vencidos (FR-039)</h2>
          {overdue.length === 0 ? (
            <Card padding="p-6" className="space-y-2">
              <span className="text-xs font-mono text-emerald-600 font-bold">Sin entregables vencidos</span>
              <p className="text-xs text-slate-500">El sistema emite alertas automáticas a 7 y 1 día del vencimiento (parámetros configurables NFR-019).</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {overdue.map(o => (
                <Card key={`${o.project_id}-${o.code}`} padding="p-4" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger-action shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-primary">
                        {o.code} · {o.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {o.project_code} · {o.activity} · Responsable: {o.responsible}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-danger-action font-bold">Venció {formatDate(o.due_date)}</span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedReportKind === 'sheet' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-bold text-primary">Reporte 4: Ficha Técnica Consolidada de Proyecto (FR-041)</h2>
            <select value={sheetProjectId} onChange={e => setSheetProjectId(e.target.value)} aria-label="Proyecto" className="px-3 py-2 border border-slate-200 rounded-lg text-xs max-w-sm">
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </div>
          {sheetProject ? (
            <Card padding="p-8" className="space-y-4 border-2 border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-3">
                <div>
                  <span className="text-xs font-mono font-bold text-secondary">FICHA TÉCNICA INSTITUCIONAL</span>
                  <h3 className="text-lg font-bold text-primary mt-0.5">{sheetProject.code}</h3>
                  <p className="text-xs text-slate-600">{sheetProject.title}</p>
                </div>
                <Badge status={sheetProject.status} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Investigador Principal:</span>
                  <p className="font-semibold text-primary">{sheetProject.pi_full_name}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Presupuesto Solicitado:</span>
                  <p className="font-mono font-bold text-primary tabular-nums">{formatCurrencyPEN(sheetProject.requested_funding)}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Unidad / Área / Línea:</span>
                  <p className="text-primary">
                    {sheetProject.department_name} · {sheetProject.area_name} · {sheetProject.line_name}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Vigencia y avance:</span>
                  <p className="text-primary">
                    {formatDate(sheetProject.start_date)} – {formatDate(sheetProject.end_date)} · {sheetProject.overall_progress || 0}%
                  </p>
                </div>
                {sheetProject.resolution_number && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Resolución / CVD:</span>
                    <p className="text-primary font-mono">
                      {sheetProject.resolution_number} · {sheetProject.cvd_code}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[11px]">Productos validados:</span>
                  <p className="text-primary font-mono">{validatedProducts.filter(pr => pr.project_id === sheetProject.id).length}</p>
                </div>
              </div>
              {sheetProject.current_version?.summary && <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">{sheetProject.current_version.summary}</p>}
            </Card>
          ) : (
            <Card padding="p-6" className="text-center text-xs text-slate-500">Seleccione un proyecto.</Card>
          )}
        </div>
      )}
    </div>
  );
};
