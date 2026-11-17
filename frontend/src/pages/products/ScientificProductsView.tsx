import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { Project, ResearchProduct, ResearchProductType } from '../../types/domain';
import { api } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { safeExternalUrl } from '../../utils/security';
import {
  Award,
  CheckCircle2,
  Clock,
  BookOpen,
  FileCheck,
  Upload,
  ExternalLink,
  ShieldAlert,
  Send,
  FileText
} from 'lucide-react';

export const ScientificProductsView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [products, setProducts] = useState<ResearchProduct[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Formulario del Investigador
  const [projectId, setProjectId] = useState('');
  const [productType, setProductType] = useState<ResearchProductType>('journal_article');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState(user?.full_name || '');
  const [venue, setVenue] = useState('');
  const [doi, setDoi] = useState('');
  const [productDate, setProductDate] = useState(new Date().toISOString().slice(0, 10));
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCoordinator = activeRole === 'research_coordinator';
  const canRegister = activeRole === 'researcher' || activeRole === 'student_researcher';

  useEffect(() => {
    setError(null);
    api.getProducts().then(setProducts).catch(err => setError(err.message));
    if (canRegister) {
      api
        .getProjects()
        .then(list => {
          const eligible = list.filter(p => !['Closed', 'Cancelled', 'Rejected', 'Draft'].includes(p.status));
          setProjects(eligible);
          setProjectId(prev => prev || eligible[0]?.id || '');
        })
        .catch(() => undefined);
    }
  }, [activeRole]);

  const handleValidateProduct = async (prodId: string) => {
    if (!isCoordinator) {
      alert('Solo la Coordinación de Investigación tiene privilegios de validación oficial (BR-013).');
      return;
    }
    try {
      const validated = await api.validateProduct(prodId);
      setProducts(prev => prev.map(p => (p.id === validated.id ? validated : p)));
      alert('Producto científico validado formalmente para cómputo de indicadores institucionales (BR-013).');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      alert('Seleccione el proyecto al que pertenece el producto.');
      return;
    }
    if (!title.trim()) {
      alert('El título de la publicación o patente es obligatorio.');
      return;
    }
    if (doi.trim() && /^[a-z][a-z0-9+.-]*:/i.test(doi.trim()) && !safeExternalUrl(doi)) {
      alert('El enlace debe ser una URL http(s) o un DOI válido (ej. 10.1109/JIOT.2025.318942).');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await api.createProduct(
        { project_id: projectId, type: productType, title, authors, venue, doi_or_url: doi.trim() || null, status: 'submitted', product_date: productDate },
        evidenceFile
      );
      setProducts(prev => [created, ...prev]);
      setTitle('');
      setVenue('');
      setDoi('');
      setEvidenceFile(null);
      alert('Producto registrado exitosamente y enviado a la bandeja de validación de Coordinación.');
    } catch (err: any) {
      alert(err.fields?.[0]?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validatedCount = products.filter(p => p.validated_at !== null).length;
  const articles = products.filter(p => p.type === 'journal_article');
  const validatedArticles = articles.filter(p => p.validated_at !== null).length;
  const patents = products.filter(p => p.type === 'patent');

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Encabezado Institucional y Chips */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="font-bold text-secondary">{user?.full_name}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">{products.length} productos visibles para su rol</span>
            {user?.masked_national_id && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">DNI: {user.masked_national_id}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">
            Registro y Validación de Productos Científicos (V05)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Trazabilidad y verificación de artículos indexados, patentes y transferencia tecnológica institucional.
          </p>
        </div>
      </div>

      {/* TIRA ANALÍTICA DE 4 TARJETAS KPI (Límite de Densidad BASE.md 3.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card padding="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Productos Validados
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tabular-nums">
              {validatedCount}
            </span>
            <span className="text-xs text-emerald-600 font-medium block mt-1">
              Conformes ante DGI (BR-013)
            </span>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              En Revisión DGI
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tabular-nums">
              {products.filter(p => p.validated_at === null).length}
            </span>
            <span className="text-xs text-amber-700 font-medium block mt-1">
              Pendientes de dictamen
            </span>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Artículos Scopus/WoS
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-secondary flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tabular-nums">
              {validatedArticles} / {articles.length}
            </span>
            <span className="text-xs text-slate-500 font-medium block mt-1">
              Artículos validados / registrados
            </span>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Patentes / Modelos
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tabular-nums">
              {patents.length}
            </span>
            <span className="text-xs text-slate-500 font-medium block mt-1">
              {patents.filter(p => p.validated_at).length} validada(s) · trámite INDECOPI
            </span>
          </div>
        </Card>
      </div>

      {/* LAYOUT DE 2 COLUMNAS (Grid gap-8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUMNA IZQUIERDA: Bandeja de Validación de Coordinación (7 cols) */}
        <div className={`${canRegister ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold text-primary">
                Bandeja de Validación de la Coordinación (BR-013)
              </h2>
              <p className="text-xs text-slate-500">
                Solo los productos validados se computan en estadísticas institucionales.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-secondary bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              {products.length} Productos
            </span>
          </div>

          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
          <div className="space-y-4">
            {products.length === 0 && !error && (
              <Card padding="p-6" className="text-center text-xs text-slate-500">No hay productos registrados.</Card>
            )}
            {products.map(prod => {
              const isValidated = prod.validated_at !== null;
              return (
                <Card key={prod.id} padding="p-6" className="space-y-3 border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {prod.type.replace('_', ' ')}
                    </span>
                    {isValidated ? (
                      <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Validado por {prod.validator_name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-medium">
                        Pendiente de Validación
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-primary leading-snug">{prod.title}</h3>
                  <p className="text-xs text-slate-500">{prod.authors}</p>
                  <p className="text-xs text-slate-600 font-medium">Revista / Editorial: {prod.venue}</p>

                  {prod.doi_or_url &&
                    (safeExternalUrl(prod.doi_or_url) ? (
                      <a
                        href={safeExternalUrl(prod.doi_or_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-secondary hover:underline inline-flex items-center gap-1 break-all"
                      >
                        {prod.doi_or_url} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      // Referencias que no son URL http(s) (o URLs peligrosas) se muestran como texto plano.
                      <span className="text-xs text-slate-500 break-all">{prod.doi_or_url}</span>
                    ))}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">
                      {prod.project_code} · {formatDate(prod.product_date)}
                      {prod.evidence_filename ? ` · 📎 ${prod.evidence_filename}` : ''}
                    </span>

                    {/* Acción de Coordinación */}
                    {isCoordinator && !isValidated && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleValidateProduct(prod.id)}
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      >
                        Aprobar y Validar
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* COLUMNA DERECHA: Formulario de Registro del Investigador (5 cols) */}
        {canRegister && (
        <div className="lg:col-span-5 space-y-4">
          <Card padding="p-6">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-primary">
                Registrar Nuevo Producto
              </h2>
              <p className="text-xs text-slate-500">
                Ingrese los metadatos y adjunte la carta de aceptación probatoria (FR-031).
              </p>
            </div>

            <form onSubmit={handleRegisterProduct} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-primary block">Proyecto *</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                >
                  {projects.length === 0 && <option value="">No tiene proyectos activos</option>}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.title.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary block">Tipo de Producto Científico *</label>
                <select
                  value={productType}
                  onChange={e => setProductType(e.target.value as any)}
                  className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                >
                  <option value="journal_article">Artículo de Revista (Journal Q1/Q2)</option>
                  <option value="conference_paper">Ponencia en Congreso Internacional</option>
                  <option value="book">Libro con Arbitraje Editorial</option>
                  <option value="book_chapter">Capítulo de Libro</option>
                  <option value="thesis">Tesis de Grado / Posgrado</option>
                  <option value="patent">Patente de Invención / Modelo</option>
                  <option value="software">Software / Paquete de Algoritmos</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary block">Título de la Publicación o Patente *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej. Algoritmo de Calibración Térmica..."
                  className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary block">Autores Registrados</label>
                <input
                  type="text"
                  value={authors}
                  onChange={e => setAuthors(e.target.value)}
                  className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary block">Revista, Editorial o Congreso</label>
                <input
                  type="text"
                  value={venue}
                  onChange={e => setVenue(e.target.value)}
                  placeholder="Ej. Nature Communications / IEEE"
                  className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary block">Fecha del Producto</label>
                <input
                  type="date"
                  value={productDate}
                  onChange={e => setProductDate(e.target.value)}
                  className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary block">DOI o Enlace URL de Verificación</label>
                <input
                  type="text"
                  value={doi}
                  onChange={e => setDoi(e.target.value)}
                  placeholder="https://doi.org/10.1109/..."
                  className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>

              {/* Zona de Carga de Evidencia Probatoria (FR-031) */}
              <div className="space-y-1.5 pt-1">
                <label className="font-semibold text-primary block">Archivo Probatorio (≤ 25 MB, opcional)</label>
                <label
                  className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    evidenceFile
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-slate-300 hover:border-secondary bg-surface-sunken'
                  }`}
                >
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                    onChange={e => setEvidenceFile(e.target.files?.[0] || null)}
                  />
                  {evidenceFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-800 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="break-all">{evidenceFile.name} ({(evidenceFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-500">
                      <Upload className="w-5 h-5 mx-auto text-slate-400" />
                      <p className="font-medium">Clic para adjuntar carta de aceptación o certificado</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Único botón primario del formulario si no es coordinador */}
              {canRegister && (
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="w-full mt-4"
                  icon={<Send className="w-4 h-4" />}
                >
                  Enviar Producto a Validación
                </Button>
              )}
            </form>
          </Card>
        </div>
        )}
      </div>
    </div>
  );
};
