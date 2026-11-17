import { SystemRoleCode } from '../types/domain';

/**
 * Módulo de Seguridad y Protección en el Cliente (A5 / BASE.md 4).
 * Maneja sanitización de entradas, enmascaramiento de datos personales y validaciones criptográficas.
 */

/**
 * Sanitiza cadenas de entrada para prevenir Cross-Site Scripting (XSS).
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Enmascara direcciones de correo electrónico para resguardo en bitácoras o vistas públicas.
 * Ej: roberto.mendoza@urpmp.edu.pe -> r***a@urpmp.edu.pe
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

/**
 * Valida si una cadena cumple con el formato hexadecimal de un hash criptográfico SHA-256 (64 caracteres).
 */
export function isValidSha256(hash: string): boolean {
  if (!hash) return false;
  const sha256Regex = /^[a-f0-9]{64}$/i;
  return sha256Regex.test(hash);
}

/**
 * Matriz granular de permisos por acción conforme a la Tabla 8.3 de A3 y BR-010.
 */
export type PermissionAction =
  | 'create_project'
  | 'submit_project'
  | 'evaluate_project'
  | 'assign_reviewers'
  | 'validate_product'
  | 'approve_closure'
  | 'vote_committee'
  | 'manage_corpus'
  | 'view_audit_log'
  | 'edit_parameters';

export function hasPermission(
  role: SystemRoleCode,
  action: PermissionAction
): boolean {
  const permissions: Record<SystemRoleCode, string[]> = {
    researcher: ['create_project', 'submit_project', 'submit_deliverable'],
    student_researcher: ['submit_deliverable'],
    research_coordinator: [
      'assign_reviewers',
      'validate_product',
      'approve_closure',
      'manage_corpus',
      'view_all_projects',
    ],
    committee_member: ['evaluate_project', 'vote_committee'],
    department_coordinator: ['view_dept_reports'],
    university_authority: ['view_aggregate_dashboards'],
    administrator: ['view_audit_log', 'edit_parameters', 'manage_users', 'manage_catalogs'],
  };

  return permissions[role]?.includes(action) ?? false;
}

/**
 * Genera un token CSRF impredecible (128 bits) con el CSPRNG del navegador.
 * Antes el token era una constante escrita en el código ('csrf-tok-urpmp-...').
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'csrf-tok-' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifica el token CSRF de una operación mutable (POST, PATCH, DELETE)
 * comparándolo EXACTAMENTE contra el token emitido para la sesión.
 * Antes bastaba con que empezara por 'csrf-tok-', así que cualquier valor inventado pasaba.
 * La comparación es de tiempo constante para no filtrar información por temporización.
 */
export function validateCsrfHeader(token: string | undefined | null, expected: string | undefined | null): boolean {
  if (!token || !expected) return false;
  if (!token.startsWith('csrf-tok-') || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Devuelve la URL solo si es segura para usarse en un href (http/https o un DOI).
 * Bloquea esquemas peligrosos como javascript:, data: o vbscript: que permitirían XSS
 * al hacer clic en el enlace de un producto científico.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^10\.\d{4,9}\/\S+$/.test(value)) {
    return `https://doi.org/${value}`;
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.href;
    }
  } catch {
    // No es una URL absoluta (p. ej. "Expediente Nº 001942-2026/DIN"): se muestra como texto.
  }
  return null;
}

/** Extensiones de archivo permitidas para la gestión documental. */
export const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'csv', 'txt'] as const;

/** Tamaño máximo de carga (FR-025, NFR-013). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Valida el nombre de un archivo a cargar: sin rutas (../, /, \), sin caracteres de control,
 * longitud acotada y con una extensión de la lista blanca (evita .html, .svg, .exe, .js, etc.).
 * Devuelve un mensaje de error o null si es válido.
 */
export function validateUploadFileName(name: string | null | undefined): string | null {
  if (!name || !name.trim()) return 'Debe indicar el nombre del archivo.';
  const value = name.trim();
  if (value.length > 150) return 'El nombre del archivo no puede superar los 150 caracteres.';
  if (/[\\/\x00-\x1f<>:"|?*]/.test(value) || value.includes('..')) {
    return 'El nombre del archivo contiene caracteres no permitidos (rutas, comillas o caracteres de control).';
  }
  const ext = value.includes('.') ? value.split('.').pop()!.toLowerCase() : '';
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Tipo de archivo no permitido. Extensiones aceptadas: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`;
  }
  return null;
}
