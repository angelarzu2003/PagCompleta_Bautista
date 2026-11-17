import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { all, get, run, transaction, toJson, fromJson } from '../db.js';
import { requireAuth, requirePermission } from '../auth.js';
import {
  errors, audit, notify, newId, nowIso, sha256, cleanText, isSafeLink, hasPermission,
  validateUploadFileName, contentMatchesExtension, MIME_BY_EXT,
} from '../lib.js';
import {
  loadProject, serializeProject, listProjects, listActivities, serializeDocument, serializeProduct,
  PRODUCT_SELECT, serializeAssignment, isOwner, isTeam, canRead, currentVersion, serializeDeliverable, userName,
} from '../repo.js';
import { precheck, summarizeProject } from '../ai.js';

export const router = express.Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes + 1, files: 1 } });
const singleFile = field => (req, res, next) =>
  upload.single(field)(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(errors.tooLarge(`El archivo excede el tamaño máximo permitido de ${config.maxUploadBytes / 1024 / 1024} MB.`));
    next(errors.invalid(`Error en la carga del archivo: ${err.message}`));
  });

const coordinators = () => all(`SELECT id FROM users WHERE active = 1 AND roles LIKE '%"research_coordinator"%'`).map(r => r.id);

function fixName(name) {
  // multer entrega el nombre en latin1; se reinterpreta como UTF-8 si es válido
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return utf8.includes('�') ? name : utf8;
}

// ===========================================================================
// PROYECTOS
// ===========================================================================
router.get('/projects', (req, res) => {
  res.json(listProjects(req.session));
});

router.get('/projects/:id', (req, res) => {
  res.json(serializeProject(loadProject(req.session, req.params.id), req.session));
});

function nextProjectCode(deptId, year) {
  const prefix = { 'dept-ingenieria': 'ING', 'dept-salud': 'SAL', 'dept-empresas': 'ECO', 'dept-humanidades': 'EDU' }[deptId] || 'GEN';
  const n = get('SELECT COUNT(*) AS n FROM projects WHERE code LIKE ?', [`PID-${year}-%`]).n + 1;
  let code;
  let i = n;
  do {
    code = `PID-${year}-${prefix}-${String(i).padStart(3, '0')}`;
    i++;
  } while (get('SELECT 1 AS x FROM projects WHERE code = ?', [code]));
  return code;
}

function validateProjectInput(d, { partial = false } = {}) {
  const fields = [];
  const need = (cond, field, message) => !cond && fields.push({ field, message });
  if (!partial || d.title !== undefined) need(cleanText(d.title).length >= 10, 'title', 'El título es obligatorio (mínimo 10 caracteres).');
  if (!partial || d.start_date !== undefined) need(/^\d{4}-\d{2}-\d{2}$/.test(d.start_date || ''), 'start_date', 'La fecha de inicio es obligatoria (AAAA-MM-DD).');
  if (!partial || d.end_date !== undefined) need(/^\d{4}-\d{2}-\d{2}$/.test(d.end_date || ''), 'end_date', 'La fecha de término es obligatoria (AAAA-MM-DD).');
  if (d.start_date && d.end_date && d.end_date < d.start_date) fields.push({ field: 'end_date', message: 'La fecha de término debe ser posterior o igual a la de inicio.' });
  if (d.requested_funding !== undefined && !(Number(d.requested_funding) >= 0)) fields.push({ field: 'requested_funding', message: 'El monto solicitado debe ser un número mayor o igual a 0.' });
  for (const [key, type] of [['department_id', 'departments'], ['area_id', 'research_areas'], ['line_id', 'research_lines'], ['type_id', 'project_types']]) {
    if ((!partial || d[key] !== undefined) && !get('SELECT 1 AS x FROM catalog_items WHERE id = ? AND catalog_type = ? AND active = 1', [d[key], type])) {
      fields.push({ field: key, message: 'Seleccione un valor válido del catálogo institucional.' });
    }
  }
  if (fields.length) throw errors.invalid('Error de validación en el formulario.', fields);
}

function normalizeBudget(raw, total) {
  if (!Array.isArray(raw) || !raw.length) {
    return [40, 40, 20].map((pct, i) => ({
      phase_number: i + 1,
      name: ['Anticipo Fase I', 'Hito Intermedio Fase II', 'Hito Final Fase III'][i],
      percentage: pct,
      amount_pen: Math.round(total * pct) / 100,
    }));
  }
  return raw.slice(0, 3).map((p, i) => ({
    phase_number: i + 1,
    name: cleanText(p.name, 200) || `Fase ${i + 1}`,
    percentage: Number(p.percentage) || 0,
    amount_pen: Number(p.amount_pen) || 0,
    amount_usd: p.amount_usd !== undefined ? Number(p.amount_usd) : undefined,
  }));
}

function saveVersion(projectId, v, userId) {
  const prev = get('SELECT MAX(version_no) AS n FROM project_versions WHERE project_id = ?', [projectId]);
  const no = (prev?.n || 0) + 1;
  const specific = (v.specific_objectives || [])
    .map(o => cleanText(typeof o === 'string' ? o : o.description, 1000))
    .filter(Boolean)
    .map((d, i) => ({ id: `OE${i + 1}`, order: i + 1, description: d }));
  run(
    `INSERT INTO project_versions (id, project_id, version_no, summary, general_objective, specific_objectives, objectives, justification, methodology, funding_source, created_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [newId('ver'), projectId, no, cleanText(v.summary, 6000), cleanText(v.general_objective, 1000), toJson(specific),
      cleanText(v.objectives || v.general_objective || specific.map(s => s.description).join(' '), 3000),
      cleanText(v.justification, 4000), cleanText(v.methodology, 6000), cleanText(v.funding_source, 300) || null, nowIso(), userId]
  );
  return no;
}

router.post('/projects', requirePermission('create_project'), (req, res) => {
  const d = req.body || {};
  validateProjectInput(d);
  const s = req.session;
  const id = newId('proj');
  const year = new Date().getFullYear();
  const total = Number(d.requested_funding) || 0;
  const status = d.submit === false ? 'Draft' : 'Draft';
  const now = nowIso();

  transaction(() => {
    const code = nextProjectCode(d.department_id, year);
    const seq = get('SELECT COUNT(*) AS n FROM projects').n + 100;
    run(
      `INSERT INTO projects (id, code, anonymous_code, title, pi_user_id, department_id, area_id, line_id, type_id, status, confidential,
        start_date, end_date, requested_funding, overall_progress, row_version, budget_breakdown, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?,?,?)`,
      [id, code, `#PROP-${year}-${seq}-ANON`, cleanText(d.title, 400), s.userId, d.department_id, d.area_id, d.line_id, d.type_id, status,
        Boolean(d.confidential), d.start_date, d.end_date, total, toJson(normalizeBudget(d.budget_breakdown, total)), now, now]
    );
    const v = d.current_version || d;
    saveVersion(id, v, s.userId);
    run('INSERT INTO status_history (id, project_id, actor_id, from_status, to_status, justification, evaluation_id, created_at) VALUES (?,?,?,?,?,?,NULL,?)',
      [newId('hist'), id, s.userId, null, 'Draft', 'Registro inicial de la propuesta.', now]);
    audit(s, 'PROJECT_CREATED', 'project', id, { code, title: cleanText(d.title, 120), confidential: Boolean(d.confidential) });
  });

  let project = loadProject(s, id);
  if (d.submit) {
    project = doTransition(s, project, 'Submitted', 'Envío formal de la propuesta a la convocatoria.', project.row_version);
  }
  res.status(201).json(serializeProject(project, s));
});

router.patch('/projects/:id', (req, res) => {
  const s = req.session;
  const p = loadProject(s, req.params.id);
  if (!isOwner(s, p)) throw errors.forbidden('Solo el Investigador Principal puede modificar el expediente.');
  if (!['Draft', 'Changes requested'].includes(p.status)) {
    throw errors.invalid(`El expediente está en estado "${p.status}" y no admite edición directa. Use una solicitud de modificación (FR-012).`);
  }
  const expected = Number(req.get('If-Match') ?? req.body?.row_version);
  if (!Number.isFinite(expected)) throw errors.invalid('Debe enviar la versión esperada del registro (row_version / If-Match).');
  if (p.row_version !== expected) {
    throw errors.conflict(`Conflicto de concurrencia: el expediente ha sido modificado por otro usuario (versión actual: ${p.row_version}, esperada: ${expected}). Por favor recargue la página.`);
  }
  // Lista blanca de campos editables (evita mass assignment)
  const d = req.body || {};
  const editable = ['title', 'department_id', 'area_id', 'line_id', 'type_id', 'confidential', 'start_date', 'end_date', 'requested_funding', 'budget_breakdown'];
  const updates = Object.fromEntries(Object.entries(d).filter(([k]) => editable.includes(k)));
  validateProjectInput({ start_date: p.start_date, end_date: p.end_date, ...updates }, { partial: true });

  transaction(() => {
    const merged = { ...p, ...updates };
    const changed = run(
      `UPDATE projects SET title = ?, department_id = ?, area_id = ?, line_id = ?, type_id = ?, confidential = ?, start_date = ?, end_date = ?,
         requested_funding = ?, budget_breakdown = ?, row_version = row_version + 1, updated_at = ? WHERE id = ? AND row_version = ?`,
      [cleanText(merged.title, 400), merged.department_id, merged.area_id, merged.line_id, merged.type_id, Boolean(merged.confidential),
        merged.start_date, merged.end_date, Number(merged.requested_funding) || 0,
        updates.budget_breakdown ? toJson(normalizeBudget(updates.budget_breakdown, Number(merged.requested_funding))) : p.budget_breakdown,
        nowIso(), p.id, expected]
    );
    if (!changed) throw errors.conflict('Conflicto de concurrencia. Recargue el proyecto.');
    if (d.current_version) saveVersion(p.id, d.current_version, s.userId);
    audit(s, 'PROJECT_UPDATED', 'project', p.id, { fields: Object.keys(updates), new_version: Boolean(d.current_version) });
  });
  res.json(serializeProject(loadProject(s, p.id), s));
});

// ---------------------------------------------------------------------------
// Máquina de estados (FR-014, Tabla 8.2)
// ---------------------------------------------------------------------------
const TRANSITIONS = {
  Draft: { Submitted: 'pi', Cancelled: 'pi' },
  Submitted: { 'Under review': 'coord', Rejected: 'coord' },
  'Under review': { Approved: 'coord', Rejected: 'coord', 'Changes requested': 'coord' },
  'Changes requested': { 'Under review': 'pi', Cancelled: 'pi' },
  Approved: { 'In progress': 'coord' },
  'In progress': { 'Closure requested': 'pi', Suspended: 'coord' },
  Suspended: { 'In progress': 'coord', Cancelled: 'coord' },
  'Closure requested': { Closed: 'coord', 'In progress': 'coord' },
};

export function closureChecklist(projectId) {
  const finalReport = Boolean(get(`SELECT 1 AS x FROM documents WHERE project_id = ? AND type = 'final_report' AND obsolete_reason IS NULL`, [projectId]));
  const delivs = all('SELECT d.status FROM deliverables d JOIN activities a ON a.id = d.activity_id WHERE a.project_id = ?', [projectId]);
  const allResolved = delivs.every(d => ['Submitted', 'Approved', 'Cancelled'].includes(d.status));
  const products = get('SELECT COUNT(*) AS n FROM products WHERE project_id = ?', [projectId]).n > 0;
  return {
    project_id: projectId,
    final_report_uploaded: finalReport,
    all_mandatory_deliverables_resolved: allResolved,
    research_products_registered: products,
    can_approve_closure: finalReport && allResolved && products,
  };
}

function doTransition(s, p, to, justification, expectedVersion) {
  const allowed = TRANSITIONS[p.status]?.[to];
  if (!allowed) throw errors.invalid(`Transición no permitida: "${p.status}" → "${to}".`);
  if (allowed === 'pi' && !isOwner(s, p)) throw errors.forbidden('Solo el Investigador Principal puede realizar esta transición.');
  if (allowed === 'coord' && s.role !== 'research_coordinator') throw errors.forbidden('Solo la Coordinación de Investigación puede realizar esta transición.');
  if (expectedVersion !== undefined && Number(expectedVersion) !== p.row_version) {
    throw errors.conflict(`Conflicto de versión (actual: ${p.row_version}, esperada: ${expectedVersion}). Recargue el proyecto.`);
  }
  const just = cleanText(justification, 2000);
  if (allowed === 'coord' && just.length < 5) throw errors.invalid('La justificación es obligatoria para las decisiones de la Coordinación.', [{ field: 'justification', message: 'Ingrese la justificación de la decisión.' }]);
  if (to === 'Submitted' || (p.status === 'Changes requested' && to === 'Under review')) {
    const v = currentVersion(p.id);
    if (!v || (v.specific_objectives || []).length < 3) throw errors.invalid('La propuesta debe tener al menos 3 objetivos específicos antes de enviarse.');
  }
  if (p.status === 'Changes requested' && to === 'Under review') {
    const pending = get('SELECT COUNT(*) AS n FROM observations WHERE project_id = ? AND resolved = 0', [p.id]).n;
    if (pending) throw errors.invalid(`Quedan ${pending} observación(es) sin subsanar.`);
  }
  if (to === 'Closed') {
    const c = closureChecklist(p.id);
    if (!c.can_approve_closure) throw errors.invalid('No se puede aprobar el cierre: el checklist BR-006 está incompleto.');
  }

  const now = nowIso();
  transaction(() => {
    const extra = [];
    const params = [to, now];
    if (to === 'Approved' && !p.resolution_number) {
      const year = new Date().getFullYear();
      const n = get('SELECT COUNT(*) AS n FROM projects WHERE resolution_number IS NOT NULL').n + 1400;
      extra.push('resolution_number = ?', 'cvd_code = ?');
      params.push(`R.R. Nº ${n}-${year}-R-URPMP`, `URP-${String(Math.floor(1000 + Math.random() * 9000))}-${p.code.split('-')[2]}-${year}`);
    }
    const changed = run(
      `UPDATE projects SET status = ?, updated_at = ?, row_version = row_version + 1${extra.length ? ', ' + extra.join(', ') : ''} WHERE id = ? AND row_version = ?`,
      [...params, p.id, p.row_version]
    );
    if (!changed) throw errors.conflict('Conflicto de versión. Recargue el proyecto.');
    run('INSERT INTO status_history (id, project_id, actor_id, from_status, to_status, justification, evaluation_id, created_at) VALUES (?,?,?,?,?,?,NULL,?)',
      [newId('hist'), p.id, s.userId, p.status, to, just || `Cambio de estado a ${to}.`, now]);
    audit(s, 'PROJECT_STATUS_CHANGED', 'project', p.id, { code: p.code, from_status: p.status, to_status: to, justification: just });

    if (to === 'Submitted') {
      for (const c of coordinators()) {
        notify(c, { kind: 'proposal_submitted', title: 'Nueva propuesta enviada', message: `${s.fullName} envió la propuesta ${p.code}.`, project_id: p.id, dedupe_key: `${p.id}-submitted-${now}` });
      }
    } else if (to === 'Closure requested') {
      for (const c of coordinators()) {
        notify(c, { kind: 'closure_requested', title: 'Solicitud de cierre', message: `Se solicitó el cierre del proyecto ${p.code}.`, project_id: p.id, dedupe_key: `${p.id}-closure-${now}` });
      }
    } else if (p.pi_user_id !== s.userId) {
      notify(p.pi_user_id, { kind: 'status_changed', title: `Proyecto ${p.code}: ${to}`, message: just || `El estado de su proyecto cambió a "${to}".`, project_id: p.id, dedupe_key: `${p.id}-${to}-${now}` });
    }
  });
  return loadProject(s, p.id);
}

router.post('/projects/:id/submit', (req, res) => {
  const s = req.session;
  if (!hasPermission(s.role, 'submit_project')) throw errors.forbidden();
  const p = loadProject(s, req.params.id);
  const to = p.status === 'Changes requested' ? 'Under review' : 'Submitted';
  const updated = doTransition(s, p, to, req.body?.justification || (to === 'Submitted' ? 'Envío formal de la propuesta.' : 'Reenvío con subsanación de observaciones.'), req.body?.row_version);
  res.json(serializeProject(updated, s));
});

router.post('/projects/:id/transitions', (req, res) => {
  const s = req.session;
  const p = loadProject(s, req.params.id);
  const updated = doTransition(s, p, req.body?.to_status, req.body?.justification, req.body?.row_version);
  res.json(serializeProject(updated, s));
});

router.get('/projects/:id/closure-checklist', (req, res) => {
  const p = loadProject(req.session, req.params.id);
  res.json(closureChecklist(p.id));
});

// ===========================================================================
// PLAN DE TRABAJO: ACTIVIDADES Y ENTREGABLES (FR-020..024)
// ===========================================================================
router.get('/projects/:id/activities', (req, res) => {
  const p = loadProject(req.session, req.params.id);
  res.json(listActivities(p.id));
});

function recomputeProgress(projectId) {
  run(
    `UPDATE projects SET overall_progress = COALESCE((SELECT ROUND(SUM(progress * weight) / SUM(weight), 2) FROM activities WHERE project_id = ?), 0),
       updated_at = ? WHERE id = ?`,
    [projectId, nowIso(), projectId]
  );
}

router.patch('/activities/:id/progress', (req, res) => {
  const s = req.session;
  const act = get('SELECT * FROM activities WHERE id = ?', [req.params.id]);
  if (!act) throw errors.notFound('Actividad no encontrada.');
  const p = loadProject(s, act.project_id);
  if (!isTeam(s, p)) throw errors.forbidden('Solo el equipo del proyecto puede registrar avances.');
  if (!['In progress'].includes(p.status)) throw errors.invalid('Solo se registran avances en proyectos en ejecución.');
  const progress = Number(req.body?.progress);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw errors.invalid('El avance debe ser un número entre 0 y 100.');
  transaction(() => {
    run('UPDATE activities SET progress = ? WHERE id = ?', [Math.round(progress * 100) / 100, act.id]);
    run('INSERT INTO progress_updates (id, activity_id, author_id, percent, comment, at) VALUES (?,?,?,?,?,?)',
      [newId('pu'), act.id, s.userId, progress, cleanText(req.body?.comment, 1000) || 'Actualización de avance.', nowIso()]);
    recomputeProgress(p.id);
    audit(s, 'ACTIVITY_PROGRESS_UPDATED', 'activity', act.id, { project_id: p.id, from: act.progress, to: progress });
  });
  res.json(listActivities(p.id).find(a => a.id === act.id));
});

router.post('/deliverables/:id/submit', (req, res) => {
  const s = req.session;
  if (!hasPermission(s.role, 'submit_deliverable')) throw errors.forbidden();
  const d = get('SELECT d.*, a.project_id FROM deliverables d JOIN activities a ON a.id = d.activity_id WHERE d.id = ?', [req.params.id]);
  if (!d) throw errors.notFound('Entregable no encontrado.');
  const p = loadProject(s, d.project_id);
  if (!isTeam(s, p)) throw errors.forbidden('Solo el equipo del proyecto puede enviar entregables.');
  const ids = Array.isArray(req.body?.evidence_document_ids) ? req.body.evidence_document_ids : [];
  // FR-022: al menos un documento probatorio que exista y pertenezca al proyecto
  const valid = ids.filter(id => get('SELECT 1 AS x FROM documents WHERE id = ? AND project_id = ? AND obsolete_reason IS NULL', [id, p.id]));
  if (!valid.length) {
    throw errors.invalid('Validación Normativa Incompleta: No puede enviar un entregable sin al menos un documento probatorio adjunto.');
  }
  if (['Approved', 'Cancelled'].includes(d.status)) throw errors.invalid(`El entregable ya está en estado ${d.status}.`);
  transaction(() => {
    run(`UPDATE deliverables SET status = 'Submitted', evidence_document_ids = ? WHERE id = ?`, [toJson(valid), d.id]);
    audit(s, 'DELIVERABLE_SUBMITTED', 'deliverable', d.id, { project_id: p.id, code: d.code, evidence: valid });
    for (const c of coordinators()) {
      notify(c, { kind: 'status_changed', title: `Entregable ${d.code} enviado`, message: `${s.fullName} envió "${d.name}" del proyecto ${p.code} con evidencia.`, project_id: p.id, dedupe_key: `${d.id}-submitted` });
    }
  });
  res.json(serializeDeliverable(get('SELECT * FROM deliverables WHERE id = ?', [d.id])));
});

router.post('/deliverables/:id/review', requirePermission('approve_closure'), (req, res) => {
  const d = get('SELECT d.*, a.project_id FROM deliverables d JOIN activities a ON a.id = d.activity_id WHERE d.id = ?', [req.params.id]);
  if (!d) throw errors.notFound('Entregable no encontrado.');
  const p = loadProject(req.session, d.project_id);
  const to = req.body?.status;
  if (!['Approved', 'Cancelled', 'Pending'].includes(to)) throw errors.invalid('Estado inválido.');
  run('UPDATE deliverables SET status = ? WHERE id = ?', [to, d.id]);
  audit(req.session, 'DELIVERABLE_REVIEWED', 'deliverable', d.id, { project_id: p.id, status: to });
  res.json(serializeDeliverable(get('SELECT * FROM deliverables WHERE id = ?', [d.id])));
});

// ===========================================================================
// DOCUMENTOS VERSIONADOS (FR-025..029)
// ===========================================================================
router.get('/projects/:id/documents', (req, res) => {
  const p = loadProject(req.session, req.params.id);
  res.json(all('SELECT * FROM documents WHERE project_id = ? ORDER BY name', [p.id]).map(serializeDocument));
});

export function storeDocument(s, p, file, { type = 'evidence', changeNote = '', forceName } = {}) {
  if (!file) throw errors.invalid('Debe adjuntar un archivo.');
  const name = (forceName || fixName(file.originalname)).trim();
  const nameError = validateUploadFileName(name);
  if (nameError) throw errors.unsupported(nameError);
  if (!file.size) throw errors.invalid('El archivo está vacío o su tamaño no es válido.');
  if (file.size > config.maxUploadBytes) throw errors.tooLarge(`El archivo excede el tamaño máximo permitido de ${config.maxUploadBytes / 1024 / 1024} MB.`);
  const ext = name.split('.').pop().toLowerCase();
  if (!contentMatchesExtension(file.buffer, ext)) throw errors.unsupported(`El contenido del archivo no corresponde a un archivo .${ext} válido.`);
  const allowedTypes = ['proposal', 'technical_report', 'evidence', 'final_report', 'agreement', 'other'];
  const docType = allowedTypes.includes(type) ? type : 'other';

  return transaction(() => {
    let doc = get('SELECT * FROM documents WHERE project_id = ? AND lower(name) = lower(?)', [p.id, name]);
    if (!doc) {
      doc = { id: newId('doc'), project_id: p.id, name, type: docType, obsolete_reason: null };
      run('INSERT INTO documents (id, project_id, name, type, obsolete_reason) VALUES (?,?,?,?,NULL)', [doc.id, p.id, name, docType]);
    } else if (doc.obsolete_reason) {
      throw errors.invalid('El documento está marcado como obsoleto; cárguelo con un nombre distinto.');
    }
    const versionNo = (get('SELECT MAX(version_no) AS n FROM document_versions WHERE document_id = ?', [doc.id])?.n || 0) + 1;
    const rel = path.join(p.id, `${doc.id}-v${versionNo}.${ext}`);
    fs.mkdirSync(path.join(config.uploadsDir, p.id), { recursive: true });
    fs.writeFileSync(path.join(config.uploadsDir, rel), file.buffer);
    const hash = sha256(file.buffer);
    const note = cleanText(changeNote, 1000) || (versionNo === 1 ? 'Carga inicial del documento.' : 'Actualización de documento.');
    run(
      `INSERT INTO document_versions (id, document_id, version_no, sha256, mime, size_bytes, author_id, change_note, storage_path, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [newId('ver'), doc.id, versionNo, hash, MIME_BY_EXT[ext], file.size, s.userId, note, rel, nowIso()]
    );
    audit(s, 'DOCUMENT_VERSION_UPLOADED', 'document', doc.id, { project_id: p.id, name, version_no: versionNo, sha256: hash, size_bytes: file.size });
    return get('SELECT * FROM documents WHERE id = ?', [doc.id]);
  });
}

router.post('/projects/:id/documents', singleFile('file'), (req, res) => {
  const s = req.session;
  const p = loadProject(s, req.params.id);
  if (!isTeam(s, p) && s.role !== 'research_coordinator') throw errors.forbidden('Solo el equipo del proyecto o la Coordinación pueden cargar documentos.');
  if (['Closed', 'Cancelled', 'Rejected'].includes(p.status)) throw errors.invalid('El expediente está cerrado y es de solo lectura.');
  const doc = storeDocument(s, p, req.file, { type: req.body?.type, changeNote: req.body?.change_note });
  res.status(201).json(serializeDocument(doc));
});

router.post('/documents/:id/obsolete', (req, res) => {
  const s = req.session;
  const doc = get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!doc) throw errors.notFound('Documento no encontrado.');
  const p = loadProject(s, doc.project_id);
  if (!isOwner(s, p) && s.role !== 'research_coordinator') throw errors.forbidden('Solo el Investigador Principal o la Coordinación pueden declarar obsoleto un documento.');
  const reason = cleanText(req.body?.reason, 1000);
  if (!reason) throw errors.invalid('Debe indicar un motivo justificado para declarar obsoleto el documento.');
  run('UPDATE documents SET obsolete_reason = ? WHERE id = ?', [reason, doc.id]);
  audit(s, 'DOCUMENT_MARKED_OBSOLETE', 'document', doc.id, { project_id: p.id, reason });
  res.json(serializeDocument(get('SELECT * FROM documents WHERE id = ?', [doc.id])));
});

router.get('/documents/versions/:id/download', (req, res) => {
  const s = req.session;
  const v = get('SELECT v.*, d.project_id, d.name FROM document_versions v JOIN documents d ON d.id = v.document_id WHERE v.id = ?', [req.params.id]);
  if (!v) throw errors.notFound('Versión no encontrada.');
  const p = loadProject(s, v.project_id);
  if (s.role === 'university_authority' || (s.role === 'administrator')) throw errors.forbidden('Su rol no tiene acceso al contenido de los expedientes.');
  const file = path.resolve(config.uploadsDir, v.storage_path || '');
  if (!file.startsWith(path.resolve(config.uploadsDir)) || !fs.existsSync(file)) throw errors.notFound('El archivo no está disponible en el almacenamiento.');
  const content = fs.readFileSync(file);
  if (sha256(content) !== v.sha256) throw errors.conflict('La integridad del archivo no coincide con el hash registrado.');
  audit(s, 'DOCUMENT_DOWNLOADED', 'document_version', v.id, { project_id: p.id, version_no: v.version_no });
  const [base, ext] = [v.name.replace(/\.[^.]+$/, ''), v.name.split('.').pop()];
  res.setHeader('Content-Type', v.mime);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${base}_v${v.version_no}.${ext}`)}`);
  res.setHeader('X-Content-SHA256', v.sha256);
  res.send(content);
});

// ===========================================================================
// PRODUCTOS DE INVESTIGACIÓN (FR-030..032, BR-013)
// ===========================================================================
router.get('/products', (req, res) => {
  const s = req.session;
  const rows = all(`${PRODUCT_SELECT} ${req.query.project_id ? 'WHERE pr.project_id = ?' : ''} ORDER BY pr.product_date DESC`, req.query.project_id ? [req.query.project_id] : []);
  const visible = rows.filter(r => {
    const p = get('SELECT * FROM projects WHERE id = ?', [r.project_id]);
    if (s.role === 'university_authority') return r.validated_at !== null && !p.confidential;
    return canRead(s, p);
  });
  res.json(visible.map(serializeProduct));
});

const PRODUCT_TYPES = ['journal_article', 'conference_paper', 'book', 'book_chapter', 'thesis', 'patent', 'software', 'other'];
const PRODUCT_STATUS = ['in_preparation', 'submitted', 'accepted', 'published'];

router.post('/products', singleFile('evidence'), (req, res) => {
  const s = req.session;
  if (!hasPermission(s.role, 'register_product')) throw errors.forbidden();
  const d = req.body || {};
  const p = loadProject(s, d.project_id);
  if (!isTeam(s, p)) throw errors.forbidden('Solo el equipo del proyecto puede registrar productos.');
  const fields = [];
  if (cleanText(d.title).length < 5) fields.push({ field: 'title', message: 'El título del producto es obligatorio.' });
  if (!PRODUCT_TYPES.includes(d.type)) fields.push({ field: 'type', message: 'Tipo de producto inválido.' });
  const link = cleanText(d.doi_or_url, 500) || null;
  if (!isSafeLink(link)) fields.push({ field: 'doi_or_url', message: 'El enlace debe ser una URL http(s) o un DOI válido.' });
  if (fields.length) throw errors.invalid('Error de validación en el formulario.', fields);

  const id = newId('prod');
  transaction(() => {
    let evidenceDoc = null;
    if (req.file) evidenceDoc = storeDocument(s, p, req.file, { type: 'evidence', changeNote: `Evidencia del producto: ${cleanText(d.title, 100)}` });
    run(
      `INSERT INTO products (id, project_id, type, title, authors, product_date, venue, doi_or_url, status, evidence_document_id, evidence_filename, validated_at, validator_id, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,?)`, // un producto nunca nace validado (BR-013)
      [id, p.id, d.type, cleanText(d.title, 500), cleanText(d.authors, 500) || s.fullName,
        /^\d{4}-\d{2}-\d{2}$/.test(d.product_date || '') ? d.product_date : nowIso().slice(0, 10),
        cleanText(d.venue, 300), link, PRODUCT_STATUS.includes(d.status) ? d.status : 'in_preparation',
        evidenceDoc?.id ?? null, evidenceDoc?.name ?? null, s.userId, nowIso()]
    );
    audit(s, 'PRODUCT_REGISTERED', 'research_product', id, { project_id: p.id, title: cleanText(d.title, 120) });
    for (const c of coordinators()) {
      notify(c, { kind: 'status_changed', title: 'Producto pendiente de validación', message: `${s.fullName} registró "${cleanText(d.title, 80)}" (${p.code}).`, project_id: p.id, dedupe_key: `${id}-registered` });
    }
  });
  res.status(201).json(serializeProduct(get(`${PRODUCT_SELECT} WHERE pr.id = ?`, [id])));
});

router.post('/products/:id/validate', requirePermission('validate_product'), (req, res) => {
  const s = req.session;
  const prod = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!prod) throw errors.notFound('Producto no encontrado.');
  const p = loadProject(s, prod.project_id);
  if (prod.validated_at) throw errors.conflict('El producto ya fue validado.');
  transaction(() => {
    run('UPDATE products SET validated_at = ?, validator_id = ? WHERE id = ?', [nowIso(), s.userId, prod.id]);
    audit(s, 'PRODUCT_VALIDATED', 'research_product', prod.id, { project_id: p.id, title: prod.title.slice(0, 120) });
    notify(p.pi_user_id, { kind: 'status_changed', title: 'Producto de investigación validado', message: `La Coordinación validó "${prod.title.slice(0, 80)}".`, project_id: p.id, dedupe_key: `${prod.id}-validated` });
  });
  res.json(serializeProduct(get(`${PRODUCT_SELECT} WHERE pr.id = ?`, [prod.id])));
});

// ===========================================================================
// OBSERVACIONES Y SUBSANACIÓN (RF-08)
// ===========================================================================
const serializeObservation = o => ({ ...o, resolved: Boolean(o.resolved) });

router.get('/projects/:id/observations', (req, res) => {
  const p = loadProject(req.session, req.params.id);
  res.json(all('SELECT * FROM observations WHERE project_id = ? ORDER BY sort_order', [p.id]).map(serializeObservation));
});

router.get('/observations/pending-projects', (req, res) => {
  // Proyectos visibles con observaciones registradas (para la vista de subsanación)
  const projects = listProjects(req.session).filter(p => get('SELECT 1 AS x FROM observations WHERE project_id = ?', [p.id]));
  res.json(projects);
});

router.post('/projects/:id/observations', requirePermission('decide_project'), (req, res) => {
  const p = loadProject(req.session, req.params.id);
  const section = cleanText(req.body?.section_name, 200);
  const original = cleanText(req.body?.original_text_v1, 3000);
  if (!section || !original) throw errors.invalid('Sección y texto observado son obligatorios.');
  const id = newId('obs');
  const order = get('SELECT COUNT(*) AS n FROM observations WHERE project_id = ?', [p.id]).n;
  run('INSERT INTO observations (id, project_id, section_name, original_text_v1, corrected_text_v2, researcher_justification, evidence_document_id, resolved, sort_order) VALUES (?,?,?,?,?,?,NULL,0,?)',
    [id, p.id, section, original, '', '', order]);
  audit(req.session, 'OBSERVATION_CREATED', 'observation', id, { project_id: p.id, section });
  res.status(201).json(serializeObservation(get('SELECT * FROM observations WHERE id = ?', [id])));
});

router.patch('/observations/:id', (req, res) => {
  const s = req.session;
  const o = get('SELECT * FROM observations WHERE id = ?', [req.params.id]);
  if (!o) throw errors.notFound('Observación no encontrada.');
  const p = loadProject(s, o.project_id);
  if (!isOwner(s, p)) throw errors.forbidden('Solo el Investigador Principal puede subsanar observaciones.');
  if (p.status !== 'Changes requested') throw errors.invalid('El proyecto no tiene una solicitud de subsanación abierta.');
  const corrected = req.body?.corrected_text_v2 !== undefined ? cleanText(req.body.corrected_text_v2, 5000) : o.corrected_text_v2;
  const just = req.body?.researcher_justification !== undefined ? cleanText(req.body.researcher_justification, 3000) : o.researcher_justification;
  const resolved = req.body?.resolved !== undefined ? Boolean(req.body.resolved) : Boolean(o.resolved);
  if (resolved && (!corrected || !just)) throw errors.invalid('Para marcar como subsanada se requiere el texto corregido y la justificación.');
  run('UPDATE observations SET corrected_text_v2 = ?, researcher_justification = ?, resolved = ? WHERE id = ?', [corrected, just, resolved, o.id]);
  audit(s, 'OBSERVATION_UPDATED', 'observation', o.id, { project_id: p.id, resolved });
  res.json(serializeObservation(get('SELECT * FROM observations WHERE id = ?', [o.id])));
});

// ===========================================================================
// EVALUACIÓN POR PARES (FR-015..019, BR-011)
// ===========================================================================
router.get('/reviews/assignments', (req, res) => {
  const s = req.session;
  if (!['committee_member', 'research_coordinator'].includes(s.role)) throw errors.forbidden();
  const rows = s.role === 'committee_member'
    ? all('SELECT * FROM review_assignments WHERE reviewer_id = ? ORDER BY due_at', [s.userId])
    : all('SELECT * FROM review_assignments ORDER BY due_at');
  const out = [];
  for (const a of rows) {
    const p = get('SELECT * FROM projects WHERE id = ?', [a.project_id]);
    if (!p || (s.role === 'committee_member' && p.pi_user_id === s.userId)) continue;
    let full;
    try {
      full = loadProject(s, p.id);
    } catch {
      continue; // p. ej. revisor inhibido: ya no tiene acceso al contenido
    }
    const project = serializeProject(full, s);
    const v = currentVersion(p.id);
    out.push({
      ...serializeAssignment(a, { revealReviewer: s.role === 'research_coordinator' }),
      project,
      ai_summary: p.confidential ? null : summarizeProject(p, v),
    });
  }
  res.json(out);
});

router.get('/projects/:id/evaluations', (req, res) => {
  const s = req.session;
  const p = loadProject(s, req.params.id);
  // Evaluación ciega: un miembro del comité solo ve su propia asignación
  const rows = s.role === 'committee_member'
    ? all('SELECT * FROM review_assignments WHERE project_id = ? AND reviewer_id = ? ORDER BY created_at', [p.id, s.userId])
    : all('SELECT * FROM review_assignments WHERE project_id = ? ORDER BY created_at', [p.id]);
  res.json(rows.map(a => serializeAssignment(a, { revealReviewer: s.role === 'research_coordinator' })));
});

router.post('/projects/:id/review-assignments', requirePermission('assign_reviewers'), (req, res) => {
  const s = req.session;
  const p = loadProject(s, req.params.id);
  const reviewer = get('SELECT * FROM users WHERE id = ? AND active = 1', [req.body?.reviewer_id]);
  if (!reviewer || !fromJson(reviewer.roles, []).includes('committee_member')) throw errors.invalid('El revisor debe ser un miembro activo del Comité.');
  if (reviewer.id === p.pi_user_id || get('SELECT 1 AS x FROM project_members WHERE project_id = ? AND user_id = ?', [p.id, reviewer.id])) {
    throw errors.invalid('Conflicto de interés: el revisor es autor o miembro del proyecto (BR-011).');
  }
  const due = req.body?.due_at;
  if (!due || Number.isNaN(Date.parse(due))) throw errors.invalid('La fecha límite de evaluación es obligatoria.', [{ field: 'due_at', message: 'Indique una fecha válida.' }]);
  const id = newId('rev');
  const alias = `Revisor Par #REV-${Math.floor(1000 + Math.random() * 9000)}`;
  run('INSERT INTO review_assignments (id, project_id, reviewer_id, reviewer_alias, due_at, has_conflict_of_interest, conflict_reason, created_at) VALUES (?,?,?,?,?,0,NULL,?)',
    [id, p.id, reviewer.id, alias, new Date(due).toISOString(), nowIso()]);
  audit(s, 'REVIEWERS_ASSIGNED', 'project', p.id, { assignment_id: id, reviewer_alias: alias, due_at: due });
  notify(reviewer.id, { kind: 'proposal_submitted', title: 'Expediente asignado para evaluación', message: `Se le asignó el expediente ${p.anonymous_code}.`, project_id: p.id, dedupe_key: `${id}-assigned` });
  res.status(201).json(serializeAssignment(get('SELECT * FROM review_assignments WHERE id = ?', [id]), { revealReviewer: true }));
});

const RUBRIC = [
  ['crit-01', 'Rigor Metodológico y Viabilidad Experimental', 35],
  ['crit-02', 'Impacto Social y Transferencia Tecnológica', 35],
  ['crit-03', 'Coherencia Presupuestal y Cronograma Físico', 30],
];

router.post('/reviews/assignments/:id/evaluation', requirePermission('evaluate_project'), (req, res) => {
  const s = req.session;
  const a = get('SELECT * FROM review_assignments WHERE id = ? AND reviewer_id = ?', [req.params.id, s.userId]);
  if (!a) throw errors.notFound('Asignación no encontrada.');
  if (a.has_conflict_of_interest) throw errors.invalid('Usted se inhibió de esta evaluación por conflicto de interés.');
  if (get('SELECT 1 AS x FROM evaluations WHERE assignment_id = ?', [a.id])) throw errors.conflict('La evaluación ya fue emitida y es inmutable (BR-003).');
  const p = loadProject(s, a.project_id);
  const scores = Array.isArray(req.body?.rubric_scores) ? req.body.rubric_scores : [];
  const rubric = RUBRIC.map(([cid, name, max]) => {
    const sc = scores.find(x => x.criterion_id === cid) || {};
    const score = Number(sc.score);
    if (!Number.isFinite(score) || score < 0 || score > max) throw errors.invalid(`Puntaje inválido para "${name}" (0 a ${max}).`);
    return { criterion_id: cid, criterion_name: name, max_score: max, score, qualitative_justification: cleanText(sc.qualitative_justification, 1000) };
  });
  const comments = cleanText(req.body?.comments, 4000);
  if (comments.length < 10) throw errors.invalid('La justificación cualitativa del dictamen es obligatoria.', [{ field: 'comments', message: 'Mínimo 10 caracteres.' }]);
  const recommendation = req.body?.recommendation;
  if (!['approve', 'reject', 'request_changes'].includes(recommendation)) throw errors.invalid('Recomendación inválida.');
  const total = rubric.reduce((acc, r) => acc + r.score, 0);
  const id = newId('eval');
  transaction(() => {
    run('INSERT INTO evaluations (id, assignment_id, recommendation, comments, total_score, rubric_scores, submitted_at) VALUES (?,?,?,?,?,?,?)',
      [id, a.id, recommendation, comments, total, toJson(rubric), nowIso()]);
    audit(s, 'EVALUATION_SUBMITTED', 'evaluation', id, { project_id: p.id, total_score: total, recommendation });
    for (const c of coordinators()) {
      notify(c, { kind: 'reviewer_comment', title: 'Evaluación recibida', message: `${a.reviewer_alias} evaluó ${p.anonymous_code}: ${total}/100.`, project_id: p.id, dedupe_key: `${id}-submitted` });
    }
  });
  res.status(201).json(serializeAssignment(get('SELECT * FROM review_assignments WHERE id = ?', [a.id])));
});

router.post('/reviews/assignments/:id/conflict', requirePermission('evaluate_project'), (req, res) => {
  const s = req.session;
  const a = get('SELECT * FROM review_assignments WHERE id = ? AND reviewer_id = ?', [req.params.id, s.userId]);
  if (!a) throw errors.notFound('Asignación no encontrada.');
  const reason = cleanText(req.body?.reason, 1000);
  if (!reason) throw errors.invalid('Debe especificar el motivo del conflicto de interés (BR-011).');
  if (get('SELECT 1 AS x FROM evaluations WHERE assignment_id = ?', [a.id])) throw errors.conflict('La evaluación ya fue emitida.');
  run('UPDATE review_assignments SET has_conflict_of_interest = 1, conflict_reason = ? WHERE id = ?', [reason, a.id]);
  audit(s, 'CONFLICT_OF_INTEREST_DECLARED', 'review_assignment', a.id, { project_id: a.project_id });
  for (const c of coordinators()) {
    notify(c, { kind: 'reviewer_comment', title: 'Inhibición de revisor', message: `${a.reviewer_alias} declaró conflicto de interés. Se requiere reasignar.`, project_id: a.project_id, dedupe_key: `${a.id}-conflict` });
  }
  res.json(serializeAssignment(get('SELECT * FROM review_assignments WHERE id = ?', [a.id])));
});

// ===========================================================================
// DICTAMEN COLEGIADO (V08)
// ===========================================================================
function serializeSession(cs, s) {
  const p = get('SELECT * FROM projects WHERE id = ?', [cs.project_id]);
  const votes = all('SELECT * FROM committee_votes WHERE session_id = ? ORDER BY sort_order', [cs.id]);
  const observations = all('SELECT * FROM observations WHERE project_id = ? ORDER BY sort_order', [cs.project_id]).map(serializeObservation);
  return {
    id: cs.id,
    project_id: cs.project_id,
    project_code: p.code,
    anonymous_code: p.anonymous_code,
    project_title: p.title,
    session_number: cs.session_number,
    required_quorum: cs.required_quorum,
    resolution_number: cs.resolution_number,
    resolution_issued_at: cs.resolution_issued_at,
    resolution_hash: cs.resolution_hash,
    observations,
    votes: votes.map(v => ({
      id: v.id, name: v.member_name, role: v.member_role, vote: v.vote, signatureHash: v.signature_hash, votedAt: v.voted_at,
      is_current_user: v.user_id === s.userId,
    })),
  };
}

router.get('/committee/sessions', (req, res) => {
  const s = req.session;
  if (!['committee_member', 'research_coordinator'].includes(s.role)) throw errors.forbidden();
  const rows = s.role === 'committee_member'
    ? all('SELECT cs.* FROM committee_sessions cs JOIN committee_votes v ON v.session_id = cs.id WHERE v.user_id = ? ORDER BY cs.created_at DESC', [s.userId])
    : all('SELECT * FROM committee_sessions ORDER BY created_at DESC');
  res.json(rows.map(cs => serializeSession(cs, s)));
});

router.post('/committee/sessions/:id/vote', requirePermission('vote_committee'), (req, res) => {
  const s = req.session;
  const cs = get('SELECT * FROM committee_sessions WHERE id = ?', [req.params.id]);
  if (!cs) throw errors.notFound('Sesión no encontrada.');
  if (cs.resolution_number) throw errors.conflict('La resolución ya fue emitida; los votos son inmutables.');
  const v = get('SELECT * FROM committee_votes WHERE session_id = ? AND user_id = ?', [cs.id, s.userId]);
  if (!v) throw errors.forbidden('Usted no integra el tribunal de esta sesión.');
  if (v.vote) throw errors.conflict('Su voto ya fue registrado y firmado.');
  const vote = req.body?.vote;
  if (!['favor', 'contra', 'abstencion'].includes(vote)) throw errors.invalid('Voto inválido.');
  const at = nowIso();
  const sig = sha256(`${cs.id}|${s.userId}|${vote}|${at}`);
  run('UPDATE committee_votes SET vote = ?, signature_hash = ?, voted_at = ? WHERE id = ?', [vote, sig, at, v.id]);
  audit(s, 'COMMITTEE_VOTE_CAST', 'committee_session', cs.id, { vote, signature: sig });
  res.json(serializeSession(get('SELECT * FROM committee_sessions WHERE id = ?', [cs.id]), s));
});

router.post('/committee/sessions/:id/resolution', (req, res) => {
  const s = req.session;
  const cs = get('SELECT * FROM committee_sessions WHERE id = ?', [req.params.id]);
  if (!cs) throw errors.notFound('Sesión no encontrada.');
  const member = get('SELECT 1 AS x FROM committee_votes WHERE session_id = ? AND user_id = ?', [cs.id, s.userId]);
  if (s.role !== 'research_coordinator' && !(s.role === 'committee_member' && member)) throw errors.forbidden();
  if (cs.resolution_number) throw errors.conflict('La resolución ya fue emitida.');
  const votes = all('SELECT * FROM committee_votes WHERE session_id = ?', [cs.id]);
  const cast = votes.filter(v => v.vote);
  if (cast.length < cs.required_quorum) throw errors.invalid(`Control de Quórum Incompleto: ${cast.length}/${cs.required_quorum} votos registrados.`);
  const favor = cast.filter(v => v.vote === 'favor').length;
  const year = new Date().getFullYear();
  const number = `Resolución Colegiada Nº ${String(get('SELECT COUNT(*) AS n FROM committee_sessions WHERE resolution_number IS NOT NULL').n + 15).padStart(3, '0')}-${year}-CIE`;
  const hash = sha256(`${cs.id}|${number}|${cast.map(v => v.signature_hash).join('|')}`);
  transaction(() => {
    run('UPDATE committee_sessions SET resolution_number = ?, resolution_issued_at = ?, resolution_hash = ? WHERE id = ?', [number, nowIso(), hash, cs.id]);
    audit(s, 'COLLEGIATE_RESOLUTION_ISSUED', 'committee_session', cs.id, { resolution: number, favor, total: cast.length, hash });
  });
  res.json(serializeSession(get('SELECT * FROM committee_sessions WHERE id = ?', [cs.id]), s));
});

// ===========================================================================
// IA SOBRE PROYECTOS (AIR-008..011)
// ===========================================================================
router.post('/ai/precheck', (req, res) => {
  const s = req.session;
  if (req.body?.project_id) {
    const p = loadProject(s, req.body.project_id);
    if (p.confidential) throw errors.forbidden('El pre-chequeo por IA no está disponible para proyectos confidenciales (AIR-011).');
    const v = currentVersion(p.id) || {};
    const result = precheck({ ...p, ...v, budget_breakdown: fromJson(p.budget_breakdown, []) });
    audit(s, 'AI_PRECHECK_RUN', 'project', p.id, { observations: result.observations.length });
    return res.json({ project_id: p.id, ...result });
  }
  const draft = req.body?.draft;
  if (!draft) throw errors.invalid('Debe enviar project_id o el borrador de la propuesta.');
  if (draft.confidential) throw errors.forbidden('El pre-chequeo por IA no está disponible para proyectos confidenciales (AIR-011).');
  res.json({ project_id: 'draft', ...precheck(draft) });
});

router.get('/projects/:id/ai/summary', (req, res) => {
  const p = loadProject(req.session, req.params.id);
  if (p.confidential) throw errors.forbidden('Resumen no disponible para proyectos confidenciales (AIR-011).');
  const v = currentVersion(p.id);
  res.json({
    project_id: p.id,
    version_no: v?.version_no ?? 1,
    ...summarizeProject(p, v),
    advisory_notice: 'Resumen ejecutivo extractivo generado automáticamente a partir del expediente para facilitar la lectura inicial. No reemplaza la revisión completa.',
    generated_at: nowIso(),
  });
});

export { userName };
