/**
 * Utilidades compartidas: errores HTTP estándar (A5 Sección 6), matriz de permisos
 * (Tabla 8.3 de A3), sanitización, validación de archivos y bitácora con cadena hash.
 */
import crypto from 'node:crypto';
import { all, get, run, toJson } from './db.js';

export class ApiError extends Error {
  constructor(status, code, message, fields = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const errors = {
  unauthorized: (m = 'Sesión no iniciada o expirada.') => new ApiError(401, 'UNAUTHORIZED', m),
  forbidden: (m = 'Su rol no tiene permisos para realizar esta acción.') => new ApiError(403, 'FORBIDDEN', m),
  notFound: (m = 'El recurso solicitado no fue encontrado.') => new ApiError(404, 'NOT_FOUND', m),
  conflict: m => new ApiError(409, 'CONFLICT', m),
  tooLarge: m => new ApiError(413, 'PAYLOAD_TOO_LARGE', m),
  unsupported: m => new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', m),
  invalid: (m, fields = []) => new ApiError(422, 'UNPROCESSABLE_ENTITY', m, fields),
};

export const nowIso = () => new Date().toISOString();
export const newId = prefix => `${prefix}-${crypto.randomUUID()}`;
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

// ---------------------------------------------------------------------------
// Matriz de permisos por acción (Tabla 8.3 de A3, BR-010)
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS = {
  researcher: ['create_project', 'submit_project', 'submit_deliverable', 'register_product', 'upload_document'],
  student_researcher: ['submit_deliverable', 'upload_document', 'register_product'],
  research_coordinator: [
    'assign_reviewers',
    'validate_product',
    'approve_closure',
    'manage_corpus',
    'view_all_projects',
    'decide_project',
    'upload_document',
    'view_reports',
  ],
  committee_member: ['evaluate_project', 'vote_committee'],
  department_coordinator: ['view_dept_reports', 'view_reports'],
  university_authority: ['view_aggregate_dashboards', 'view_reports'],
  administrator: ['view_audit_log', 'edit_parameters', 'manage_users', 'manage_catalogs'],
};

export const ALL_ROLES = Object.keys(ROLE_PERMISSIONS);

export const hasPermission = (role, action) => ROLE_PERMISSIONS[role]?.includes(action) ?? false;

export const ROLE_LABELS = {
  researcher: 'Investigador Principal',
  student_researcher: 'Estudiante Investigador',
  research_coordinator: 'Coordinación de Investigación',
  committee_member: 'Comité Evaluador',
  department_coordinator: 'Coordinación de Departamento',
  university_authority: 'Autoridad Universitaria',
  administrator: 'Administración del Sistema',
};

// ---------------------------------------------------------------------------
// Sanitización y validación de entrada
// ---------------------------------------------------------------------------

/** Elimina caracteres de control y recorta. El escapado HTML lo hace React al renderizar. */
export function cleanText(value, max = 5000) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\s*\/?\s*script[^>]*>/gi, '')
    .trim()
    .slice(0, max);
}

/** Acepta http(s) o un DOI; rechaza javascript:, data:, vbscript:, etc. */
export function isSafeLink(raw) {
  if (!raw) return true;
  const value = String(raw).trim();
  if (/^10\.\d{4,9}\/\S+$/.test(value)) return true;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return true; // texto libre (p. ej. nº de expediente)
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'csv', 'txt'];

export const MIME_BY_EXT = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  csv: 'text/csv',
  txt: 'text/plain',
};

export function validateUploadFileName(name) {
  if (!name || !String(name).trim()) return 'Debe indicar el nombre del archivo.';
  const value = String(name).trim();
  if (value.length > 150) return 'El nombre del archivo no puede superar los 150 caracteres.';
  if (/[\\/\x00-\x1f<>:"|?*]/.test(value) || value.includes('..')) {
    return 'El nombre del archivo contiene caracteres no permitidos (rutas, comillas o caracteres de control).';
  }
  const ext = value.includes('.') ? value.split('.').pop().toLowerCase() : '';
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return `Tipo de archivo no permitido. Extensiones aceptadas: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`;
  }
  return null;
}

/** Comprobación de "firma mágica" para que un .pdf sea realmente un PDF, etc. */
export function contentMatchesExtension(buffer, ext) {
  if (!buffer || buffer.length === 0) return false;
  const head = buffer.subarray(0, 8);
  const startsWith = bytes => bytes.every((b, i) => head[i] === b);
  switch (ext) {
    case 'pdf':
      return startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'png':
      return startsWith([0x89, 0x50, 0x4e, 0x47]);
    case 'jpg':
    case 'jpeg':
      return startsWith([0xff, 0xd8, 0xff]);
    case 'docx':
    case 'xlsx':
    case 'pptx':
      return startsWith([0x50, 0x4b, 0x03, 0x04]); // ZIP (OOXML)
    case 'csv':
    case 'txt':
      return !buffer.subarray(0, 4096).includes(0x00);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Bitácora de auditoría append-only con cadena hash (FR-042, FR-043, NFR-008)
// ---------------------------------------------------------------------------
export const GENESIS_HASH = '0'.repeat(64);

export function computeEventHash(e) {
  return sha256(
    [e.prev_hash, e.id, e.actor_id ?? '', e.actor_role ?? '', e.at, e.action, e.entity_type, e.entity_id, e.metadata].join('|')
  );
}

export function audit(actor, action, entityType, entityId, metadata = {}, at = nowIso()) {
  const last = get('SELECT event_hash FROM audit_events ORDER BY seq DESC LIMIT 1');
  const event = {
    id: newId('aud'),
    actor_id: actor?.userId ?? null,
    actor_name: actor?.fullName ?? 'Sistema',
    actor_role: actor?.role ?? null,
    at,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: toJson(metadata),
    prev_hash: last?.event_hash ?? GENESIS_HASH,
  };
  event.event_hash = computeEventHash(event);
  run(
    `INSERT INTO audit_events (id, actor_id, actor_name, actor_role, at, action, entity_type, entity_id, metadata, prev_hash, event_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [event.id, event.actor_id, event.actor_name, event.actor_role, event.at, event.action, event.entity_type, event.entity_id, event.metadata, event.prev_hash, event.event_hash]
  );
  return event;
}

/** Recalcula la cadena completa; devuelve el primer evento alterado o null si está íntegra. */
export function verifyAuditChain() {
  const rows = all('SELECT * FROM audit_events ORDER BY seq ASC');
  let prev = GENESIS_HASH;
  for (const r of rows) {
    if (r.prev_hash !== prev || computeEventHash(r) !== r.event_hash) {
      return { valid: false, total: rows.length, broken_at: r.id };
    }
    prev = r.event_hash;
  }
  return { valid: true, total: rows.length, broken_at: null, head_hash: prev };
}

/** Crea una notificación sin duplicados (dedupe_key único por usuario, FR-033). */
export function notify(userId, { kind, title, message, project_id = null, dedupe_key }) {
  run(
    `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, message, project_id, created_at, read_at, dedupe_key)
     VALUES (?,?,?,?,?,?,?,NULL,?)`,
    [newId('notif'), userId, kind, title, message, project_id, nowIso(), dedupe_key || `${kind}-${Date.now()}`]
  );
}
