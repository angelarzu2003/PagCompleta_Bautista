/**
 * Consultas de lectura, serialización al contrato de `types/domain.ts` y control de acceso
 * a nivel de objeto (evita IDOR/BOLA). La autorización SIEMPRE se resuelve aquí, en el servidor.
 */
import { all, get, fromJson } from './db.js';
import { errors } from './lib.js';

const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Usuarios y catálogos
// ---------------------------------------------------------------------------
export function maskNationalId(dni) {
  if (!dni) return undefined;
  return `***.***.${String(dni).slice(-3)}`;
}

export function serializeUser(u) {
  if (!u) return null;
  const dept = get('SELECT name FROM catalog_items WHERE id = ?', [u.department_id]);
  return {
    id: u.id,
    institutional_subject: u.institutional_subject,
    email: u.email,
    full_name: u.full_name,
    title: u.title,
    department_id: u.department_id,
    department_name: dept?.name,
    roles: fromJson(u.roles, []),
    active: Boolean(u.active),
    masked_national_id: maskNationalId(u.national_id),
    privacy_accepted_at: u.privacy_accepted_at,
  };
}

export const userName = id => get('SELECT full_name FROM users WHERE id = ?', [id])?.full_name;

export function getCatalogs({ includeInactive = false } = {}) {
  const rows = all(`SELECT * FROM catalog_items ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY catalog_type, name`);
  const out = { departments: [], research_areas: [], research_lines: [], project_types: [], deliverable_types: [] };
  for (const r of rows) {
    (out[r.catalog_type] ||= []).push({ id: r.id, name: r.name, active: Boolean(r.active), parent_id: r.parent_id });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Proyectos y control de acceso
// ---------------------------------------------------------------------------
const PROJECT_SELECT = `
  SELECT p.*, u.full_name AS pi_full_name,
         d.name AS department_name, a.name AS area_name, l.name AS line_name, t.name AS type_name
  FROM projects p
  LEFT JOIN users u ON u.id = p.pi_user_id
  LEFT JOIN catalog_items d ON d.id = p.department_id
  LEFT JOIN catalog_items a ON a.id = p.area_id
  LEFT JOIN catalog_items l ON l.id = p.line_id
  LEFT JOIN catalog_items t ON t.id = p.type_id`;

export function isMember(projectId, userId) {
  return Boolean(get('SELECT 1 AS x FROM project_members WHERE project_id = ? AND user_id = ? AND left_at IS NULL', [projectId, userId]));
}

export function isAssignedReviewer(projectId, userId) {
  return Boolean(
    get('SELECT 1 AS x FROM review_assignments WHERE project_id = ? AND reviewer_id = ? AND has_conflict_of_interest = 0', [projectId, userId]) ||
      get(
        `SELECT 1 AS x FROM committee_votes v JOIN committee_sessions s ON s.id = v.session_id
         WHERE s.project_id = ? AND v.user_id = ?`,
        [projectId, userId]
      )
  );
}

/** ¿Puede la sesión LEER el proyecto? */
export function canRead(session, p) {
  const { role, userId } = session;
  switch (role) {
    case 'researcher':
    case 'student_researcher':
      return p.pi_user_id === userId || isMember(p.id, userId);
    case 'committee_member':
      // BR-011: nunca sus propios proyectos; solo los que tiene asignados.
      return p.pi_user_id !== userId && isAssignedReviewer(p.id, userId);
    case 'department_coordinator':
      return p.department_id === session.user.department_id && !p.confidential;
    case 'university_authority':
      return true; // solo datos agregados / títulos enmascarados si son confidenciales
    case 'research_coordinator':
      return true;
    case 'administrator':
      return !p.confidential; // sin acceso a expedientes confidenciales
    default:
      return false;
  }
}

export const isOwner = (session, p) => p.pi_user_id === session.userId;
export const isTeam = (session, p) => isOwner(session, p) || isMember(p.id, session.userId);

/** Obtiene el proyecto en bruto validando acceso. 404 (no 403) para no revelar IDs. */
export function loadProject(session, id) {
  const p = get(`${PROJECT_SELECT} WHERE p.id = ?`, [id]);
  if (!p || !canRead(session, p)) throw errors.notFound('El expediente del proyecto no fue encontrado.');
  return p;
}

export function currentVersion(projectId) {
  const v = get('SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_no DESC LIMIT 1', [projectId]);
  if (!v) return undefined;
  return { ...v, specific_objectives: fromJson(v.specific_objectives, []) };
}

export function serializeProject(p, session, { detail = true } = {}) {
  const blind = session?.role === 'committee_member'; // evaluación ciega
  const maskConfidential = session?.role === 'university_authority' && p.confidential;
  const out = {
    id: p.id,
    code: p.code,
    anonymous_code: p.anonymous_code,
    title: maskConfidential ? 'Proyecto Confidencial Adjudicado' : p.title,
    pi_user_id: blind ? 'anonimo' : p.pi_user_id,
    pi_full_name: blind ? 'Investigador anónimo (evaluación ciega)' : p.pi_full_name,
    department_id: p.department_id,
    department_name: p.department_name,
    area_id: p.area_id,
    area_name: p.area_name,
    line_id: p.line_id,
    line_name: p.line_name,
    type_id: p.type_id,
    type_name: p.type_name,
    status: p.status,
    confidential: Boolean(p.confidential),
    start_date: p.start_date,
    end_date: p.end_date,
    requested_funding: p.requested_funding,
    overall_progress: p.overall_progress,
    row_version: p.row_version,
    budget_breakdown: fromJson(p.budget_breakdown, undefined),
    resolution_number: p.resolution_number,
    cvd_code: p.cvd_code,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
  if (detail && !maskConfidential) {
    out.current_version = currentVersion(p.id);
    out.members = all(
      `SELECT m.*, u.full_name, u.email FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY m.joined_at`,
      [p.id]
    ).map(m => ({ id: m.id, project_id: m.project_id, user_id: m.user_id, full_name: m.full_name, email: m.email, project_role: m.project_role, joined_at: m.joined_at, left_at: m.left_at }));
    out.status_history = all(
      `SELECT h.*, u.full_name AS actor_name FROM status_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.project_id = ? ORDER BY h.created_at`,
      [p.id]
    ).map(h => ({ ...h, actor_name: blind ? undefined : h.actor_name }));
  }
  return out;
}

export function listProjects(session) {
  const rows = all(`${PROJECT_SELECT} ORDER BY p.created_at DESC`);
  return rows.filter(p => canRead(session, p)).map(p => serializeProject(p, session, { detail: true }));
}

// ---------------------------------------------------------------------------
// Plan de trabajo
// ---------------------------------------------------------------------------
export function serializeDeliverable(d, activityDue) {
  const evidence = fromJson(d.evidence_document_ids, []);
  let status = d.status;
  if (status === 'Pending' && d.due_date < today()) status = 'Overdue'; // FR-024
  return { id: d.id, activity_id: d.activity_id, code: d.code, name: d.name, description: d.description, due_date: d.due_date ?? activityDue, status, evidence_document_ids: evidence };
}

export function listActivities(projectId) {
  return all(
    `SELECT a.*, u.full_name AS responsible_name FROM activities a LEFT JOIN users u ON u.id = a.responsible_user_id
     WHERE a.project_id = ? ORDER BY a.sort_order, a.start_date`,
    [projectId]
  ).map(a => ({
    id: a.id,
    project_id: a.project_id,
    name: a.name,
    description: a.description,
    responsible_user_id: a.responsible_user_id,
    responsible_name: a.responsible_name,
    weight: a.weight,
    weighting_rule_version: a.weighting_rule_version,
    progress: a.progress,
    start_date: a.start_date,
    due_date: a.due_date,
    is_overdue: a.progress < 100 && a.due_date < today(),
    deliverables: all('SELECT * FROM deliverables WHERE activity_id = ? ORDER BY code', [a.id]).map(d => serializeDeliverable(d, a.due_date)),
  }));
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------
export function serializeDocument(doc) {
  const versions = all(
    `SELECT v.*, u.full_name AS author_name FROM document_versions v LEFT JOIN users u ON u.id = v.author_id
     WHERE v.document_id = ? ORDER BY v.version_no`,
    [doc.id]
  ).map(v => ({
    id: v.id,
    document_id: v.document_id,
    version_no: v.version_no,
    sha256: v.sha256,
    mime: v.mime,
    size_bytes: v.size_bytes,
    author_id: v.author_id,
    author_name: v.author_name,
    change_note: v.change_note,
    created_at: v.created_at,
    download_url: `/api/v1/documents/versions/${v.id}/download`,
  }));
  return { id: doc.id, project_id: doc.project_id, name: doc.name, type: doc.type, obsolete_reason: doc.obsolete_reason, versions };
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
export function serializeProduct(r) {
  return {
    id: r.id,
    project_id: r.project_id,
    project_code: r.project_code,
    type: r.type,
    title: r.title,
    authors: r.authors,
    product_date: r.product_date,
    venue: r.venue,
    doi_or_url: r.doi_or_url,
    status: r.status,
    evidence_document_id: r.evidence_document_id,
    evidence_filename: r.evidence_filename ?? undefined,
    validated_at: r.validated_at,
    validator_id: r.validator_id,
    validator_name: r.validator_name ?? undefined,
  };
}

export const PRODUCT_SELECT = `
  SELECT pr.*, p.code AS project_code, v.full_name AS validator_name
  FROM products pr
  JOIN projects p ON p.id = pr.project_id
  LEFT JOIN users v ON v.id = pr.validator_id`;

// ---------------------------------------------------------------------------
// Evaluaciones
// ---------------------------------------------------------------------------
export function serializeAssignment(a, { revealReviewer = false } = {}) {
  const e = get('SELECT * FROM evaluations WHERE assignment_id = ?', [a.id]);
  return {
    id: a.id,
    project_id: a.project_id,
    reviewer_id: revealReviewer ? a.reviewer_id : undefined,
    reviewer_name: revealReviewer ? userName(a.reviewer_id) : undefined,
    reviewer_alias: a.reviewer_alias,
    due_at: a.due_at,
    has_conflict_of_interest: Boolean(a.has_conflict_of_interest),
    conflict_reason: revealReviewer ? a.conflict_reason : undefined,
    evaluation: e
      ? {
          id: e.id,
          assignment_id: e.assignment_id,
          recommendation: e.recommendation,
          comments: e.comments,
          total_score: e.total_score,
          rubric_scores: fromJson(e.rubric_scores, []),
          submitted_at: e.submitted_at,
        }
      : null,
  };
}
