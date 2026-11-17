import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ObservationSubsanationItem, Project } from '../../types/domain';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getHashQueryParam } from '../../utils/routing';
import { CheckCircle2, AlertTriangle, Sparkles, Send, Save } from 'lucide-react';

export const ObservationSubsanationView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [project, setProject] = useState<Project | null>(null);
  const [observations, setObservations] = useState<ObservationSubsanationItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { corrected: string; justification: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api
      .getObservationProjects()
      .then(list => {
        setProjects(list);
        const fromHash = getHashQueryParam('proyecto');
        const pick = list.find(p => p.id === fromHash) || list.find(p => p.status === 'Changes requested') || list[0];
        setProjectId(pick?.id || '');
        if (!list.length) setError('No hay expedientes con observaciones registradas para su rol.');
      })
      .catch(err => setError(err.message));
  }, [activeRole]);

  const loadProject = async (id: string) => {
    const [p, obs] = await Promise.all([api.getProjectById(id), api.getObservations(id)]);
    setProject(p);
    setObservations(obs);
    setDrafts(Object.fromEntries(obs.map(o => [o.id, { corrected: o.corrected_text_v2, justification: o.researcher_justification }])));
    setDeclarationChecked(false);
  };

  useEffect(() => {
    if (projectId) loadProject(projectId).catch(err => setError(err.message));
  }, [projectId]);

  const editable = Boolean(project && user && project.pi_user_id === user.id && project.status === 'Changes requested');
  const resolvedCount = observations.filter(o => o.resolved).length;
  const isAllResolved = observations.length > 0 && resolvedCount === observations.length;
  const canSubmit = editable && isAllResolved && declarationChecked;

  const saveObservation = async (obs: ObservationSubsanationItem, resolved: boolean) => {
    const d = drafts[obs.id];
    setSavingId(obs.id);
    try {
      const updated = await api.updateObservation(obs.id, {
        corrected_text_v2: d?.corrected ?? '',
        researcher_justification: d?.justification ?? '',
        resolved,
      });
      setObservations(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleSubmitSubsanacion = async () => {
    if (!canSubmit || !project) return;
    setIsSubmitting(true);
    try {
      await api.submitProject(project.id, project.row_version);
      alert('Expediente subsanado y reenviado a revisión del Comité. Quedó registrado en el historial y la bitácora.');
      window.location.hash = `#/proyectos/${project.id}`;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !project) {
    return (
      <Card padding="p-8" className="text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <p className="text-sm text-slate-600">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="font-bold text-secondary">{project?.code}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Expediente Anónimo: {project?.anonymous_code}</span>
            {project && <Badge status={project.status} size="sm" />}
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">Subsanación de Observaciones — Redline Diff Consolidado (V07)</h1>
          <p className="text-xs sm:text-sm text-slate-500">Comparador de cambios entre el texto observado por el Comité y el texto corregido por el Investigador Principal.</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {projects.length > 1 && (
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              aria-label="Expediente"
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs max-w-xs"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title.slice(0, 50)}
                </option>
              ))}
            </select>
          )}
          <span
            className={`text-xs font-mono font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${
              isAllResolved ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {resolvedCount} de {observations.length} Subsanaciones Resueltas
          </span>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-secondary/20 flex items-center gap-2.5 text-xs">
        <Sparkles className="w-5 h-5 text-secondary shrink-0" />
        <p className="text-primary leading-relaxed">
          {editable
            ? 'Registre el texto corregido y su justificación para cada observación. Cuando todas estén subsanadas podrá reenviar el expediente.'
            : 'Vista de solo lectura: la edición está disponible para el Investigador Principal mientras el proyecto está en estado "Requiere subsanación".'}{' '}
          La aprobación final corresponde al Comité de Ética y a la Coordinación.
        </p>
      </div>

      <div className="space-y-6">
        {observations.map((obs, idx) => {
          const d = drafts[obs.id] || { corrected: '', justification: '' };
          const dirty = d.corrected !== obs.corrected_text_v2 || d.justification !== obs.researcher_justification;
          return (
            <Card key={obs.id} padding="p-6" className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-secondary/10 text-secondary font-bold text-xs flex items-center justify-center font-mono">{idx + 1}</span>
                  <h2 className="text-sm font-bold text-primary">{obs.section_name}</h2>
                </div>
                {obs.resolved ? (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Subsanación Conforme
                  </span>
                ) : (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Pendiente
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-red-50/70 border border-red-200/80 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-red-800 uppercase tracking-wider block">Texto Observado</span>
                  <p className="text-red-950 line-through leading-relaxed">{obs.original_text_v1}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">Texto Corregido</span>
                  {editable ? (
                    <textarea
                      rows={4}
                      value={d.corrected}
                      onChange={e => setDrafts(prev => ({ ...prev, [obs.id]: { ...d, corrected: e.target.value } }))}
                      aria-label={`Texto corregido: ${obs.section_name}`}
                      className="w-full p-2 bg-white border border-emerald-200 rounded-md text-xs text-emerald-950"
                    />
                  ) : (
                    <p className="text-emerald-950 font-medium leading-relaxed">{obs.corrected_text_v2 || '— Sin corrección registrada —'}</p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-surface-sunken rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2">
                <strong className="text-primary font-semibold block">Justificación Técnica del Investigador:</strong>
                {editable ? (
                  <textarea
                    rows={2}
                    value={d.justification}
                    onChange={e => setDrafts(prev => ({ ...prev, [obs.id]: { ...d, justification: e.target.value } }))}
                    aria-label={`Justificación: ${obs.section_name}`}
                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs"
                  />
                ) : (
                  <span>{obs.researcher_justification || '—'}</span>
                )}
              </div>

              {editable && (
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={!dirty} isLoading={savingId === obs.id} onClick={() => saveObservation(obs, obs.resolved)} icon={<Save className="w-3.5 h-3.5" />}>
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant={obs.resolved ? 'ghost' : 'secondary'}
                    size="sm"
                    isLoading={savingId === obs.id}
                    onClick={() => saveObservation(obs, !obs.resolved)}
                  >
                    {obs.resolved ? 'Reabrir' : 'Marcar como Subsanada'}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {editable && (
        <Card padding="p-6" className="space-y-4 border-2 border-slate-200 bg-white">
          <h3 className="text-sm font-bold text-primary">Ratificación y Reenvío Oficial de la Propuesta Subsanada</h3>
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={declarationChecked}
              onChange={e => setDeclarationChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
            />
            <span className="text-xs text-primary font-medium leading-relaxed">
              Declaro bajo juramento que las {observations.length} modificaciones consignadas responden íntegramente a las observaciones formuladas por el Comité y no alteran los
              objetivos generales del proyecto.
            </span>
          </label>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              {!isAllResolved ? 'Subsane todas las observaciones para habilitar el reenvío.' : !declarationChecked ? 'Complete la declaración jurada para habilitar el reenvío oficial.' : ''}
            </span>
            <Button type="button" variant="primary" disabled={!canSubmit} isLoading={isSubmitting} onClick={handleSubmitSubsanacion} icon={<Send className="w-4 h-4" />}>
              Firmar y Reenviar Propuesta Subsanada
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
