import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TechDetails } from '../../components/ui/TechDetails';
import { api } from '../../api/client';
import { AIInteraction, RegulationDocument } from '../../types/domain';
import { formatDate } from '../../utils/formatters';
import {
  BookOpen,
  Sparkles,
  Send,
  ThumbsUp,
  ThumbsDown,
  Upload,
  Trash2,
  FileText,
  AlertCircle,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';

export const NormativeAssistantView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'corpus'>('chat');
  const [question, setQuestion] = useState('');
  const [interactions, setInteractions] = useState<AIInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Gestión de Corpus (AIR-004, FR-045 - Coordinación)
  const [regulations, setRegulations] = useState<(RegulationDocument & { section_count?: number })[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRegTitle, setNewRegTitle] = useState('');
  const [newRegVersion, setNewRegVersion] = useState('');
  const [newRegDate, setNewRegDate] = useState(new Date().toISOString().slice(0, 10));
  const [newRegContent, setNewRegContent] = useState('');

  const isCoordinator = activeRole === 'research_coordinator';
  const charCount = question.length;
  const isOverCharLimit = charCount > 1000;

  useEffect(() => {
    api.getRegulations().then(setRegulations).catch(() => undefined);
    // Historial propio de consultas (retención 12 meses, AIR-007)
    api
      .getAIInteractions()
      .then(list => setInteractions([...list].reverse()))
      .catch(() => undefined);
  }, [activeRole]);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isOverCharLimit || isLoading) return;
    try {
      setIsLoading(true);
      const res = await api.askNormativeAssistant(question);
      setInteractions(prev => [res, ...prev]);
      setQuestion('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateInteraction = async (id: string, isHelpful: boolean) => {
    try {
      const updated = await api.rateAIInteraction(id, isHelpful);
      setInteractions(prev => prev.map(item => (item.id === id ? updated : item)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetireRegulation = async (id: string) => {
    if (!isCoordinator) {
      alert('Acceso restringido: Solo la Coordinación puede retirar normas del corpus (AIR-004).');
      return;
    }
    if (!confirm('¿Retirar esta norma del corpus? Dejará de usarse en las respuestas del asistente de inmediato.')) return;
    try {
      const updated = await api.retireRegulation(id);
      setRegulations(prev => prev.map(r => (r.id === id ? { ...r, ...updated } : r)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRegFile = async (file: File | null) => {
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) {
      alert('Cargue el texto de la norma en formato .txt (un artículo por párrafo).');
      return;
    }
    setNewRegContent(await file.text());
    if (!newRegTitle) setNewRegTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const handleAddRegulation = async () => {
    if (!newRegTitle.trim() || !newRegVersion.trim()) {
      alert('Debe completar el título y versión de la directiva.');
      return;
    }
    if (newRegContent.trim().length < 40) {
      alert('Pegue o cargue el texto de la norma: cada artículo en un párrafo separado por una línea en blanco.');
      return;
    }
    try {
      const created = await api.createRegulation({ title: newRegTitle, version: newRegVersion, effective_date: newRegDate, content: newRegContent });
      setRegulations(prev => [created, ...prev]);
      setIsAddModalOpen(false);
      setNewRegTitle('');
      setNewRegVersion('');
      setNewRegContent('');
      alert(`Directiva indexada en el corpus con ${(created as any).section_count} fragmento(s). Ya está disponible para el asistente.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-semibold text-secondary uppercase tracking-wider">
            Inteligencia Artificial Responsable (AIR-001..014) • RAG Normativo
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">
            Asistente Normativo y Base de Conocimientos
          </h1>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'chat'
                ? 'bg-white text-secondary shadow-xs'
                : 'text-slate-500 hover:text-primary'
            }`}
          >
            Consulta Normativa IA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('corpus')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'corpus'
                ? 'bg-white text-secondary shadow-xs'
                : 'text-slate-500 hover:text-primary'
            }`}
          >
            Gestión de Corpus {isCoordinator && '(Coordinación)'}
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: Chat de Consulta Normativa RAG (AIR-001 a AIR-006, UC-011) */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Principal de Interacción (7 columnas) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Formulario de Pregunta */}
            <Card padding="p-6">
              <form onSubmit={handleAskQuestion} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-question" className="text-xs font-bold text-primary flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-secondary" />
                    Pregunte sobre reglamentos, plazos de ejecución o directivas de fondos:
                  </label>
                  {/* Contador reactivo de 1,000 caracteres (AIR-001) */}
                  <span
                    className={`font-mono text-[11px] font-semibold tabular-nums ${
                      isOverCharLimit ? 'text-danger-action' : 'text-slate-400'
                    }`}
                  >
                    {charCount} / 1,000 caracteres
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    id="input-question"
                    rows={3}
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ej. ¿Cuál es el procedimiento y plazo para solicitar una redistribución presupuestal entre fases?"
                    className={`w-full p-3.5 bg-surface-sunken border rounded-xl text-xs text-primary focus:bg-white focus:outline-none focus:ring-2 leading-relaxed ${
                      isOverCharLimit
                        ? 'border-danger-border focus:ring-danger-action/30'
                        : 'border-slate-200 focus:ring-secondary/20 focus:border-secondary'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Solo responde en base al corpus oficial de directivas activas.
                  </span>
                  {/* Único botón CTA primario de esta sección */}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!question.trim() || isOverCharLimit || isLoading}
                    isLoading={isLoading}
                    icon={<Send className="w-4 h-4" />}
                  >
                    Consultar Asistente
                  </Button>
                </div>
              </form>
            </Card>

            {/* Historial de Respuestas Generadas con Citas Exactas */}
            <div className="space-y-4">
              {interactions.length === 0 ? (
                <div className="py-12 px-4 text-center bg-white rounded-card border border-slate-200 text-slate-400 text-xs">
                  Ingrese una consulta arriba para obtener respuestas con citas verificables del reglamento.
                </div>
              ) : (
                interactions.map(item => (
                  <Card key={item.id} padding="p-6" className="space-y-4 border border-secondary/20">
                    {/* Pregunta del Usuario */}
                    <div className="text-xs font-semibold text-slate-800 bg-surface-sunken p-3 rounded-lg border border-slate-200">
                      <strong>Pregunta:</strong> {item.allowed_question}
                    </div>

                    {/* Badge AI-Assistant y Respuesta */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-secondary text-white">
                          AI-Assistant (RAG)
                        </span>
                        {/* REGLA CRÍTICA AIR-005: Prohibido mostrar porcentajes de certeza jurídica */}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-secondary border border-blue-200 font-semibold">
                          Orientación no vinculante
                        </span>
                      </div>

                      {(item.is_not_found_fallback || item.is_out_of_scope_declined) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                          <AlertCircle className="w-3 h-3" />
                          {item.is_out_of_scope_declined ? 'Fuera de alcance (AIR-013)' : 'Sin pasaje relevante (AIR-003)'}
                        </span>
                      )}
                      <p className="text-xs text-primary leading-relaxed">
                        {item.answer}
                      </p>

                      {/* Citas Verificables (AIR-002) */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">
                          Citas Reglamentarias Exactas:
                        </span>
                        {item.source_refs.length === 0 && <p className="text-[11px] text-slate-400">Sin citas: no se recuperó ningún pasaje normativo.</p>}
                        {item.source_refs.map((src, i) => (
                          <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                            <span className="font-bold text-secondary">{src.document_title}</span>
                            <span className="text-slate-500 block text-[11px] mt-0.5">
                              {src.section} • Página {src.page} • Versión {src.version}
                            </span>
                            {src.excerpt && (
                              <p className="text-[11px] text-slate-600 italic mt-1 bg-white p-2 rounded border border-slate-100">
                                "{src.excerpt}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Aviso Obligatorio no vinculante (AIR-005) */}
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed">
                        {item.advisory_disclaimer}
                      </div>

                      {/* Calificación de Respuesta (AIR-006) */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                        <span>¿Le resultó útil esta orientación?</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRateInteraction(item.id, true)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              item.rating === true
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                                : 'hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRateInteraction(item.id, false)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              item.rating === false
                                ? 'bg-red-50 text-red-700 border-red-300 font-bold'
                                : 'hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Columna Lateral de Normas Indexadas (5 columnas) */}
          <div className="lg:col-span-4 space-y-4">
            <Card padding="p-6" className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Reglamentos Activos en el Corpus
              </h3>
              <p className="text-[11px] text-slate-500">
                Documentos aprobados oficialmente contra los que el modelo RAG realiza búsqueda semántica.
              </p>
              <div className="divide-y divide-slate-100 pt-1">
                {regulations.filter(r => r.status === 'active').map(r => (
                  <div key={r.id} className="py-2.5 text-xs">
                    <span className="font-semibold text-primary block leading-snug">{r.title}</span>
                    <span className="font-mono text-[10px] text-secondary">
                      Versión {r.version} • Vigente desde {formatDate(r.effective_date)}
                      {r.section_count !== undefined && ` • ${r.section_count} artículos`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: Gestión de Corpus y Directivas (FR-045, AIR-004) */}
      {activeTab === 'corpus' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-primary">
                Inventario de Normas y Directivas del Corpus RAG (FR-045)
              </h2>
              <p className="text-xs text-slate-500">
                Regla AIR-004: Ingesta, actualización y retiro de reglamentos vectorizados (Disponible/retirado en ≤ 30 min).
              </p>
            </div>

            {isCoordinator && (
              <Button
                type="button"
                variant="primary"
                onClick={() => setIsAddModalOpen(true)}
                icon={<Upload className="w-4 h-4" />}
              >
                Cargar Nueva Directiva
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {regulations.map(reg => {
              const isActive = reg.status === 'active';
              return (
                <Card key={reg.id} padding="p-6" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">{reg.title}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isActive ? 'Activo en Búsquedas' : 'Retirado del Índice'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                      Versión: {reg.version} • Vigencia: {formatDate(reg.effective_date)}
                      {reg.section_count !== undefined && ` • ${reg.section_count} fragmentos indexados`}
                    </p>
                  </div>

                  {isCoordinator && isActive && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleRetireRegulation(reg.id)}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Retirar del Corpus
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal para Agregar Documento Normativo */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Cargar Nueva Directiva Oficial al Corpus RAG"
        description="FR-045 / AIR-004: El texto se divide en artículos y se indexa para la búsqueda del asistente."
        footer={
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleAddRegulation}
            >
              Indexar Directiva
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-primary block">Título del Documento *</label>
            <input
              type="text"
              value={newRegTitle}
              onChange={e => setNewRegTitle(e.target.value)}
              placeholder="Ej. Directiva de Propiedad Intelectual 2026..."
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-primary block">Versión Oficial *</label>
            <input
              type="text"
              value={newRegVersion}
              onChange={e => setNewRegVersion(e.target.value)}
              placeholder="Ej. v1.0-2026"
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-primary block">Vigente desde</label>
            <input
              type="date"
              value={newRegDate}
              onChange={e => setNewRegDate(e.target.value)}
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-primary block">Texto de la norma * (un artículo por párrafo)</label>
            <textarea
              rows={7}
              value={newRegContent}
              onChange={e => setNewRegContent(e.target.value)}
              placeholder={'Artículo 1 (Objeto): La presente directiva regula...\n\nArtículo 2 (Alcance): ...'}
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md font-mono text-[11px]"
            />
            <input type="file" accept=".txt,.md" onChange={e => handleRegFile(e.target.files?.[0] || null)} className="text-[11px]" />
          </div>
        </div>
      </Modal>
    </div>
  );
};
