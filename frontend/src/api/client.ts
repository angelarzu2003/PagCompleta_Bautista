/**
 * Cliente HTTP de la API REST (/api/v1) de URPMP.
 * Implementa las convenciones de A5 (Sección 6 y 10):
 * - Sesión en cookie HttpOnly emitida por el servidor (el navegador nunca ve el token de sesión)
 * - Token CSRF por sesión enviado en la cabecera X-CSRF-Token en toda mutación
 * - Control de concurrencia optimista con row_version (409 Conflict)
 * - Errores estándar { error: { code, message, fields }, request_id } (401, 403, 404, 409, 413, 415, 422, 503)
 *
 * Toda la autorización y las reglas de negocio se aplican en el servidor; este módulo solo transporta.
 */

import {
  Project,
  UserProfile,
  SystemRoleCode,
  Activity,
  Deliverable,
  ProjectDocument,
  ProjectDocumentType,
  ResearchProduct,
  AppNotification,
  RegulationDocument,
  AuditEvent,
  SystemSetting,
  AIPreCheckResult,
  AIProposalSummary,
  AIInteraction,
  ApiErrorResponse,
  ApiErrorCode,
  CatalogItem,
  ObservationSubsanationItem,
  ReviewAssignment,
  ProjectClosureChecklist,
  RubricCriterionScore,
  EvaluationDecisionType,
  ProjectStatus,
} from '../types/domain';

const BASE_URL: string = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

class ApiClientError extends Error {
  code: ApiErrorCode;
  fields?: { field: string; message: string }[];
  requestId: string;
  statusCode: number;

  constructor(statusCode: number, code: ApiErrorCode, message: string, fields?: { field: string; message: string }[], requestId?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId || `req-${Date.now().toString(36)}`;
  }

  toResponse(): ApiErrorResponse {
    return {
      error: { code: this.code, message: this.message, fields: this.fields || [] },
      request_id: this.requestId,
    };
  }
}

export { ApiClientError };

// ---------------------------------------------------------------------------
// Tipos de respuesta adicionales
// ---------------------------------------------------------------------------
export interface SessionResponse {
  user: UserProfile;
  active_role: SystemRoleCode;
  csrf_token: string;
  expires_at: string;
  idle_timeout_minutes: number;
  role_switcher_enabled: boolean;
}

export interface LoginAccount {
  id: string;
  email: string;
  full_name: string;
  title?: string;
  department_name?: string;
  roles: SystemRoleCode[];
}

export type Catalogs = Record<'departments' | 'research_areas' | 'research_lines' | 'project_types' | 'deliverable_types', CatalogItem[]>;

export interface ReviewAssignmentWithProject extends ReviewAssignment {
  reviewer_name?: string;
  project: Project;
  ai_summary: { summary_text: string; word_count: number } | null;
}

export interface CommitteeVote {
  id: string;
  name: string;
  role: string;
  vote: 'favor' | 'contra' | 'abstencion' | null;
  signatureHash: string | null;
  votedAt: string | null;
  is_current_user: boolean;
}

export interface CommitteeSession {
  id: string;
  project_id: string;
  project_code: string;
  anonymous_code: string;
  project_title: string;
  session_number: string;
  required_quorum: number;
  resolution_number: string | null;
  resolution_issued_at: string | null;
  resolution_hash: string | null;
  observations: ObservationSubsanationItem[];
  votes: CommitteeVote[];
}

export interface ReportSummary {
  generated_at: string;
  totals: {
    projects: number;
    in_progress: number;
    approved_funding: number;
    requested_funding: number;
    validated_products: number;
    overdue_deliverables: number;
    average_progress: number;
  };
  by_status: Record<string, number>;
  by_department: Record<string, { projects: number; funding: number }>;
  products_by_type: Record<string, number>;
  projects: Project[];
  products: ResearchProduct[];
  overdue: { project_id: string; project_code: string; project_title: string; activity: string; code: string; name: string; due_date: string; responsible: string }[];
}

export interface PublicVerification {
  cvd_code: string;
  anonymous_code: string;
  evaluation_score: number | null;
  valid: boolean;
  project_code: string;
  project_title: string;
  department_name: string;
  pi_full_name: string;
  pi_masked_national_id: string;
  resolution_number: string | null;
  approved_at: string | null;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  requested_funding: number;
  budget_breakdown: { phase_number: number; name: string; percentage: number; amount_pen: number }[];
  document_hash: string;
}

export interface AuditChainStatus {
  valid: boolean;
  total: number;
  broken_at: string | null;
  head_hash?: string;
}

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------
let csrfToken = '';
let onUnauthorized: (() => void) | null = null;

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body, headers: Record<string, string> = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const h: Record<string, string> = { Accept: 'application/json', ...headers };
  if (body !== undefined && !isForm) h['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) h['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: h,
      credentials: 'same-origin',
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(503, 'SERVICE_UNAVAILABLE', 'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución.');
  }

  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = (payload as ApiErrorResponse | null)?.error;
    const e = new ApiClientError(
      res.status,
      (err?.code as ApiErrorCode) || (res.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'UNPROCESSABLE_ENTITY'),
      err?.message || `Error ${res.status} en la petición.`,
      err?.fields,
      (payload as ApiErrorResponse | null)?.request_id
    );
    if (res.status === 401 && onUnauthorized && !path.startsWith('/auth/')) onUnauthorized();
    throw e;
  }
  return payload as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: Body) => request<T>('POST', path, body ?? {});
const patch = <T>(path: string, body?: Body, headers?: Record<string, string>) => request<T>('PATCH', path, body ?? {}, headers);
const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && s.set(k, String(v)));
  const str = s.toString();
  return str ? `?${str}` : '';
};

/** Descarga un archivo binario (con cookies de sesión) y lo guarda en el equipo del usuario. */
async function download(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'same-origin' });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiClientError(res.status, payload?.error?.code || 'NOT_FOUND', payload?.error?.message || 'No se pudo descargar el archivo.');
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  // ==========================================================================
  // SESIÓN
  // ==========================================================================
  getCsrfToken(): string {
    return csrfToken;
  },
  setCsrfToken(token: string): void {
    csrfToken = token;
  },
  setUnauthorizedHandler(fn: (() => void) | null): void {
    onUnauthorized = fn;
  },

  async getLoginAccounts(): Promise<LoginAccount[]> {
    return get('/auth/accounts');
  },
  async login(provider: string, email: string): Promise<SessionResponse> {
    const s = await post<SessionResponse>('/auth/login', { provider, email });
    csrfToken = s.csrf_token;
    return s;
  },
  async getSession(): Promise<SessionResponse | null> {
    try {
      const s = await get<SessionResponse>('/auth/session');
      csrfToken = s.csrf_token;
      return s;
    } catch (e) {
      if (e instanceof ApiClientError && e.statusCode === 401) return null;
      throw e;
    }
  },
  async logout(): Promise<void> {
    try {
      await post('/auth/logout');
    } finally {
      csrfToken = '';
    }
  },
  async switchRole(role: SystemRoleCode): Promise<SessionResponse> {
    const s = await post<SessionResponse>('/auth/switch-role', { role });
    csrfToken = s.csrf_token;
    return s;
  },
  async getMe(): Promise<UserProfile> {
    return get('/me');
  },
  async acceptPrivacy(): Promise<UserProfile> {
    return post('/me/privacy-acceptance');
  },

  // ==========================================================================
  // CATÁLOGOS
  // ==========================================================================
  async getCatalogs(includeInactive = false): Promise<Catalogs> {
    return get(`/catalogs${includeInactive ? '?all=1' : ''}`);
  },
  async createCatalogItem(catalog_type: string, name: string, parent_id?: string): Promise<CatalogItem> {
    return post('/admin/catalogs', { catalog_type, name, parent_id });
  },
  async updateCatalogItem(id: string, data: { name?: string; active?: boolean }): Promise<CatalogItem> {
    return patch(`/admin/catalogs/${encodeURIComponent(id)}`, data);
  },

  // ==========================================================================
  // PROYECTOS (/api/v1/projects)
  // ==========================================================================
  async getProjects(): Promise<Project[]> {
    return get('/projects');
  },
  async getProjectById(id: string): Promise<Project> {
    return get(`/projects/${encodeURIComponent(id)}`);
  },
  async createProject(data: Record<string, unknown>): Promise<Project> {
    return post("/projects", data);
  },
  async updateProject(id: string, updates: Partial<Project> & Record<string, unknown>, expectedVersion: number): Promise<Project> {
    return patch(`/projects/${encodeURIComponent(id)}`, { ...updates, row_version: expectedVersion }, { 'If-Match': String(expectedVersion) });
  },
  async submitProject(id: string, currentVersion: number): Promise<Project> {
    return post(`/projects/${encodeURIComponent(id)}/submit`, { row_version: currentVersion });
  },
  async transitionProject(id: string, to_status: ProjectStatus, justification: string, row_version?: number): Promise<Project> {
    return post(`/projects/${encodeURIComponent(id)}/transitions`, { to_status, justification, row_version });
  },
  async getClosureChecklist(id: string): Promise<ProjectClosureChecklist> {
    return get(`/projects/${encodeURIComponent(id)}/closure-checklist`);
  },

  // ==========================================================================
  // ACTIVIDADES Y ENTREGABLES
  // ==========================================================================
  async getActivities(projectId: string): Promise<Activity[]> {
    return get(`/projects/${encodeURIComponent(projectId)}/activities`);
  },
  async updateActivityProgress(activityId: string, progress: number, comment?: string): Promise<Activity> {
    return patch(`/activities/${encodeURIComponent(activityId)}/progress`, { progress, comment });
  },
  async submitDeliverable(deliverableId: string, evidenceDocIds: string[]): Promise<Deliverable> {
    return post(`/deliverables/${encodeURIComponent(deliverableId)}/submit`, { evidence_document_ids: evidenceDocIds });
  },

  // ==========================================================================
  // DOCUMENTOS Y VERSIONADO
  // ==========================================================================
  async getDocuments(projectId: string): Promise<ProjectDocument[]> {
    return get(`/projects/${encodeURIComponent(projectId)}/documents`);
  },
  async uploadDocument(projectId: string, file: File, type: ProjectDocumentType, changeNote: string): Promise<ProjectDocument> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('type', type);
    form.append('change_note', changeNote || '');
    return post(`/projects/${encodeURIComponent(projectId)}/documents`, form);
  },
  async markDocumentObsolete(documentId: string, reason: string): Promise<ProjectDocument> {
    return post(`/documents/${encodeURIComponent(documentId)}/obsolete`, { reason });
  },
  async downloadDocumentVersion(versionId: string, fallbackName = 'documento'): Promise<void> {
    return download(`/documents/versions/${encodeURIComponent(versionId)}/download`, fallbackName);
  },

  // ==========================================================================
  // PRODUCTOS CIENTÍFICOS
  // ==========================================================================
  async getProducts(projectId?: string): Promise<ResearchProduct[]> {
    return get(`/products${qs({ project_id: projectId })}`);
  },
  async createProduct(data: Partial<ResearchProduct>, evidence?: File | null): Promise<ResearchProduct> {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => v !== undefined && v !== null && form.append(k, String(v)));
    if (evidence) form.append('evidence', evidence, evidence.name);
    return post('/products', form);
  },
  async validateProduct(productId: string): Promise<ResearchProduct> {
    return post(`/products/${encodeURIComponent(productId)}/validate`);
  },

  // ==========================================================================
  // OBSERVACIONES, EVALUACIÓN Y DICTAMEN COLEGIADO
  // ==========================================================================
  async getObservationProjects(): Promise<Project[]> {
    return get('/observations/pending-projects');
  },
  async getObservations(projectId: string): Promise<ObservationSubsanationItem[]> {
    return get(`/projects/${encodeURIComponent(projectId)}/observations`);
  },
  async updateObservation(id: string, data: Partial<ObservationSubsanationItem>): Promise<ObservationSubsanationItem> {
    return patch(`/observations/${encodeURIComponent(id)}`, data as Record<string, unknown>);
  },
  async getProjectEvaluations(projectId: string): Promise<ReviewAssignment[]> {
    return get(`/projects/${encodeURIComponent(projectId)}/evaluations`);
  },
  async getReviewAssignments(): Promise<ReviewAssignmentWithProject[]> {
    return get('/reviews/assignments');
  },
  async submitEvaluation(
    assignmentId: string,
    data: { recommendation: EvaluationDecisionType; comments: string; rubric_scores: Pick<RubricCriterionScore, 'criterion_id' | 'score' | 'qualitative_justification'>[] }
  ): Promise<ReviewAssignment> {
    return post(`/reviews/assignments/${encodeURIComponent(assignmentId)}/evaluation`, data);
  },
  async declareConflict(assignmentId: string, reason: string): Promise<ReviewAssignment> {
    return post(`/reviews/assignments/${encodeURIComponent(assignmentId)}/conflict`, { reason });
  },
  async getCommitteeSessions(): Promise<CommitteeSession[]> {
    return get('/committee/sessions');
  },
  async castCommitteeVote(sessionId: string, vote: 'favor' | 'contra' | 'abstencion'): Promise<CommitteeSession> {
    return post(`/committee/sessions/${encodeURIComponent(sessionId)}/vote`, { vote });
  },
  async issueCollegiateResolution(sessionId: string): Promise<CommitteeSession> {
    return post(`/committee/sessions/${encodeURIComponent(sessionId)}/resolution`);
  },

  // ==========================================================================
  // ASISTENCIA IA (AIR-001..014)
  // ==========================================================================
  async askNormativeAssistant(question: string): Promise<AIInteraction> {
    return post('/ai/normative-assistant', { question });
  },
  async getAIInteractions(): Promise<AIInteraction[]> {
    return get('/ai/interactions');
  },
  async rateAIInteraction(id: string, rating: boolean, comment?: string): Promise<AIInteraction> {
    return post(`/ai/interactions/${encodeURIComponent(id)}/rating`, { rating, comment });
  },
  async runAIPreCheck(projectId: string): Promise<AIPreCheckResult> {
    return post('/ai/precheck', { project_id: projectId });
  },
  async runAIPreCheckDraft(draft: Record<string, unknown>): Promise<AIPreCheckResult> {
    return post('/ai/precheck', { draft });
  },
  async getAIProposalSummary(projectId: string): Promise<AIProposalSummary> {
    return get(`/projects/${encodeURIComponent(projectId)}/ai/summary`);
  },
  async getRegulations(): Promise<(RegulationDocument & { section_count?: number })[]> {
    return get('/regulations');
  },
  async createRegulation(data: { title: string; version: string; effective_date?: string; content: string }): Promise<RegulationDocument> {
    return post('/regulations', data);
  },
  async retireRegulation(id: string): Promise<RegulationDocument> {
    return post(`/regulations/${encodeURIComponent(id)}/retire`);
  },

  // ==========================================================================
  // NOTIFICACIONES, AUDITORÍA, USUARIOS Y AJUSTES
  // ==========================================================================
  async getNotifications(): Promise<AppNotification[]> {
    return get('/notifications');
  },
  async markNotificationRead(id: string): Promise<void> {
    return post(`/notifications/${encodeURIComponent(id)}/read`);
  },
  async markAllNotificationsRead(): Promise<void> {
    return post('/notifications/read-all');
  },
  async getAuditEvents(): Promise<AuditEvent[]> {
    return get('/audit-events');
  },
  async verifyAuditChain(): Promise<AuditChainStatus> {
    return get('/audit-events/verify');
  },
  async getUsers(): Promise<UserProfile[]> {
    return get('/admin/users');
  },
  async updateUser(id: string, data: { roles?: SystemRoleCode[]; active?: boolean }): Promise<UserProfile> {
    return patch(`/admin/users/${encodeURIComponent(id)}`, data);
  },
  async createUser(data: { email: string; full_name: string; department_id: string; roles: SystemRoleCode[]; title?: string }): Promise<UserProfile> {
    return post('/admin/users', data);
  },
  async getSettings(): Promise<SystemSetting[]> {
    return get('/settings');
  },
  async updateSetting(key: string, value: number): Promise<SystemSetting> {
    return patch(`/settings/${encodeURIComponent(key)}`, { value });
  },

  // ==========================================================================
  // REPORTES Y VERIFICACIÓN PÚBLICA
  // ==========================================================================
  async getReportSummary(filters: { department_id?: string; year?: string }): Promise<ReportSummary> {
    return get(`/reports/summary${qs(filters)}`);
  },
  async exportReport(kind: string, format: 'pdf' | 'csv', filters: { department_id?: string; year?: string }): Promise<void> {
    return download(`/reports/export${qs({ kind, format, ...filters })}`, `reporte_${kind}.${format}`);
  },
  async verifyPublic(cvd: string): Promise<PublicVerification> {
    return get(`/public/verify/${encodeURIComponent(cvd)}`);
  },
  async downloadPublicCertificate(cvd: string): Promise<void> {
    return download(`/public/verify/${encodeURIComponent(cvd)}/certificate.pdf`, `constancia_${cvd}.pdf`);
  },
};
