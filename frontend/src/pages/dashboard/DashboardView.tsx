import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { api } from '../../api/client';
import { Project, Activity, Deliverable, ResearchProduct } from '../../types/domain';
import { formatCurrencyPEN, formatDate } from '../../utils/formatters';
import {
  FolderKanban,
  Coins,
  Clock,
  Award,
  PlusCircle,
  FileSearch,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileCheck
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<(Activity & { projectCode: string })[]>([]);
  const [products, setProducts] = useState<ResearchProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return;
      try {
        setLoading(true);
        setLoadError(null);
        const projs = await api.getProjects();
        setProjects(projs);

        // Entregables de todos los proyectos en ejecución visibles para el rol
        const running = projs.filter(p => p.status === 'In progress' && !(activeRole === 'university_authority' && p.confidential));
        const acts = await Promise.all(
          running.map(p => api.getActivities(p.id).then(list => list.map(a => ({ ...a, projectCode: p.code }))).catch(() => []))
        );
        setActivities(acts.flat());
        setProducts(await api.getProducts().catch(() => []));
      } catch (err: any) {
        console.error('Error cargando dashboard:', err);
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [user, activeRole]);

  // Recopilar todos los entregables (ordenados por vencimiento)
  const deliverables = activities
    .flatMap(a => (a.deliverables || []).map(d => ({ ...d, activityName: `${a.projectCode} · ${a.name}`, projectId: a.project_id })))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  // Indicadores calculados con los datos reales del servidor
  const inProgress = projects.filter(p => p.status === 'In progress');
  const totalBudget = projects.reduce((acc, p) => acc + (p.requested_funding || 0), 0);
  const fundedBudget = projects
    .filter(p => ['Approved', 'In progress', 'Closure requested', 'Closed'].includes(p.status))
    .reduce((acc, p) => acc + (p.requested_funding || 0), 0);
  const avgProgress = inProgress.length
    ? Number((inProgress.reduce((acc, p) => acc + (p.overall_progress || 0), 0) / inProgress.length).toFixed(1))
    : 0;
  const validated = products.filter(p => p.validated_at !== null);
  const productTypeLabels: Record<string, string> = {
    journal_article: 'Artículo', conference_paper: 'Ponencia', book: 'Libro', book_chapter: 'Capítulo',
    thesis: 'Tesis', patent: 'Patente', software: 'Software', other: 'Otro',
  };
  const productBreakdown = Object.entries(
    validated.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.type]: (acc[p.type] || 0) + 1 }), {})
  )
    .map(([t, n]) => `${n} ${productTypeLabels[t] || t}`)
    .join(' + ');
  const pendingValidation = products.length - validated.length;

  // Columnas para tabla de entregables con transformación responsiva a móvil
  const deliverableColumns: Column<Deliverable & { activityName: string }>[] = [
    {
      key: 'code',
      header: 'Código',
      render: d => (
        <span className="font-mono font-semibold text-secondary tabular-nums">
          {d.code || 'HITO'}
        </span>
      ),
      mobileLabel: 'Código',
    },
    {
      key: 'name',
      header: 'Entregable / Actividad',
      render: d => (
        <div>
          <p className="font-semibold text-primary">{d.name}</p>
          <p className="text-[11px] text-slate-500">{d.activityName}</p>
        </div>
      ),
      mobileLabel: 'Entregable',
    },
    {
      key: 'due_date',
      header: 'Vencimiento',
      render: d => (
        <span className="font-mono text-xs tabular-nums text-slate-700">
          {formatDate(d.due_date)}
        </span>
      ),
      mobileLabel: 'Vence',
    },
    {
      key: 'status',
      header: 'Estado',
      render: d => <Badge status={d.status} />,
      mobileLabel: 'Estado',
    },
    {
      key: 'actions',
      header: 'Acción',
      render: d => (
        <a
          href={`#/proyectos/${(d as any).projectId}`}
          className="text-xs text-secondary font-semibold hover:underline inline-flex items-center gap-1"
        >
          Ver en Plan <ArrowRight className="w-3 h-3" />
        </a>
      ),
      mobileLabel: 'Acción',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Encabezado del Tablero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
            Tablero Institucional
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Bienvenido, {user?.full_name}. Monitoreo del estado físico y financiero de investigación.
          </p>
        </div>

        {/* Único botón CTA primario según rol (BASE.md 3.2) */}
        {activeRole === 'researcher' ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => (window.location.hash = '#/proyectos/nuevo')}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Nueva Propuesta
          </Button>
        ) : activeRole === 'research_coordinator' || activeRole === 'committee_member' ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => (window.location.hash = '#/revision')}
            icon={<FileSearch className="w-4 h-4" />}
          >
            Bandeja de Revisión
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={() => (window.location.hash = '#/reportes')}
            icon={<TrendingUp className="w-4 h-4" />}
          >
            Generar Reportes
          </Button>
        )}
      </div>

      {loadError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          No se pudieron cargar los datos del tablero: {loadError}
        </div>
      )}

      {/* FILA SUPERIOR: Máximo 4 Tarjetas KPI (Regla de Límite de Densidad BASE.md 3.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card padding="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Proyectos Asignados
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-secondary flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tabular-nums">
              {projects.length}
            </span>
            <span className="text-xs text-emerald-600 font-medium block mt-1">
              {loading ? 'Cargando…' : `${inProgress.length} en ejecución activa`}
            </span>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Presupuesto Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-bold text-primary font-mono tabular-nums">
              {formatCurrencyPEN(totalBudget)}
            </span>
            <span className="text-xs text-slate-500 font-medium block mt-1">
              Adjudicado / en ejecución: {formatCurrencyPEN(fundedBudget)}
            </span>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avance Ponderado
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tabular-nums">
              {avgProgress}%
            </span>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-secondary h-1.5 rounded-full" style={{ width: `${avgProgress}%` }} />
            </div>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Productos Validados
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tabular-nums">
              {validated.length}
            </span>
            <span className="text-xs text-slate-500 font-medium block mt-1">
              {productBreakdown || 'Sin productos validados'}
              {pendingValidation > 0 ? ` · ${pendingValidation} por validar` : ''}
            </span>
          </div>
        </Card>
      </div>

      {/* Proyectos Activos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary tracking-tight">
            Expedientes de Investigación Activos
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Mostrando {projects.length} registros
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map(proj => (
            <Card key={proj.id} padding="p-6" className="flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="font-mono text-xs font-bold text-secondary tabular-nums">
                      {proj.code}
                    </span>
                    <h3 className="text-base font-bold text-primary leading-snug">
                      {proj.title}
                    </h3>
                  </div>
                  <Badge status={proj.status} />
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {proj.current_version?.summary || 'Expediente registrado en el sistema institucional.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Investigador:</span>
                    <span className="font-semibold text-primary truncate block">
                      {proj.pi_full_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Presupuesto:</span>
                    <span className="font-mono font-semibold text-primary tabular-nums block">
                      {formatCurrencyPEN(proj.requested_funding)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Vigencia:</span>
                    <span className="font-mono text-slate-700 tabular-nums block">
                      Hasta {formatDate(proj.end_date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Avance:</span>
                  <span className="font-mono text-xs font-bold text-secondary tabular-nums">
                    {proj.overall_progress || 0}%
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.hash = `#/proyectos/${proj.id}`)}
                >
                  Abrir Expediente Maestro
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Lista de Entregables y Próximos Vencimientos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-secondary" />
            <h2 className="text-lg font-bold text-primary tracking-tight">
              Entregables Próximos y Estado de Cumplimiento (FR-024)
            </h2>
          </div>
          <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Alerta a 7 días activa
          </span>
        </div>

        <DataTable
          columns={deliverableColumns}
          data={deliverables}
          keyExtractor={d => d.id}
          emptyMessage="No hay entregables registrados en este momento."
        />
      </div>
    </div>
  );
};
