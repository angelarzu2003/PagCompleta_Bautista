import React, { useEffect, useMemo, useState } from 'react';
import { Stepper, StepItem } from '../../components/ui/Stepper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { api, Catalogs } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SpecificObjective, AIPreCheckResult, Project } from '../../types/domain';
import { countWords, formatCurrencyPEN } from '../../utils/formatters';
import {
  AlertTriangle,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Save,
  HelpCircle
} from 'lucide-react';

const STEPS: StepItem[] = [
  { id: 1, title: 'Datos Generales', description: 'Información básica y tipificación' },
  { id: 2, title: 'Equipo', description: 'Asignación de investigadores' },
  { id: 3, title: 'Objetivos y Metodología', description: 'OE1-OE3 y resumen analítico' },
  { id: 4, title: 'Calendario y Presupuesto', description: 'Fechas y fases financieras' },
  { id: 5, title: 'Declaraciones y Envío', description: 'Pre-chequeo IA y confirmación' },
];

export const NewProjectWizard: React.FC = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [title, setTitle] = useState('');
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [existingProjects, setExistingProjects] = useState<Project[]>([]);
  const [departmentId, setDepartmentId] = useState(user?.department_id || '');
  const [areaId, setAreaId] = useState('');
  const [lineId, setLineId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [generalObjective, setGeneralObjective] = useState('');
  const [justification, setJustification] = useState('');
  const [fundingSource, setFundingSource] = useState('');
  const [confidential, setConfidential] = useState(false);

  // Objetivos específicos dinámicos (mínimo 3 obligatorios OE1, OE2, OE3)
  const [specificObjectives, setSpecificObjectives] = useState<SpecificObjective[]>([
    { id: 'OE1', order: 1, description: '' },
    { id: 'OE2', order: 2, description: '' },
    { id: 'OE3', order: 3, description: '' },
  ]);

  const [summary, setSummary] = useState('');
  const [methodology, setMethodology] = useState('');
  const nextMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toISOString().slice(0, 10);
  })();
  const plusOneYear = (() => {
    const d = new Date(nextMonth);
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const [startDate, setStartDate] = useState(nextMonth);
  const [endDate, setEndDate] = useState(plusOneYear);
  const [requestedFunding, setRequestedFunding] = useState(100000);

  // Declaraciones éticas (desmarcadas por defecto)
  const [declEthics, setDeclEthics] = useState(false);
  const [declIntegrity, setDeclIntegrity] = useState(false);

  // Estado de validación con Enlaces de Foco (FR-009, UC-004 E1)
  const [formErrors, setFormErrors] = useState<{ field: string; message: string }[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-chequeo IA (AIR-008, AIR-009)
  const [aiPreCheck, setAiPreCheck] = useState<AIPreCheckResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Catálogos institucionales y proyectos existentes (para la alerta de duplicados FR-010)
  useEffect(() => {
    api
      .getCatalogs()
      .then(c => {
        setCatalogs(c);
        setDepartmentId(prev => (c.departments.some(d => d.id === prev) ? prev : c.departments[0]?.id || ''));
        setAreaId(prev => prev || c.research_areas[0]?.id || '');
        setTypeId(prev => prev || c.project_types[0]?.id || '');
      })
      .catch(err => alert(`No se pudieron cargar los catálogos: ${err.message}`));
    api.getProjects().then(setExistingProjects).catch(() => undefined);
  }, []);

  const linesForArea = useMemo(
    () => (catalogs?.research_lines || []).filter(l => !l.parent_id || l.parent_id === areaId),
    [catalogs, areaId]
  );
  useEffect(() => {
    if (!linesForArea.some(l => l.id === lineId)) setLineId(linesForArea[0]?.id || '');
  }, [linesForArea, lineId]);

  // Alerta de Similitud de Título / Duplicados (FR-010): coincidencia de términos significativos
  const duplicateMatch = useMemo(() => {
    const norm = (t: string) =>
      t
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 4);
    const words = new Set(norm(title));
    if (words.size < 3) return null;
    let best: { project: Project; shared: number } | null = null;
    for (const p of existingProjects) {
      const shared = norm(p.title).filter(w => words.has(w)).length;
      if (shared >= 3 && (!best || shared > best.shared)) best = { project: p, shared };
    }
    return best;
  }, [title, existingProjects]);
  const isDuplicateWarning = Boolean(duplicateMatch);

  const summaryWordCount = countWords(summary);
  const isSummaryOverLimit = summaryWordCount > 500;

  // Manejo de Objetivos Específicos
  const handleAddObjective = () => {
    const nextNum = specificObjectives.length + 1;
    setSpecificObjectives([
      ...specificObjectives,
      { id: `OE${nextNum}`, order: nextNum, description: '' },
    ]);
  };

  const handleRemoveObjective = (index: number) => {
    if (specificObjectives.length <= 3) {
      alert('La regla de validación exige un mínimo de 3 objetivos específicos.');
      return;
    }
    const updated = specificObjectives.filter((_, i) => i !== index);
    setSpecificObjectives(updated);
  };

  const handleObjectiveChange = (index: number, text: string) => {
    const updated = [...specificObjectives];
    updated[index].description = text;
    setSpecificObjectives(updated);
  };

  // Validación por Paso
  const validateCurrentStep = (): boolean => {
    const errors: { field: string; message: string }[] = [];

    if (currentStep === 1) {
      if (title.trim().length < 10) {
        errors.push({ field: 'input-title', message: 'El título de la propuesta es obligatorio (mínimo 10 caracteres).' });
      }
      if (!departmentId || !areaId || !lineId || !typeId) {
        errors.push({ field: 'input-title', message: 'Seleccione facultad, área, línea y tipo de financiamiento.' });
      }
    } else if (currentStep === 3) {
      if (!summary.trim()) {
        errors.push({ field: 'input-summary', message: 'El resumen del proyecto es obligatorio.' });
      }
      if (isSummaryOverLimit) {
        errors.push({ field: 'input-summary', message: 'El resumen no puede exceder las 500 palabras.' });
      }
      if (specificObjectives.some(o => !o.description.trim())) {
        errors.push({ field: 'input-objectives', message: 'Todos los objetivos específicos deben estar descritos.' });
      }
      if (!generalObjective.trim()) {
        errors.push({ field: 'input-general-objective', message: 'El objetivo general es obligatorio.' });
      }
    } else if (currentStep === 4) {
      if (endDate < startDate) {
        errors.push({ field: 'input-end-date', message: 'La fecha de término debe ser posterior a la de inicio (FR-009).' });
      }
      if (requestedFunding <= 0) {
        errors.push({ field: 'input-funding', message: 'El financiamiento solicitado debe ser un valor positivo.' });
      }
    } else if (currentStep === 5) {
      if (!declEthics || !declIntegrity) {
        errors.push({ field: 'input-ethics', message: 'Debe aceptar todas las declaraciones bajo juramento.' });
      }
    }

    setFormErrors(errors);
    return errors.length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(STEPS.length, prev + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
    setFormErrors([]);
  };

  const buildPayload = () => ({
    title,
    department_id: departmentId,
    area_id: areaId,
    line_id: lineId,
    type_id: typeId,
    confidential,
    start_date: startDate,
    end_date: endDate,
    requested_funding: requestedFunding,
    budget_breakdown: [
      { phase_number: 1, name: 'Anticipo Fase I', percentage: 40, amount_pen: Math.round(requestedFunding * 40) / 100 },
      { phase_number: 2, name: 'Hito Intermedio Fase II', percentage: 40, amount_pen: Math.round(requestedFunding * 40) / 100 },
      { phase_number: 3, name: 'Hito Final Fase III', percentage: 20, amount_pen: Math.round((requestedFunding - 2 * Math.round(requestedFunding * 40) / 100) * 100) / 100 },
    ],
    current_version: {
      summary,
      general_objective: generalObjective,
      specific_objectives: specificObjectives,
      objectives: generalObjective,
      justification,
      methodology,
      funding_source: fundingSource || null,
    },
  });

  const handleRunAiPreCheck = async () => {
    if (confidential) return;
    try {
      setIsAiLoading(true);
      const p = buildPayload();
      const res = await api.runAIPreCheckDraft({ ...p, ...p.current_version });
      setAiPreCheck(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (title.trim().length < 10) {
      alert('Para guardar el borrador indique al menos el título (mínimo 10 caracteres).');
      return;
    }
    try {
      setIsSubmitting(true);
      const created = await api.createProject({ ...buildPayload(), submit: false });
      alert(`Borrador guardado como ${created.code}. Puede retomarlo desde su tablero.`);
      window.location.hash = `#/proyectos/${created.id}`;
    } catch (err: any) {
      setFormErrors(err.fields?.map((f: any) => ({ field: `input-${f.field}`, message: f.message })) || []);
      alert(err.message || 'Error al guardar el borrador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      const created = await api.createProject({ ...buildPayload(), submit: true });
      setIsSubmitModalOpen(false);
      alert(`Propuesta ${created.code} enviada a revisión.`);
      window.location.hash = `#/proyectos/${created.id}`;
    } catch (err: any) {
      setIsSubmitModalOpen(false);
      setFormErrors(err.fields?.map((f: any) => ({ field: `input-${f.field}`, message: f.message })) || []);
      alert(err.message || 'Error al enviar la propuesta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Encabezado del Asistente */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-semibold text-secondary uppercase tracking-wider">
            Convocatoria 2026 • Fondos Ordinarios
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">
            Registro de Nueva Propuesta de Investigación
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
            Estado: Borrador (Draft)
          </span>
        </div>
      </div>

      {/* Stepper Desacoplado de 5 Pasos */}
      <Stepper steps={STEPS} currentStep={currentStep} />

      {/* Resumen de Errores con Enlaces de Foco (FR-009, UC-004 E1) */}
      {formErrors.length > 0 && (
        <div className="p-4 bg-danger-bg border border-danger-border rounded-card text-xs text-danger-text space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-danger-action" />
            <span>Existen campos obligatorios o valores inválidos:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {formErrors.map((err, idx) => (
              <li key={idx}>
                <a
                  href={`#${err.field}`}
                  onClick={() => document.getElementById(err.field)?.focus()}
                  className="underline hover:text-red-900 font-semibold"
                >
                  {err.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alerta de Duplicados o Similitud Semántica (FR-010) */}
      {isDuplicateWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-card text-xs text-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Advertencia de Coincidencia de Título (FR-010):</p>
            <p className="mt-0.5 leading-relaxed">
              El título coincide en {duplicateMatch?.shared} términos clave con el proyecto <strong>{duplicateMatch?.project.code}</strong> ("{duplicateMatch?.project.title}"). Verifique que no se trate de una postulación duplicada.
            </p>
          </div>
        </div>
      )}

      {/* Formulario Dinámico según el Paso Activo */}
      <Card padding="p-8" className="space-y-6">
        {/* PASO 1: Datos Generales */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-primary border-b border-slate-100 pb-2">
              1. Identificación y Clasificación Institucional
            </h2>

            <div className="space-y-1.5">
              <label htmlFor="input-title" className="text-xs font-semibold text-primary block">
                Título Oficial del Proyecto *
              </label>
              <input
                id="input-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej. Red de Sensores Inalámbricos para Monitoreo de Recursos Hídricos..."
                className="w-full px-3.5 py-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs text-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">Facultad / Departamento *</label>
                <select
                  value={departmentId}
                  onChange={e => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                >
                  {(catalogs?.departments || []).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">Área de Investigación *</label>
                <select
                  value={areaId}
                  onChange={e => setAreaId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                >
                  {(catalogs?.research_areas || []).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">Línea de Investigación *</label>
                <select
                  value={lineId}
                  onChange={e => setLineId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                >
                  {linesForArea.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">Tipo de Financiamiento *</label>
                <select
                  value={typeId}
                  onChange={e => setTypeId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                >
                  {(catalogs?.project_types || []).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggle de Confidencialidad (AIR-011, BR-014) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-surface-sunken flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-bold text-primary">
                    ¿Este proyecto es de Carácter Confidencial / Patente?
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Si se activa, el expediente será excluido de resúmenes públicos y del asistente de Inteligencia Artificial (AIR-011).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={confidential}
                  onChange={e => setConfidential(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
              </label>
            </div>
          </div>
        )}

        {/* PASO 2: Equipo de Investigación */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-primary border-b border-slate-100 pb-2">
              2. Conformación del Equipo de Investigación (FR-011, BR-012)
            </h2>
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono text-secondary uppercase font-semibold">
                  Investigador Principal (PI) Único
                </span>
                <p className="text-xs font-bold text-primary mt-0.5">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500">{user?.email}</p>
              </div>
              <span className="text-xs bg-white text-secondary px-2.5 py-1 rounded-full border border-blue-200 font-semibold">
                Titular
              </span>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700">Miembros Co-investigadores y Estudiantes:</h3>
              <div className="p-4 border border-dashed border-slate-300 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                La incorporación de co-investigadores y estudiantes se gestiona con la Coordinación de Investigación una vez
                registrada la propuesta (FR-011). El Investigador Principal es único e intransferible (BR-001).
              </div>
            </div>
          </div>
        )}

        {/* PASO 3: Objetivos y Metodología */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-base font-bold text-primary border-b border-slate-100 pb-2">
              3. Resumen Ejecutivo y Objetivos de la Propuesta
            </h2>

            {/* Resumen con Contador Reactivo de Palabras (Máx. 500) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="input-summary" className="text-xs font-semibold text-primary">
                  Resumen Analítico del Proyecto (Máximo 500 palabras) *
                </label>
                <span
                  className={`text-[11px] font-mono font-semibold tabular-nums ${
                    isSummaryOverLimit ? 'text-danger-action' : 'text-slate-500'
                  }`}
                >
                  {summaryWordCount} / 500 palabras
                </span>
              </div>
              <textarea
                id="input-summary"
                rows={4}
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Describa el problema, la hipótesis de trabajo y los resultados esperados..."
                className={`w-full p-3 bg-surface-sunken border rounded-lg text-xs text-primary focus:bg-white focus:outline-none focus:ring-2 leading-relaxed ${
                  isSummaryOverLimit
                    ? 'border-danger-border focus:ring-danger-action/30'
                    : 'border-slate-200 focus:ring-secondary/20 focus:border-secondary'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="input-general-objective" className="text-xs font-semibold text-primary block">
                Objetivo General *
              </label>
              <input
                id="input-general-objective"
                type="text"
                value={generalObjective}
                onChange={e => setGeneralObjective(e.target.value)}
                placeholder="Ej. Determinar el efecto de..."
                className="w-full px-3.5 py-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs text-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
              />
            </div>

            {/* Constructor Dinámico de Objetivos Específicos (OE1..OE3 mínimo) */}
            <div id="input-objectives" className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-primary">
                    Objetivos Específicos (Mínimo 3 obligatorios)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Defina las metas concretas y medibles de la investigación.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddObjective}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Añadir OE
                </Button>
              </div>

              <div className="space-y-2.5">
                {specificObjectives.map((obj, index) => (
                  <div
                    key={obj.id}
                    className="flex items-start gap-3 p-3 bg-surface-sunken rounded-xl border border-slate-200"
                  >
                    <span className="font-mono font-bold text-xs text-secondary mt-2 shrink-0">
                      {obj.id}:
                    </span>
                    <input
                      type="text"
                      value={obj.description}
                      onChange={e => handleObjectiveChange(index, e.target.value)}
                      placeholder={`Descripción del ${obj.id}...`}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-primary focus:outline-none focus:ring-1 focus:ring-secondary"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(index)}
                      disabled={specificObjectives.length <= 3}
                      className="p-2 text-slate-400 hover:text-danger-action disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title={specificObjectives.length <= 3 ? 'Se requiere un mínimo de 3 objetivos' : 'Eliminar'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-primary block">
                Metodología y Diseño Experimental
              </label>
              <textarea
                rows={3}
                value={methodology}
                onChange={e => setMethodology(e.target.value)}
                placeholder="Detalle los métodos de recolección de datos, instrumentos y análisis..."
                className="w-full p-3 bg-surface-sunken border border-slate-200 rounded-lg text-xs leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-primary block">Justificación</label>
              <textarea
                rows={3}
                value={justification}
                onChange={e => setJustification(e.target.value)}
                placeholder="Relevancia del problema, antecedentes y beneficiarios..."
                className="w-full p-3 bg-surface-sunken border border-slate-200 rounded-lg text-xs leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* PASO 4: Calendario y Presupuesto */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-base font-bold text-primary border-b border-slate-100 pb-2">
              4. Cronograma y Distribución Presupuestal
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">Fecha de Inicio *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="input-end-date" className="text-xs font-semibold text-primary block">
                  Fecha de Término (end_date &gt;= start_date) *
                </label>
                <input
                  id="input-end-date"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="input-funding" className="text-xs font-semibold text-primary block">
                Monto Total Adjudicado Solicitado (PEN) *
              </label>
              <input
                id="input-funding"
                type="number"
                value={requestedFunding}
                onChange={e => setRequestedFunding(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-sm font-mono font-bold tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-primary block">Fuente de Financiamiento</label>
              <input
                type="text"
                value={fundingSource}
                onChange={e => setFundingSource(e.target.value)}
                placeholder="Ej. Fondos Concursables Internos 2027 - URPMP"
                className="w-full px-3.5 py-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
              />
            </div>

            {/* Coherencia Financiera de las 3 Fases (Sección 9) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700">Desglose de Desembolsos por Hitos (100%):</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-surface-sunken rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block">Fase I (40%)</span>
                  <span className="font-mono font-bold text-xs text-primary tabular-nums">
                    {formatCurrencyPEN(requestedFunding * 0.4)}
                  </span>
                </div>
                <div className="p-3 bg-surface-sunken rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block">Fase II (40%)</span>
                  <span className="font-mono font-bold text-xs text-primary tabular-nums">
                    {formatCurrencyPEN(requestedFunding * 0.4)}
                  </span>
                </div>
                <div className="p-3 bg-surface-sunken rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block">Fase III (20%)</span>
                  <span className="font-mono font-bold text-xs text-primary tabular-nums">
                    {formatCurrencyPEN(requestedFunding * 0.2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 5: Declaraciones y Envío */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-base font-bold text-primary border-b border-slate-100 pb-2">
              5. Pre-chequeo Normativo con IA y Declaraciones Finales
            </h2>

            {/* Asistente IA Pre-chequeo (AIR-008, AIR-009) */}
            <div className="p-5 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-secondary/20 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-secondary text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-primary">
                      Pre-chequeo Preventivo de Completitud con IA
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Análisis orientativo de requisitos de forma antes del envío oficial.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={confidential || isAiLoading}
                  isLoading={isAiLoading}
                  onClick={handleRunAiPreCheck}
                >
                  {confidential ? 'No aplicable (Confidencial)' : 'Ejecutar Pre-chequeo'}
                </Button>
              </div>

              {aiPreCheck && (
                <div className="mt-3 p-3.5 bg-white rounded-xl border border-secondary/20 text-xs space-y-2">
                  <span className="font-mono text-[10px] text-secondary bg-blue-50 px-2 py-0.5 rounded-full font-semibold">
                    Orientación no vinculante (AIR-009)
                  </span>
                  <p className="text-slate-600">{aiPreCheck.advisory_notice}</p>
                  <div className="space-y-1.5 pt-1">
                    {aiPreCheck.observations.map((obs, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-700">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p>
                          <strong>{obs.section_affected} — {obs.issue_detected}:</strong> {obs.suggestion}{' '}
                          <span className="text-[10px] text-slate-400 font-mono">({obs.guideline_reference})</span>
                        </p>
                      </div>
                    ))}
                    {aiPreCheck.observations.length === 0 && (
                      <div className="flex items-start gap-2 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <p>Sin observaciones preventivas.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Checkboxes de Declaración Jurada */}
            <div id="input-ethics" className="space-y-3 pt-2">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={declEthics}
                  onChange={e => setDeclEthics(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
                />
                <span className="text-xs text-primary font-medium leading-relaxed">
                  Declaro que el contenido de esta propuesta es original y cumple con las directivas del Comité de Ética en Investigación de la URPMP.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={declIntegrity}
                  onChange={e => setDeclIntegrity(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
                />
                <span className="text-xs text-primary font-medium leading-relaxed">
                  Acepto que una vez enviada, la propuesta pasará a estado de solo lectura durante el periodo de evaluación colegiada (UC-004).
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Barra Fija de Botones de Navegación del Wizard */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={handlePrev}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                Anterior
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              icon={<Save className="w-4 h-4" />}
            >
              Guardar Borrador
            </Button>

            {currentStep < STEPS.length ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleNext}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Siguiente
              </Button>
            ) : (
              /* Único Botón CTA Primario (#0051d5) de la Pantalla Final */
              <Button
                type="button"
                variant="primary"
                disabled={!declEthics || !declIntegrity}
                onClick={() => setIsSubmitModalOpen(true)}
              >
                Enviar a Revisión
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Modal de Confirmación de Envío (UC-004) */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Confirmar Envío de Propuesta a Revisión"
        description="Paso a modo de solo lectura para evaluación colegiada"
        footer={
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSubmitModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={isSubmitting}
              onClick={handleConfirmSubmit}
            >
              Confirmar y Enviar
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            Al pulsar <strong>«Confirmar y Enviar»</strong>, la propuesta quedará formalmente registrada bajo el código provisional <strong>#PROP-2026-NUEVO</strong> y no podrá ser editada mientras permanezca en evaluación.
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
            Nota: Si el comité emite observaciones, se habilitará la pestaña de <strong>Subsanación de Observaciones (Redline Diff)</strong>.
          </div>
        </div>
      </Modal>
    </div>
  );
};
