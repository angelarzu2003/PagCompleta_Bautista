import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TechDetails } from '../../components/ui/TechDetails';
import { DataTable, Column } from '../../components/ui/DataTable';
import { api } from '../../api/client';
import { safeExternalUrl } from '../../utils/security';
import { getProjectIdFromHash, rememberProject } from '../../utils/routing';
import {
  Project,
  Activity,
  Deliverable,
  ResearchProduct,
  ResearchProductType,
  ObservationSubsanationItem,
  ProjectClosureChecklist,
  ProjectDocument,
  ReviewAssignment,
  ProjectStatus,
} from '../../types/domain';
import { formatCurrencyPEN, formatCurrencyUSD, formatDate, formatDateTime } from '../../utils/formatters';
import {
  FolderKanban,
  Users,
  ClipboardCheck,
  Calendar,
  Files,
  Award,
  History,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Lock,
  Plus,
  XCircle,
  Send,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  Draft: 'Borrador',
  Submitted: 'Enviado',
  'Under review': 'En evaluación',
  Approved: 'Aprobado',
  Rejected: 'Rechazado',
  'Changes requested': 'Requiere subsanación',
  'In progress': 'En ejecución',
  Suspended: 'Suspendido',
  'Closure requested': 'Cierre solicitado',
  Closed: 'Cerrado',
  Cancelled: 'Cancelado',
};

/** Transiciones que puede ejecutar la Coordinación desde cada estado (espejo de la máquina del servidor). */
const COORD_TRANSITIONS: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  Submitted: ['Under review', 'Rejected'],
  'Under review': ['Approved', 'Changes requested', 'Rejected'],
  Approved: ['In progress'],
  'In progress': ['Suspended'],
  Suspended: ['In progress', 'Cancelled'],
  'Closure requested': ['Closed', 'In progress'],
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  approve: 'Aprobar',
  reject: 'Rechazar',
  request_changes: 'Solicitar cambios',
};

const MEMBER_ROLE_LABELS: Record<string, string> = {
  co_investigator: 'Coinvestigador(a)',
  student_researcher: 'Estudiante Investigador',
  collaborator: 'Colaborador(a)',
};

export const ProjectDetailView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(getProjectIdFromHash());
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resumen' | 'equipo' | 'evaluaciones' | 'plan' | 'archivos' | 'productos' | 'historial'>('plan');

  // Actividades y entregables
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activityProgressInput, setActivityProgressInput] = useState<number>(0);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Modal de Evidencia para Entregable (FR-022)
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceExistingId, setEvidenceExistingId] = useState('');
  const [isSubmittingDeliverable, setIsSubmittingDeliverable] = useState(false);

  const [observations, setObservations] = useState<ObservationSubsanationItem[]>([]);
  const [evaluations, setEvaluations] = useState<ReviewAssignment[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);

  // Productos de Investigación (FR-030..032)
  const [products, setProducts] = useState<ResearchProduct[]>([]);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductType, setNewProductType] = useState<ResearchProductType>('journal_article');
  const [newProductTitle, setNewProductTitle] = useState('');
  const [newProductAuthors, setNewProductAuthors] = useState('');
  const [newProductVenue, setNewProductVenue] = useState('');
  const [newProductDoi, setNewProductDoi] = useState('');

  // Checklist de Cierre (BR-006, FR-044)
  const [closureChecklist, setClosureChecklist] = useState<ProjectClosureChecklist | null>(null);

  // Decisiones de estado
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<ProjectStatus | ''>('');
  const [decisionJustification, setDecisionJustification] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);

  const selectedActivity = activities.find(a => a.id === selectedActivityId) || null;
  const isPI = Boolean(project && user && project.pi_user_id === user.id);
  const isTeam = isPI || Boolean(project?.members?.some(m => m.user_id === user?.id && !m.left_at));
  const canEditProgress = isTeam && project?.status === 'In progress';

  // Resolver el proyecto a mostrar: el del hash o, si no hay, el primero visible para el rol
  useEffect(() => {
    const onHash = () => setProjectId(getProjectIdFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (projectId) return;
    api
      .getProjects()
      .then(list => {
        if (list.length) window.location.hash = `#/proyectos/${list[0].id}`;
        else setLoadError('No tiene expedientes de proyecto asignados.');
      })
      .catch(err => setLoadError(err.message));
  }, [projectId]);

  const loadAll = useCallback(async (id: string) => {
    try {
      setLoadError(null);
      const p = await api.getProjectById(id);
      setProject(p);
      rememberProject(p.id);
      const [acts, prods, obs, evals, docs, checklist] = await Promise.all([
        api.getActivities(id).catch(() => []),
        api.getProducts(id).catch(() => []),
        api.getObservations(id).catch(() => []),
        api.getProjectEvaluations(id).catch(() => []),
        api.getDocuments(id).catch(() => []),
        api.getClosureChecklist(id).catch(() => null),
      ]);
      setActivities(acts);
      setProducts(prods);
      setObservations(obs);
      setEvaluations(evals);
      setDocuments(docs);
      setClosureChecklist(checklist);
      setSelectedActivityId(prev => {
        const keep = acts.find(a => a.id === prev);
        const pick = keep || acts.find(a => a.progress < 100) || acts[0];
        if (pick) setActivityProgressInput(pick.progress);
        return pick?.id ?? null;
      });
      if (!acts.length) setActiveTab(t => (t === 'plan' ? 'resumen' : t));
    } catch (err: any) {
      setProject(null);
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    if (projectId) loadAll(projectId);
  }, [projectId, loadAll, activeRole]);

  if (loadError) {
    return (
      <Card padding="p-8" className="text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-bold text-primary">Expediente no disponible</h1>
        <p className="text-xs text-slate-500">{loadError}</p>
        <Button type="button" variant="outline" onClick={() => (window.location.hash = '#/inicio')}>
          Volver al Tablero
        </Button>
      </Card>
    );
  }

  if (!project) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando expediente…</div>;
  }

  const docsHref = `#/proyectos/${project.id}/documentos`;

  // Guardar avance de la actividad seleccionada (FR-021) y recalcular el ponderado (FR-023)
  const handleSaveProgress = async () => {
    if (!selectedActivity) return;
    setIsSavingProgress(true);
    try {
      const updated = await api.updateActivityProgress(selectedActivity.id, activityProgressInput);
      setActivities(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      setProject(await api.getProjectById(project.id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingProgress(false);
    }
  };

  // Enviar Entregable con Evidencia (FR-022)
  const handleSubmitDeliverableWithEvidence = async () => {
    if (!selectedDeliverable) return;
    setIsSubmittingDeliverable(true);
    try {
      let evidenceId = evidenceExistingId;
      if (evidenceFile) {
        const doc = await api.uploadDocument(project.id, evidenceFile, 'evidence', `Evidencia del entregable ${selectedDeliverable.code}`);
        evidenceId = doc.id;
      }
      if (!evidenceId) {
        alert('Debe adjuntar al menos un archivo de evidencia probatoria (FR-022).');
        return;
      }
      const updatedDeliv = await api.submitDeliverable(selectedDeliverable.id, [evidenceId]);
      setActivities(prev =>
        prev.map(act => ({
          ...act,
          deliverables: act.deliverables?.map(d => (d.id === updatedDeliv.id ? updatedDeliv : d)),
        }))
      );
      setDocuments(await api.getDocuments(project.id));
      setClosureChecklist(await api.getClosureChecklist(project.id));
      setIsEvidenceModalOpen(false);
      setEvidenceFile(null);
      setEvidenceExistingId('');
      alert(`Entregable ${updatedDeliv.code || ''} enviado a revisión con evidencia probatoria adjunta.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingDeliverable(false);
    }
  };

  // Validar Producto (Coordinación BR-013)
  const handleValidateProduct = async (prodId: string) => {
    try {
      const validated = await api.validateProduct(prodId);
      setProducts(prev => prev.map(p => (p.id === validated.id ? validated : p)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Registrar Nuevo Producto
  const handleCreateProduct = async () => {
    if (!newProductTitle.trim()) {
      alert('El título del producto es obligatorio.');
      return;
    }
    try {
      const created = await api.createProduct({
        project_id: project.id,
        type: newProductType,
        title: newProductTitle,
        authors: newProductAuthors || user?.full_name || '',
        venue: newProductVenue,
        doi_or_url: newProductDoi || null,
        status: 'submitted',
      });
      setProducts(prev => [created, ...prev]);
      setClosureChecklist(await api.getClosureChecklist(project.id));
      setIsNewProductModalOpen(false);
      setNewProductTitle('');
      setNewProductAuthors('');
      setNewProductVenue('');
      setNewProductDoi('');
    } catch (err: any) {
      alert(err.fields?.[0]?.message || err.message);
    }
  };

  const openDecision = (target?: ProjectStatus) => {
    setDecisionTarget(target || COORD_TRANSITIONS[project.status]?.[0] || '');
    setDecisionJustification('');
    setIsDecisionModalOpen(true);
  };

  const handleTransition = async (to: ProjectStatus, justification: string) => {
    setIsDeciding(true);
    try {
      const updated =
        isPI && (to === 'Submitted' || (project.status === 'Changes requested' && to === 'Under review'))
          ? await api.submitProject(project.id, project.row_version)
          : await api.transitionProject(project.id, to, justification, project.row_version);
      setProject(updated);
      setIsDecisionModalOpen(false);
      setClosureChecklist(await api.getClosureChecklist(project.id));
      alert(`Estado actualizado: ${STATUS_LABELS[updated.status] || updated.status}.`);
    } catch (err: any) {
      alert(err.fields?.[0]?.message || err.message);
      if (err.statusCode === 409) loadAll(project.id);
    } finally {
      setIsDeciding(false);
    }
  };

  // Columnas para Actividades en Plan de Trabajo
  const activityColumns: Column<Activity>[] = [
    {
      key: 'name',
      header: 'Actividad del Plan de Trabajo',
      render: a => (
        <div>
          <span className="font-bold text-primary block">{a.name}</span>
          <span className="text-[11px] text-slate-500 line-clamp-1">{a.description}</span>
        </div>
      ),
      mobileLabel: 'Actividad',
    },
    {
      key: 'weight',
      header: 'Ponderación (OI-007)',
      render: a => (
        <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">
          {(a.weight * 100).toFixed(1)}%
        </span>
      ),
      mobileLabel: 'Peso',
    },
    {
      key: 'progress',
      header: 'Avance Individual',
      render: a => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-secondary h-1.5 rounded-full" style={{ width: `${a.progress}%` }} />
          </div>
          <span className="font-mono text-xs font-bold tabular-nums text-primary">{a.progress}%</span>
        </div>
      ),
      mobileLabel: 'Avance',
    },
    {
      key: 'due_date',
      header: 'Vencimiento',
      render: a => (
        <span className={`font-mono text-xs tabular-nums ${a.is_overdue ? 'text-danger-action font-bold' : 'text-slate-700'}`}>
          {formatDate(a.due_date)}
          {a.is_overdue && ' (vencida)'}
        </span>
      ),
      mobileLabel: 'Vence',
    },
    {
      key: 'actions',
      header: 'Seguimiento',
      render: a => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedActivityId(a.id);
            setActivityProgressInput(a.progress);
          }}
        >
          {selectedActivityId === a.id ? 'Seleccionado' : 'Gestionar'}
        </Button>
      ),
      mobileLabel: 'Gestión',
    },
  ];

  const phases = project.budget_breakdown || [];
  const executing = ['In progress', 'Closure requested', 'Closed'].includes(project.status);
  const phaseStatus = (n: number) => {
    if (!executing) return { label: 'Sin desembolso (no adjudicado)', cls: 'text-slate-400' };
    if (n === 1) return { label: 'Desembolsado (anticipo)', cls: 'text-emerald-600' };
    if (n === 2)
      return (project.overall_progress || 0) >= 50
        ? { label: 'Desembolsado (informe intermedio)', cls: 'text-emerald-600' }
        : { label: `En ejecución (${project.overall_progress}%)`, cls: 'text-secondary' };
    return project.status === 'Closed'
      ? { label: 'Desembolsado (cierre)', cls: 'text-emerald-600' }
      : { label: 'Pendiente de cierre', cls: 'text-slate-400' };
  };
  const resolvedObs = observations.filter(o => o.resolved).length;
  const evaluated = evaluations.filter(e => e.evaluation);
  const proposalHash = documents.find(d => d.type === 'proposal')?.versions.slice(-1)[0]?.sha256;
  const coordOptions = COORD_TRANSITIONS[project.status] || [];

  return (
    <div className="space-y-8">
      {/* Encabezado del Expediente Maestro */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="font-bold text-secondary tabular-nums">{project.code}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Expediente Anónimo: {project.anonymous_code}</span>
            {project.confidential && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[10px]">
                <Lock className="w-3 h-3" /> Confidencial (AIR-011)
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">{project.title}</h1>
          <p className="text-xs text-slate-500">
            {project.department_name} · {project.type_name} · {formatDate(project.start_date)} – {formatDate(project.end_date)}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Badge status={project.status} />
          {/* Único botón primario condicional según rol y estado */}
          {activeRole === 'research_coordinator' && coordOptions.length > 0 ? (
            <Button type="button" variant="primary" onClick={() => openDecision()}>
              Dictamen de Coordinación
            </Button>
          ) : isPI && (project.status === 'Draft' || project.status === 'Changes requested') ? (
            <Button
              type="button"
              variant="primary"
              isLoading={isDeciding}
              icon={<Send className="w-4 h-4" />}
              onClick={() =>
                project.status === 'Changes requested'
                  ? (window.location.hash = `#/subsanacion?proyecto=${project.id}`)
                  : handleTransition('Submitted', 'Envío formal de la propuesta.')
              }
            >
              {project.status === 'Changes requested' ? 'Subsanar Observaciones' : 'Enviar Propuesta'}
            </Button>
          ) : isPI && project.status === 'In progress' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!closureChecklist?.can_approve_closure) {
                  alert('Aún no cumple el checklist de cierre (BR-006). Revise la pestaña "Historial y Cierre".');
                  return;
                }
                handleTransition('Closure requested', 'Solicitud formal de cierre con informe final cargado.');
              }}
            >
              Solicitar Cierre
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => (window.location.hash = docsHref)} icon={<Files className="w-4 h-4" />}>
              Ver Archivos
            </Button>
          )}
        </div>
      </div>

      {/* Navegación por las 7 Pestañas Oficiales de BASE.md (Sección 5.1 Pantalla 4) */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
        {[
          { key: 'resumen', label: '1. Resumen y Subsanación', icon: FolderKanban },
          { key: 'equipo', label: '2. Equipo', icon: Users },
          { key: 'evaluaciones', label: '3. Evaluaciones', icon: ClipboardCheck },
          { key: 'plan', label: '4. Plan de Trabajo', icon: Calendar },
          { key: 'archivos', label: '5. Archivos', icon: Files },
          { key: 'productos', label: '6. Productos Científicos', icon: Award },
          { key: 'historial', label: '7. Historial y Cierre', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 whitespace-nowrap transition-colors ${
                isActive ? 'border-secondary text-secondary font-bold bg-white' : 'border-transparent text-slate-500 hover:text-primary hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* PESTAÑA 4: Plan de Trabajo y Seguimiento Físico-Financiero (V04) */}
      {activeTab === 'plan' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card padding="p-6">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Presupuesto Solicitado</span>
              <span className="text-xl font-bold text-primary font-mono tabular-nums block mt-1">{formatCurrencyPEN(project.requested_funding)}</span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">{formatCurrencyUSD(project.requested_funding / 3.75)} USD (T.C. 3.75)</span>
            </Card>
            {phases.map(ph => {
              const st = phaseStatus(ph.phase_number);
              return (
                <Card key={ph.phase_number} padding="p-6">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block line-clamp-2">
                    {ph.name} ({ph.percentage}%)
                  </span>
                  <span className="text-lg font-bold text-primary font-mono tabular-nums block mt-1">{formatCurrencyPEN(ph.amount_pen)}</span>
                  <span className={`text-[11px] font-medium block ${st.cls}`}>{st.label}</span>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-primary tracking-tight">Actividades y Ponderación Validada (Regla OI-007)</h2>
                <p className="text-xs text-slate-500">El avance global del proyecto se calcula como promedio ponderado automático (FR-023).</p>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <span className="text-xs font-semibold text-primary">Avance Ponderado:</span>
                <span className="font-mono text-sm font-bold text-secondary tabular-nums">{project.overall_progress}%</span>
              </div>
            </div>

            <DataTable
              columns={activityColumns}
              data={activities}
              keyExtractor={a => a.id}
              emptyMessage="El plan de trabajo se registra cuando el proyecto entra en ejecución."
            />
          </div>

          {selectedActivity && (
            <Card padding="p-8" className="border-2 border-secondary/20 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-mono text-secondary uppercase font-semibold">Panel de Registro de Avance Físico (FR-021, UC-006)</span>
                  <h3 className="text-base font-bold text-primary mt-0.5">{selectedActivity.name}</h3>
                  <p className="text-xs text-slate-500">Responsable: {selectedActivity.responsible_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Peso en el Proyecto:</span>
                  <span className="font-mono text-xs font-bold text-primary">{(selectedActivity.weight * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="space-y-3 bg-surface-sunken p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label htmlFor="activity-progress" className="text-xs font-semibold text-primary">
                    Registrar Porcentaje de Ejecución (0% a 100%):
                  </label>
                  <span className="font-mono text-base font-bold text-secondary tabular-nums">{activityProgressInput}%</span>
                </div>
                <input
                  id="activity-progress"
                  type="range"
                  min="0"
                  max="100"
                  value={activityProgressInput}
                  disabled={!canEditProgress}
                  onChange={e => setActivityProgressInput(Number(e.target.value))}
                  className="w-full accent-secondary cursor-pointer h-2 bg-slate-200 rounded-lg disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">
                    {canEditProgress ? 'El cambio se registra en la bitácora y recalcula el avance ponderado.' : 'Solo el equipo del proyecto puede registrar avances mientras está en ejecución.'}
                  </span>
                  {canEditProgress && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isLoading={isSavingProgress}
                      disabled={activityProgressInput === selectedActivity.progress}
                      onClick={handleSaveProgress}
                    >
                      Guardar Avance
                    </Button>
                  )}
                </div>
              </div>

              {selectedActivity.deliverables && selectedActivity.deliverables.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Entregable Asociado:</h4>
                  {selectedActivity.deliverables.map(deliv => (
                    <div
                      key={deliv.id}
                      className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-secondary">{deliv.code}:</span>
                          <span className="text-xs font-bold text-primary">{deliv.name}</span>
                          <Badge status={deliv.status} size="sm" />
                        </div>
                        {deliv.description && <p className="text-[11px] text-slate-500">{deliv.description}</p>}
                        <p className="text-[11px] text-slate-400 font-mono">Vence: {formatDate(deliv.due_date)}</p>
                      </div>

                      {(deliv.status === 'Pending' || deliv.status === 'Overdue') && isTeam ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedDeliverable(deliv);
                            setEvidenceFile(null);
                            setEvidenceExistingId('');
                            setIsEvidenceModalOpen(true);
                          }}
                          icon={<Upload className="w-3.5 h-3.5" />}
                        >
                          Cargar Evidencia y Enviar
                        </Button>
                      ) : deliv.status === 'Submitted' || deliv.status === 'Approved' ? (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Entregable Registrado ({deliv.evidence_document_ids.length} evidencia/s)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pendiente del equipo</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* PESTAÑA 1: Resumen y Subsanación Redline Diff (RF-08, V07) */}
      {activeTab === 'resumen' && (
        <div className="space-y-8">
          <Card padding="p-6" className="space-y-4">
            <h2 className="text-base font-bold text-primary">Resumen Ejecutivo del Proyecto</h2>
            <p className="text-xs text-slate-600 leading-relaxed">{project.current_version?.summary || 'Sin resumen registrado.'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Objetivo General:</span>
                <p className="font-medium text-primary mt-0.5">{project.current_version?.general_objective || '—'}</p>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Fuente de Financiamiento:</span>
                <p className="font-medium text-primary mt-0.5">{project.current_version?.funding_source || '—'}</p>
              </div>
            </div>
            {project.current_version?.specific_objectives && project.current_version.specific_objectives.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <span className="text-slate-400 block text-[11px]">Objetivos Específicos:</span>
                {project.current_version.specific_objectives.map(o => (
                  <p key={o.id} className="text-xs text-primary">
                    <strong className="font-mono text-secondary">{o.id}.</strong> {o.description}
                  </p>
                ))}
              </div>
            )}
            {project.current_version?.methodology && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px]">Metodología:</span>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{project.current_version.methodology}</p>
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-primary">Subsanación de Observaciones del Comité (Redline Diff)</h3>
                <p className="text-xs text-slate-500">Comparativa de texto original observado vs texto corregido presentado por el PI.</p>
              </div>
              <span
                className={`text-xs font-mono px-2.5 py-1 rounded-full border font-semibold ${
                  observations.length && resolvedObs === observations.length ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {resolvedObs}/{observations.length} Subsanadas
              </span>
            </div>

            {observations.length === 0 ? (
              <Card padding="p-6" className="text-center text-xs text-slate-500">
                El expediente no registra observaciones del Comité.
              </Card>
            ) : (
              <div className="space-y-4">
                {observations.map(obs => (
                  <Card key={obs.id} padding="p-6" className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-primary">{obs.section_name}</span>
                      {obs.resolved ? (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Subsanado
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Pendiente
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl bg-red-50/60 border border-red-200 space-y-1">
                        <span className="text-[10px] font-mono text-red-800 uppercase font-bold">Versión Observada</span>
                        <p className="text-xs text-red-950 line-through leading-relaxed">{obs.original_text_v1}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-mono text-emerald-800 uppercase font-bold">Versión Corregida</span>
                        <p className="text-xs text-emerald-950 leading-relaxed font-medium">{obs.corrected_text_v2 || '— Aún sin corrección —'}</p>
                      </div>
                    </div>
                    {obs.researcher_justification && (
                      <div className="text-[11px] text-slate-500 bg-surface-sunken p-2.5 rounded-lg border border-slate-200">
                        <strong>Justificación del Investigador:</strong> {obs.researcher_justification}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: Equipo de Investigación (FR-011) */}
      {activeTab === 'equipo' && (
        <Card padding="p-6" className="space-y-6">
          <h2 className="text-base font-bold text-primary">Miembros del Proyecto de Investigación</h2>
          <div className="divide-y divide-slate-100">
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-primary">{project.pi_full_name}</p>
                <p className="text-[11px] text-slate-500">Investigador Principal (Titular único)</p>
              </div>
              <Badge variant="success" size="sm">PI Activo</Badge>
            </div>
            {(project.members || []).map(m => (
              <div key={m.id} className={`py-3 flex items-center justify-between ${m.left_at ? 'text-slate-400' : ''}`}>
                <div>
                  <p className={`text-xs ${m.left_at ? 'font-medium' : 'font-bold text-primary'}`}>{m.full_name}</p>
                  <p className="text-[11px] text-slate-500">
                    {MEMBER_ROLE_LABELS[m.project_role] || m.project_role} • Desde {formatDate(m.joined_at)}
                    {m.left_at && ` • Retirado el ${formatDate(m.left_at)}`}
                  </p>
                </div>
                {m.left_at ? <span className="text-[11px] font-mono">left_at registrado</span> : <Badge variant="info" size="sm">Miembro Activo</Badge>}
              </div>
            ))}
            {(project.members || []).length === 0 && <p className="py-3 text-xs text-slate-400">El proyecto no registra miembros adicionales.</p>}
          </div>
        </Card>
      )}

      {/* PESTAÑA 3: Evaluaciones y Dictamen (FR-016..019) */}
      {activeTab === 'evaluaciones' && (
        <div className="space-y-6">
          {evaluations.length === 0 && (
            <Card padding="p-6" className="text-center text-xs text-slate-500">No se registran asignaciones de evaluación para este expediente.</Card>
          )}
          {evaluations.map(a => (
            <Card key={a.id} padding="p-6" className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
                <div>
                  <span className="text-xs font-mono font-bold text-secondary">{a.reviewer_alias}</span>
                  <p className="text-sm font-bold text-primary mt-0.5">Dictamen de Evaluación por Pares Ciegos</p>
                  <p className="text-[11px] text-slate-400">Fecha límite: {formatDateTime(a.due_at)}</p>
                </div>
                {a.evaluation ? (
                  <div className="text-right">
                    <span className={`text-xl font-bold font-mono tabular-nums ${(a.evaluation.total_score || 0) >= 70 ? 'text-emerald-700' : 'text-danger-action'}`}>
                      {(a.evaluation.total_score || 0).toFixed(2)} / 100
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Recomendación: {RECOMMENDATION_LABELS[a.evaluation.recommendation]}
                    </span>
                  </div>
                ) : a.has_conflict_of_interest ? (
                  <Badge variant="warning" size="sm">Revisor inhibido (BR-011)</Badge>
                ) : (
                  <Badge variant="neutral" size="sm">Evaluación pendiente</Badge>
                )}
              </div>

              {a.evaluation && (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed italic bg-surface-sunken p-3.5 rounded-xl border border-slate-200">"{a.evaluation.comments}"</p>
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase">Criterios de la Rúbrica Evaluada:</h3>
                    <div className="space-y-2">
                      {a.evaluation.rubric_scores?.map(crit => (
                        <div
                          key={crit.criterion_id}
                          className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-primary">{crit.criterion_name}</p>
                            {crit.qualitative_justification && <p className="text-[11px] text-slate-500 italic mt-0.5">"{crit.qualitative_justification}"</p>}
                          </div>
                          <span className="font-mono font-bold text-secondary tabular-nums shrink-0">
                            {crit.score} / {crit.max_score} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </Card>
          ))}
          {evaluated.length > 1 && (
            <p className="text-xs text-slate-500 text-right">
              Promedio de {evaluated.length} evaluaciones:{' '}
              <strong className="font-mono">{(evaluated.reduce((s, e) => s + (e.evaluation?.total_score || 0), 0) / evaluated.length).toFixed(2)}</strong>
            </p>
          )}
        </div>
      )}

      {/* PESTAÑA 5: Archivos */}
      {activeTab === 'archivos' && (
        <Card padding="p-8" className="space-y-4">
          <div className="text-center space-y-2">
            <Files className="w-12 h-12 text-secondary mx-auto" />
            <h2 className="text-base font-bold text-primary">Gestor Documental Versionado</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {documents.length} documento(s) con {documents.reduce((s, d) => s + d.versions.length, 0)} versión(es) inmutables registradas.
            </p>
          </div>
          {documents.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
              {documents.map(d => (
                <li key={d.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className={`font-medium ${d.obsolete_reason ? 'line-through text-slate-400' : 'text-primary'}`}>{d.name}</span>
                  <span className="font-mono text-slate-400">v{d.versions.length}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-center">
            <Button type="button" variant="primary" onClick={() => (window.location.hash = docsHref)}>
              Ir al Gestor Documental del Proyecto
            </Button>
          </div>
        </Card>
      )}

      {/* PESTAÑA 6: Productos Científicos (FR-030..032, V05) */}
      {activeTab === 'productos' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-primary">Productos Científicos Registrados (FR-030)</h2>
              <p className="text-xs text-slate-500">Regla BR-013: Solo los productos con validación formal de Coordinación se contabilizan en indicadores.</p>
            </div>
            {isTeam && (activeRole === 'researcher' || activeRole === 'student_researcher') && (
              <Button type="button" variant="primary" onClick={() => setIsNewProductModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
                Registrar Nuevo Producto
              </Button>
            )}
          </div>

          {products.length === 0 && <Card padding="p-6" className="text-center text-xs text-slate-500">Aún no hay productos registrados.</Card>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {products.map(prod => (
              <Card key={prod.id} padding="p-6" className="space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{prod.type.replace('_', ' ')}</span>
                    {prod.validated_at ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Validado por Coordinación
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Pendiente de Validación</span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-primary leading-snug">{prod.title}</h3>
                  <p className="text-xs text-slate-500">{prod.authors}</p>
                  <p className="text-xs text-slate-600 font-medium">Revista / Congreso: {prod.venue || '—'}</p>
                  {prod.doi_or_url &&
                    (safeExternalUrl(prod.doi_or_url) ? (
                      <a href={safeExternalUrl(prod.doi_or_url)!} target="_blank" rel="noopener noreferrer" className="text-[11px] text-secondary hover:underline break-all block">
                        {prod.doi_or_url}
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500 break-all block">{prod.doi_or_url}</span>
                    ))}
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Fecha: {formatDate(prod.product_date)}</span>
                  {activeRole === 'research_coordinator' && !prod.validated_at && (
                    <Button type="button" variant="outline" size="sm" onClick={() => handleValidateProduct(prod.id)}>
                      Validar para Indicadores (BR-013)
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA 7: Historial y Checklist de Cierre (FR-018, FR-044) */}
      {activeTab === 'historial' && (
        <div className="space-y-6">
          {closureChecklist && (
            <Card padding="p-6" className="space-y-4 border-2 border-slate-200">
              <h2 className="text-base font-bold text-primary">Checklist Institucional de Cierre de Proyecto (FR-044, Regla BR-006)</h2>
              <div className="space-y-2.5 text-xs">
                {[
                  [closureChecklist.final_report_uploaded, 'Informe Final de Liquidación Científica cargado en el expediente.'],
                  [closureChecklist.all_mandatory_deliverables_resolved, 'Entregables obligatorios en estado Enviado, Aprobado o Cancelado formalmente.'],
                  [closureChecklist.research_products_registered, 'Al menos un producto de investigación registrado.'],
                ].map(([ok, label], i) => (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                    {ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <XCircle className="w-4 h-4 shrink-0 text-red-600" />}
                    <span>{label as string}</span>
                  </div>
                ))}
              </div>
              {activeRole === 'research_coordinator' && project.status === 'Closure requested' && (
                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <Button type="button" variant="primary" disabled={!closureChecklist.can_approve_closure} onClick={() => openDecision('Closed')}>
                    Aprobar Cierre Formal (Paso a Closed)
                  </Button>
                </div>
              )}
            </Card>
          )}

          <Card padding="p-6" className="space-y-4">
            <h2 className="text-base font-bold text-primary">Historial de Estados (FR-018)</h2>
            <ol className="relative border-l border-slate-200 ml-2 space-y-4">
              {(project.status_history || []).map(h => (
                <li key={h.id} className="ml-4">
                  <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-secondary border-2 border-white" />
                  <p className="text-xs font-semibold text-primary">
                    {h.from_status ? `${STATUS_LABELS[h.from_status] || h.from_status} → ` : ''}
                    {STATUS_LABELS[h.to_status] || h.to_status}
                  </p>
                  <p className="text-[11px] text-slate-500">{h.justification}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {formatDateTime(h.created_at)}
                    {h.actor_name ? ` · ${h.actor_name}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </Card>

          <TechDetails
            title="Trazabilidad Criptográfica del Expediente"
            hash={proposalHash}
            cvd={project.cvd_code || undefined}
            blockNumber={project.row_version}
            oid="2.16.604.1.101.44"
          />
        </div>
      )}

      {/* Modal de Carga de Evidencia para Entregable (FR-022) */}
      <Modal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        title={`Adjuntar Evidencia Probatoria: ${selectedDeliverable?.name || ''}`}
        description="Requisito Normativo Obligatorio (FR-022): No se puede marcar como enviado sin evidencia."
        footer={
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsEvidenceModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={isSubmittingDeliverable}
              disabled={!evidenceFile && !evidenceExistingId}
              onClick={handleSubmitDeliverableWithEvidence}
            >
              Confirmar y Enviar a Dictamen
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <label
            className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              evidenceFile ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-secondary bg-surface-sunken'
            }`}
          >
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.csv,.txt"
              onChange={e => {
                setEvidenceFile(e.target.files?.[0] || null);
                setEvidenceExistingId('');
              }}
            />
            {evidenceFile ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold text-emerald-800 break-all">{evidenceFile.name}</p>
                <span className="text-[11px] text-emerald-600">{(evidenceFile.size / 1024 / 1024).toFixed(2)} MB • El servidor calculará su hash SHA-256</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-semibold text-primary">Haga clic para seleccionar la evidencia probatoria (≤ 25 MB)</p>
                <p className="text-[11px] text-slate-500">Formatos válidos: PDF, DOCX, XLSX, PPTX, PNG, JPG, CSV, TXT (FR-025)</p>
              </div>
            )}
          </label>
          {documents.filter(d => !d.obsolete_reason).length > 0 && (
            <div className="space-y-1">
              <label htmlFor="existing-evidence" className="font-semibold text-primary block">
                …o vincule un documento ya cargado en el expediente:
              </label>
              <select
                id="existing-evidence"
                value={evidenceExistingId}
                onChange={e => {
                  setEvidenceExistingId(e.target.value);
                  if (e.target.value) setEvidenceFile(null);
                }}
                className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
              >
                <option value="">— Seleccionar —</option>
                {documents
                  .filter(d => !d.obsolete_reason)
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} (v{d.versions.length})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Decisión de la Coordinación (FR-014, FR-017) */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title="Dictamen de Coordinación"
        description={`Estado actual: ${STATUS_LABELS[project.status] || project.status}. La decisión queda registrada en el historial y la bitácora inmutable.`}
        footer={
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsDecisionModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={isDeciding}
              disabled={!decisionTarget || decisionJustification.trim().length < 5}
              onClick={() => decisionTarget && handleTransition(decisionTarget, decisionJustification)}
            >
              Registrar Decisión
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="decision-target" className="font-semibold text-primary block">Nuevo estado *</label>
            <select
              id="decision-target"
              value={decisionTarget}
              onChange={e => setDecisionTarget(e.target.value as ProjectStatus)}
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
            >
              {(decisionTarget === 'Closed' && !coordOptions.includes('Closed') ? ['Closed' as ProjectStatus] : coordOptions).map(s => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] || s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="decision-just" className="font-semibold text-primary block">Justificación obligatoria *</label>
            <textarea
              id="decision-just"
              rows={4}
              value={decisionJustification}
              onChange={e => setDecisionJustification(e.target.value)}
              placeholder="Fundamente la decisión (mínimo 5 caracteres)…"
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
            />
          </div>
          {decisionTarget === 'Closed' && closureChecklist && !closureChecklist.can_approve_closure && (
            <p className="text-red-700 bg-red-50 p-2 rounded-md border border-red-200">El checklist de cierre (BR-006) está incompleto; el servidor rechazará el cierre.</p>
          )}
        </div>
      </Modal>

      {/* Modal para Registrar Nuevo Producto Científico */}
      <Modal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        title="Registrar Nuevo Producto de Investigación"
        description="FR-030: Registro de artículos, ponencias, libros, patentes o software."
        footer={
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsNewProductModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleCreateProduct}>
              Guardar Producto
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-primary block">Tipo de Producto *</label>
            <select value={newProductType} onChange={e => setNewProductType(e.target.value as any)} className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md">
              <option value="journal_article">Artículo de Revista (Journal Article)</option>
              <option value="conference_paper">Ponencia en Congreso (Conference Paper)</option>
              <option value="book">Libro</option>
              <option value="book_chapter">Capítulo de Libro</option>
              <option value="thesis">Tesis de Grado / Posgrado</option>
              <option value="patent">Patente / Modelo de Utilidad</option>
              <option value="software">Software / Paquete Computacional</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-primary block">Título del Producto *</label>
            <input
              type="text"
              value={newProductTitle}
              onChange={e => setNewProductTitle(e.target.value)}
              placeholder="Ej. Análisis de Redes Telemétricas..."
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-primary block">Autores</label>
            <input
              type="text"
              value={newProductAuthors}
              onChange={e => setNewProductAuthors(e.target.value)}
              placeholder="Apellidos, N., ..."
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-primary block">Editorial o Revista</label>
              <input
                type="text"
                value={newProductVenue}
                onChange={e => setNewProductVenue(e.target.value)}
                placeholder="Ej. IEEE / Elsevier"
                className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-primary block">DOI o Enlace URL</label>
              <input
                type="text"
                value={newProductDoi}
                onChange={e => setNewProductDoi(e.target.value)}
                placeholder="https://doi.org/..."
                className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
