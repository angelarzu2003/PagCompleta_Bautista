import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../api/client';
import { Project, ProjectDocument, ProjectDocumentType } from '../../types/domain';
import { formatFileSize, formatDateTime } from '../../utils/formatters';
import { validateUploadFileName } from '../../utils/security';
import { getProjectIdFromHash, rememberProject } from '../../utils/routing';
import { useAuth } from '../../context/AuthContext';
import { Files, Upload, AlertTriangle, Download, Ban, Search, Lock } from 'lucide-react';

const MAX_MB = Number(import.meta.env?.VITE_MAX_FILE_SIZE_MB) || 25;

const TYPE_LABELS: Record<string, string> = {
  proposal: 'Propuesta',
  technical_report: 'Informe técnico',
  evidence: 'Evidencia',
  final_report: 'Informe final',
  agreement: 'Convenio',
  other: 'Otro',
};

export const ProjectDocumentsView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Modal de Carga de Archivo (FR-025, FR-026)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<ProjectDocumentType>('technical_report');
  const [uploadChangeNote, setUploadChangeNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Modal de Obsoleto (FR-029: Prohibido borrar, solo marcar obsoleto con motivo)
  const [isObsoleteModalOpen, setIsObsoleteModalOpen] = useState(false);
  const [targetDoc, setTargetDoc] = useState<ProjectDocument | null>(null);
  const [obsoleteReason, setObsoleteReason] = useState('');

  useEffect(() => {
    async function loadDocs() {
      try {
        setLoadError(null);
        let id = getProjectIdFromHash();
        if (!id) {
          const list = await api.getProjects();
          if (!list.length) throw new Error('No tiene expedientes de proyecto asignados.');
          window.location.hash = `#/proyectos/${list[0].id}/documentos`;
          id = list[0].id;
        }
        const [p, docs] = await Promise.all([api.getProjectById(id), api.getDocuments(id)]);
        rememberProject(p.id);
        setProject(p);
        setDocuments(docs);
      } catch (err: any) {
        setLoadError(err.message);
      }
    }
    loadDocs();
    window.addEventListener('hashchange', loadDocs);
    return () => window.removeEventListener('hashchange', loadDocs);
  }, [activeRole]);

  const isPI = Boolean(project && user && project.pi_user_id === user.id);
  const isTeam = isPI || Boolean(project?.members?.some(m => m.user_id === user?.id && !m.left_at));
  const readOnly = !project || ['Closed', 'Cancelled', 'Rejected'].includes(project.status);
  const canUpload = !readOnly && (isTeam || activeRole === 'research_coordinator');
  const canObsolete = isPI || activeRole === 'research_coordinator';

  const handleDownload = async (versionId: string, name: string) => {
    try {
      await api.downloadDocumentVersion(versionId, name);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUploadSubmit = async () => {
    if (!project) return;
    if (!uploadFile) {
      alert('Seleccione el archivo a cargar.');
      return;
    }
    const nameError = validateUploadFileName(uploadFile.name);
    if (nameError) {
      alert(nameError);
      return;
    }
    if (uploadFile.size > MAX_MB * 1024 * 1024) {
      alert(`El archivo excede el tamaño máximo permitido de ${MAX_MB} MB.`);
      return;
    }
    setIsUploading(true);
    try {
      const doc = await api.uploadDocument(project.id, uploadFile, uploadDocType, uploadChangeNote);
      setDocuments(prev => {
        const idx = prev.findIndex(d => d.id === doc.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = doc;
          return updated;
        }
        return [doc, ...prev];
      });
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadChangeNote('');
      const v = doc.versions[doc.versions.length - 1];
      alert(`Documento versionado exitosamente (v${v.version_no}).\nSHA-256: ${v.sha256}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleMarkObsoleteSubmit = async () => {
    if (!targetDoc) return;
    if (!obsoleteReason.trim()) {
      alert('Debe ingresar un motivo justificado para declarar obsoleto el archivo.');
      return;
    }
    try {
      const updated = await api.markDocumentObsolete(targetDoc.id, obsoleteReason);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      setIsObsoleteModalOpen(false);
      setObsoleteReason('');
      alert('Documento marcado como obsoleto. Las versiones previas se conservan inmutables.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredDocs = documents.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || d.type === selectedType;
    return matchesSearch && matchesType;
  });

  if (loadError) {
    return (
      <Card padding="p-8" className="text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <p className="text-sm text-slate-600">{loadError}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-semibold text-secondary uppercase tracking-wider">
            Expediente {project?.code || '…'} • Almacenamiento Inmutable
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight mt-1">Gestión de Documentos Versionados (FR-025..029)</h1>
          {project && (
            <a href={`#/proyectos/${project.id}`} className="text-xs text-secondary hover:underline line-clamp-1">
              ← {project.title}
            </a>
          )}
        </div>

        {/* Único botón CTA primario de la vista */}
        {canUpload ? (
          <Button type="button" variant="primary" onClick={() => setIsUploadModalOpen(true)} icon={<Upload className="w-4 h-4" />}>
            Cargar Nuevo Documento
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-surface-sunken px-3 py-1.5 rounded-lg border border-slate-200">
            <Lock className="w-3.5 h-3.5" /> {readOnly ? 'Expediente de solo lectura' : 'Solo lectura para su rol'}
          </span>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre de archivo o extensión..."
            aria-label="Buscar documentos"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
          />
        </div>
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          aria-label="Filtrar por tipo"
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
        >
          <option value="all">Todos los Tipos de Documento</option>
          <option value="proposal">Propuesta (proposal)</option>
          <option value="technical_report">Informe Técnico (technical_report)</option>
          <option value="evidence">Evidencia (evidence)</option>
          <option value="final_report">Informe Final (final_report)</option>
          <option value="agreement">Convenio (agreement)</option>
          <option value="other">Otro</option>
        </select>
      </div>

      {/* Lista de Documentos Versionados */}
      <div className="space-y-4">
        {filteredDocs.length === 0 && (
          <Card padding="p-6" className="text-center text-xs text-slate-500">
            {documents.length ? 'Ningún documento coincide con los filtros.' : 'El expediente aún no tiene documentos cargados.'}
          </Card>
        )}
        {filteredDocs.map(doc => {
          const isObsolete = doc.obsolete_reason !== null;
          const latestVersion = doc.versions[doc.versions.length - 1];

          return (
            <Card key={doc.id} padding="p-6" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isObsolete ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-secondary'}`}>
                    <Files className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm font-bold break-all ${isObsolete ? 'line-through text-slate-400' : 'text-primary'}`}>{doc.name}</h3>
                      {isObsolete && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-danger-bg text-danger-text border border-danger-border font-bold">Obsoleto (FR-029)</span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 uppercase">
                      Tipo: {TYPE_LABELS[doc.type] || doc.type} • {doc.versions.length} versión(es) registrada(s)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => latestVersion && handleDownload(latestVersion.id, doc.name)}
                    icon={<Download className="w-3.5 h-3.5" />}
                  >
                    Descargar v{latestVersion?.version_no}
                  </Button>

                  {/* Prohibido borrar; solo marcar como obsoleto */}
                  {!isObsolete && canObsolete && !readOnly && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setTargetDoc(doc);
                        setIsObsoleteModalOpen(true);
                      }}
                      icon={<Ban className="w-3.5 h-3.5" />}
                    >
                      Marcar Obsoleto
                    </Button>
                  )}
                </div>
              </div>

              {isObsolete && (
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg text-xs text-red-900">
                  <strong>Motivo de Obsolescencia:</strong> {doc.obsolete_reason}
                </div>
              )}

              {/* Historial de Versiones Inmutables */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase tracking-wider block">Historial Inmutable de Versiones (FR-026):</span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-surface-sunken/40">
                  {doc.versions.map(v => (
                    <div key={v.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-secondary">Versión {v.version_no}.0</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{formatFileSize(v.size_bytes)}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 font-medium">{v.author_name}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 italic">"{v.change_note}"</p>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <span className="font-mono text-[11px] text-slate-400 block tabular-nums">{formatDateTime(v.created_at)}</span>
                          <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[200px]" title={v.sha256}>
                            SHA-256: {v.sha256.substring(0, 16)}...
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownload(v.id, doc.name)}
                          className="p-1.5 rounded-md text-secondary hover:bg-blue-50"
                          title={`Descargar versión ${v.version_no}`}
                          aria-label={`Descargar versión ${v.version_no}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal de Carga de Archivo (FR-025) */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Subir y Versionar Archivo"
        description={`Límite: ${MAX_MB} MB por archivo. Formatos permitidos: PDF, DOCX, XLSX, PPTX, PNG, JPG, CSV, TXT (FR-025).`}
        footer={
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" isLoading={isUploading} disabled={!uploadFile} onClick={handleUploadSubmit}>
              Cargar y Generar Hash SHA-256
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label htmlFor="upload-file" className="font-semibold text-primary block">
              Archivo *
            </label>
            <input
              id="upload-file"
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.csv,.txt"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md file:mr-3 file:px-3 file:py-1 file:rounded-md file:border-0 file:bg-secondary file:text-white file:text-xs"
            />
            {uploadFile && (
              <span className="text-[11px] text-slate-600 block font-mono break-all">
                {uploadFile.name} · {formatFileSize(uploadFile.size)}
              </span>
            )}
            <span className="text-[11px] text-slate-400 block">
              Si el nombre coincide con un archivo existente, el sistema creará automáticamente la versión siguiente (v+1) sin sobrescribir.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-primary block">Clasificación Obligatoria *</label>
            <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value as any)} className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md">
              <option value="technical_report">Informe Técnico (technical_report)</option>
              <option value="evidence">Evidencia Probatoria (evidence)</option>
              <option value="proposal">Propuesta Completa (proposal)</option>
              <option value="final_report">Informe Final de Liquidación (final_report)</option>
              <option value="agreement">Convenio de Cooperación (agreement)</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-primary block">Nota de Cambio Obligatoria (FR-026) *</label>
            <textarea
              rows={2}
              value={uploadChangeNote}
              onChange={e => setUploadChangeNote(e.target.value)}
              placeholder="Describa el motivo de la carga o las modificaciones respecto a la versión anterior..."
              className="w-full p-2 bg-surface-sunken border border-slate-200 rounded-md"
            />
          </div>
        </div>
      </Modal>

      {/* Modal para Marcar como Obsoleto (FR-029) */}
      <Modal
        isOpen={isObsoleteModalOpen}
        onClose={() => setIsObsoleteModalOpen(false)}
        title="Declarar Documento como Obsoleto (FR-029)"
        description="Regla de Inmutabilidad: El archivo no se elimina del almacenamiento seguro."
        footer={
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsObsoleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={handleMarkObsoleteSubmit}>
              Confirmar Obsolescencia
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            Por normatividad institucional, queda estrictamente prohibido eliminar versiones de documentos. El archivo <strong>{targetDoc?.name}</strong> será marcado como
            obsoleto pero permanecerá auditable en el histórico.
          </p>
          <div className="space-y-1.5">
            <label className="font-semibold text-primary block">Motivo justificado de la obsolescencia *</label>
            <textarea
              rows={3}
              value={obsoleteReason}
              onChange={e => setObsoleteReason(e.target.value)}
              placeholder="Ej. Reemplazado por directiva rectoral o versión corregida del proveedor..."
              className="w-full p-2.5 bg-surface-sunken border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
