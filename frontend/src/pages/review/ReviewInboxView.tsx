import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { api, ReviewAssignmentWithProject } from '../../api/client';
import { EvaluationDecisionType } from '../../types/domain';
import { formatDate, formatCurrencyPEN } from '../../utils/formatters';
import { FileSearch, Sparkles, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Send, Lock } from 'lucide-react';

const CRITERIA = [
  { id: 'crit-01', label: '1. Rigor Metodológico', max: 35 },
  { id: 'crit-02', label: '2. Impacto Social', max: 35 },
  { id: 'crit-03', label: '3. Coherencia Presupuestal', max: 30 },
];

const RECOMMENDATIONS: { value: EvaluationDecisionType; label: string }[] = [
  { value: 'approve', label: 'Aprobar' },
  { value: 'request_changes', label: 'Solicitar cambios' },
  { value: 'reject', label: 'Rechazar' },
];

export const ReviewInboxView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [assignments, setAssignments] = useState<ReviewAssignmentWithProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictReason, setConflictReason] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({ 'crit-01': 0, 'crit-02': 0, 'crit-03': 0 });
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<EvaluationDecisionType>('approve');
  const [evaluationComments, setEvaluationComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await api.getReviewAssignments();
      setAssignments(list);
      setSelectedId(prev => (list.some(a => a.id === prev) ? prev : list.find(a => !a.evaluation && !a.has_conflict_of_interest)?.id || list[0]?.id || null));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeRole]);

  const selected = assignments.find(a => a.id === selectedId) || null;
  const totalScore = CRITERIA.reduce((s, c) => s + (scores[c.id] || 0), 0);
  const canEvaluate = activeRole === 'committee_member' && selected && !selected.evaluation && !selected.has_conflict_of_interest;

  useEffect(() => {
    setScores({ 'crit-01': 0, 'crit-02': 0, 'crit-03': 0 });
    setJustifications({});
    setEvaluationComments('');
    setRecommendation('approve');
  }, [selectedId]);

  const handleDeclareConflict = async () => {
    if (!selected) return;
    if (!conflictReason.trim()) {
      alert('Debe especificar el motivo del conflicto de interés (BR-011).');
      return;
    }
    try {
      await api.declareConflict(selected.id, conflictReason);
      setIsConflictModalOpen(false);
      setConflictReason('');
      alert('Inhibición ética registrada. La Coordinación fue notificada para reasignar el expediente.');
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEmitDictamen = async () => {
    if (!selected) return;
    if (evaluationComments.trim().length < 10) {
      alert('La justificación cualitativa del dictamen es obligatoria (mínimo 10 caracteres).');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.submitEvaluation(selected.id, {
        recommendation,
        comments: evaluationComments,
        rubric_scores: CRITERIA.map(c => ({ criterion_id: c.id, score: scores[c.id] || 0, qualitative_justification: justifications[c.id] || '' })),
      });
      alert(`Dictamen registrado (${totalScore}/100). La evaluación queda sellada y es inmutable (BR-003).`);
      load();
    } catch (err: any) {
      alert(err.fields?.[0]?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const p = selected?.project;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-semibold text-secondary uppercase tracking-wider">Evaluación por Pares Ciegos (BR-014) • Comité Institucional</span>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">Bandeja de Revisión y Dictamen Colegiado</h1>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {activeRole === 'committee_member' ? 'Revisor Activo' : 'Coordinación (solo lectura)'}: <strong className="text-primary">{user?.full_name}</strong>
        </span>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

      {!loading && assignments.length === 0 && !error && (
        <Card padding="p-8" className="text-center space-y-2">
          <FileSearch className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-500">No tiene expedientes asignados para evaluación.</p>
        </Card>
      )}

      {assignments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* PANEL IZQUIERDO: Lista de Expedientes */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Expedientes Asignados</span>
              <span className="text-[11px] font-mono text-secondary bg-blue-50 px-2 py-0.5 rounded-full font-bold">{assignments.length}</span>
            </div>
            <div className="space-y-2.5">
              {assignments.map(a => (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(a.id)}
                  onKeyDown={e => e.key === 'Enter' && setSelectedId(a.id)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                    selectedId === a.id ? 'border-secondary bg-white shadow-soft ring-1 ring-secondary/20' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-secondary">{a.project.anonymous_code || a.project.code}</span>
                    <Badge status={a.project.status} size="sm" />
                  </div>
                  <h3 className="text-xs font-bold text-primary mt-1 line-clamp-2">{a.project.title}</h3>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> Vence: {formatDate(a.due_at)}
                    </span>
                    {a.evaluation ? (
                      <span className="font-mono font-bold text-emerald-700">{a.evaluation.total_score} pts</span>
                    ) : a.has_conflict_of_interest ? (
                      <span className="text-amber-600 font-semibold">Inhibido</span>
                    ) : (
                      <span className="font-mono font-bold text-primary">{(a.project.requested_funding / 1000).toFixed(0)}k PEN</span>
                    )}
                  </div>
                  {activeRole === 'research_coordinator' && a.reviewer_name && <p className="text-[10px] text-slate-400 mt-1">{a.reviewer_alias} · {a.reviewer_name}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* PANEL CENTRAL: Visor de la Propuesta + Resumen */}
          {selected && p && (
            <div className="lg:col-span-5 space-y-4">
              <Card padding="p-6" className="space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-400">DOCUMENTO ANÓNIMO CIEGO (BR-014)</span>
                    <h2 className="text-base font-bold text-primary mt-0.5">{p.anonymous_code}</h2>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">Copia Ciega / No Distribuir</span>
                </div>

                {selected.ai_summary ? (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-secondary/20 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="w-4 h-4 text-secondary" />
                      <span className="text-xs font-bold text-primary">Resumen Ejecutivo Automático (AIR-010)</span>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded-full text-secondary font-semibold border border-secondary/20">
                        Apoyo orientativo ({selected.ai_summary.word_count} palabras)
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{selected.ai_summary.summary_text}</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Proyecto confidencial: excluido del procesamiento automático (AIR-011).
                  </div>
                )}

                <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                  <h3 className="font-bold text-primary">Título:</h3>
                  <p className="p-3 bg-surface-sunken rounded-lg border border-slate-200">{p.title}</p>
                  <h3 className="font-bold text-primary">Objetivo General de la Propuesta:</h3>
                  <p className="p-3 bg-surface-sunken rounded-lg border border-slate-200">{p.current_version?.general_objective || '—'}</p>
                  {p.current_version?.specific_objectives && (
                    <>
                      <h3 className="font-bold text-primary">Objetivos Específicos:</h3>
                      <ul className="p-3 bg-surface-sunken rounded-lg border border-slate-200 space-y-1">
                        {p.current_version.specific_objectives.map(o => (
                          <li key={o.id}>
                            <strong className="font-mono text-secondary">{o.id}.</strong> {o.description}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <h3 className="font-bold text-primary">Metodología y Plan Experimental:</h3>
                  <p className="p-3 bg-surface-sunken rounded-lg border border-slate-200">{p.current_version?.methodology || '—'}</p>
                  <p className="text-[11px] text-slate-500">
                    Presupuesto: <strong className="font-mono">{formatCurrencyPEN(p.requested_funding)}</strong> · Ejecución: {formatDate(p.start_date)} – {formatDate(p.end_date)}
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* PANEL DERECHO: Rúbrica de Evaluación y Dictamen */}
          {selected && (
            <div className="lg:col-span-4 space-y-4">
              <Card padding="p-6" className="space-y-5">
                {selected.evaluation ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <h3 className="text-sm font-bold">Dictamen emitido</h3>
                    </div>
                    <p className="text-2xl font-mono font-bold text-primary">{selected.evaluation.total_score} / 100</p>
                    <p className="text-xs text-slate-600 italic">"{selected.evaluation.comments}"</p>
                    {selected.evaluation.rubric_scores?.map(r => (
                      <div key={r.criterion_id} className="flex justify-between text-xs border-t border-slate-100 pt-2">
                        <span>{r.criterion_name}</span>
                        <span className="font-mono font-bold">
                          {r.score}/{r.max_score}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : selected.has_conflict_of_interest ? (
                  <div className="flex items-start gap-2 text-amber-800 text-xs">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p>El revisor se inhibió por conflicto de interés (BR-011). La Coordinación debe reasignar el expediente.</p>
                  </div>
                ) : !canEvaluate ? (
                  <p className="text-xs text-slate-500">Evaluación pendiente del revisor asignado ({selected.reviewer_alias}).</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-primary">Rúbrica de Calificación</h3>
                        <p className="text-[11px] text-slate-500">Puntaje acumulado: 0 a 100 puntos (mínimo aprobatorio 70)</p>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono text-2xl font-bold tabular-nums ${totalScore >= 70 ? 'text-emerald-700' : 'text-secondary'}`}>{totalScore}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">/ 100 Pts</span>
                      </div>
                    </div>

                    {CRITERIA.map(c => (
                      <div key={c.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label htmlFor={`score-${c.id}`} className="font-semibold text-primary">
                            {c.label} (Máx. {c.max}):
                          </label>
                          <span className="font-mono font-bold text-secondary">{scores[c.id]} pts</span>
                        </div>
                        <input
                          id={`score-${c.id}`}
                          type="range"
                          min="0"
                          max={c.max}
                          value={scores[c.id]}
                          onChange={e => setScores(prev => ({ ...prev, [c.id]: Number(e.target.value) }))}
                          className="w-full accent-secondary"
                        />
                        <input
                          type="text"
                          value={justifications[c.id] || ''}
                          onChange={e => setJustifications(prev => ({ ...prev, [c.id]: e.target.value }))}
                          placeholder="Justificación del criterio…"
                          aria-label={`Justificación ${c.label}`}
                          className="w-full px-2 py-1.5 bg-surface-sunken border border-slate-200 rounded-md text-[11px]"
                        />
                      </div>
                    ))}

                    <div className="space-y-1.5">
                      <label htmlFor="recommendation" className="text-xs font-semibold text-primary block">
                        Recomendación *
                      </label>
                      <select
                        id="recommendation"
                        value={recommendation}
                        onChange={e => setRecommendation(e.target.value as EvaluationDecisionType)}
                        className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md text-xs"
                      >
                        {RECOMMENDATIONS.map(r => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <label htmlFor="eval-comments" className="text-xs font-semibold text-primary block">
                        Fundamentación Cualitativa del Dictamen *
                      </label>
                      <textarea
                        id="eval-comments"
                        rows={3}
                        value={evaluationComments}
                        onChange={e => setEvaluationComments(e.target.value)}
                        placeholder="Ingrese los argumentos técnicos y éticos del dictamen..."
                        className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs leading-relaxed"
                      />
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <Button type="button" variant="primary" isLoading={isSubmitting} onClick={handleEmitDictamen} className="w-full shadow-md" icon={<Send className="w-4 h-4" />}>
                        Emitir Dictamen Vinculante
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => setIsConflictModalOpen(true)} className="w-full" icon={<ShieldAlert className="w-4 h-4" />}>
                        Declarar Conflicto de Interés
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        title="Declaración Formal de Conflicto de Interés (BR-011)"
        description="Inhibición ética conforme al Código de Buenas Prácticas Científicas"
        footer={
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsConflictModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={handleDeclareConflict}>
              Confirmar Inhibición y Reasignar
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>Al declarar conflicto de interés, usted se inhibe formalmente de evaluar esta propuesta debido a parentesco, coautoría reciente o relación departamental.</p>
          <div className="space-y-1.5">
            <label className="font-semibold text-primary block">Motivo justificado de la inhibición *</label>
            <textarea
              rows={3}
              value={conflictReason}
              onChange={e => setConflictReason(e.target.value)}
              placeholder="Indique la causal ética de inhibición..."
              className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
