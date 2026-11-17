/**
 * ESPECIFICACIÓN DE TIPOS DE DOMINIO Y CONTRATOS DE API — PLATAFORMA URPMP
 * Basado en los entregables oficiales A3 (v1.1), A4, A5 y Auditoría de Fase 0.
 * Stack: React 18 + TypeScript Strict + API REST (/api/v1)
 */

// ============================================================================
// 1. PRIMITIVAS Y CONVENCIONES BASE (A5 Sección 5 y 6)
// ============================================================================

/** Identificador único universal (UUID v4) */
export type UUID = string;

/** Fecha y hora en formato ISO 8601 UTC (ej. "2026-10-06T14:30:00Z") */
export type ISODateTimeUTC = string;

/** Fecha calendario en formato ISO 8601 (ej. "2026-10-06") */
export type ISODate = string;

/** Hash criptográfico SHA-256 en formato hexadecimal */
export type SHA256Hash = string;

/** Estado de ciclo de vida de peticiones asíncronas en formularios y vistas (Fase 0) */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// 2. ROLES, PERMISOS Y AUTENTICACIÓN SSO (FR-001..005, BR-001, BR-010, BR-012)
// ============================================================================

/**
 * Los 7 roles globales del sistema definidos en A3 (FR-004, Tabla 8.3) y A5.
 * Un usuario puede tener uno o múltiples roles asignados.
 */
export type SystemRoleCode =
  | 'researcher'              // Investigador Principal (PI)
  | 'student_researcher'      // Estudiante Investigador
  | 'research_coordinator'    // Coordinador de Investigación
  | 'committee_member'        // Miembro del Comité Evaluador
  | 'department_coordinator'  // Coordinador de Departamento (solo lectura no confidencial de su depto.)
  | 'university_authority'    // Autoridad Universitaria (solo reportes/dashboards agregados)
  | 'administrator';          // Administrador del Sistema (sin acceso a expedientes confidenciales)

/**
 * Roles permitidos para miembros internos de un proyecto (FR-011, BR-001, BR-012).
 * El Investigador Principal (PI) es único y se almacena en `Project.pi_user_id`.
 */
export type ProjectMemberRole =
  | 'co_investigator'
  | 'student_researcher'
  | 'collaborator';

/** Proveedores de identidad institucionales soportados en el acceso SSO (CON-002) */
export type IdentityProvider = 'microsoft_entra' | 'google_workspace' | 'saml_institutional';

export interface Role {
  readonly code: SystemRoleCode;
  readonly name: string;
}

/**
 * Entidad `user_profile` (A5 Tabla 5, FR-002, BR-015).
 * PROHIBIDO almacenar o manejar contraseñas locales (CON-002).
 */
export interface UserProfile {
  readonly id: UUID;
  readonly institutional_subject: string;
  email: string;
  full_name: string;
  title?: string | null;
  department_id: UUID;
  department_name?: string;
  roles: SystemRoleCode[];
  active: boolean;
  /** En vistas públicas se enmascara obligatoriamente como "***.***.342" (NFR-009, Fase 0) */
  masked_national_id?: string;
  privacy_accepted_at?: ISODateTimeUTC | null;
}

export interface AuthSession {
  readonly user: UserProfile;
  readonly active_role: SystemRoleCode;
  readonly csrf_token: string;
  /** Expiración tras 30 minutos de inactividad (NFR-004) */
  readonly expires_at: ISODateTimeUTC;
}

// ============================================================================
// 3. CATÁLOGOS INSTITUCIONALES (FR-006, A5 Tabla 5)
// ============================================================================

export type CatalogType =
  | 'departments'
  | 'research_areas'
  | 'research_lines'
  | 'project_types'
  | 'deliverable_types';

/** Entidades `department`, `research_area`, `research_line`, `project_type`, `deliverable_type` */
export interface CatalogItem {
  readonly id: UUID;
  name: string;
  active: boolean;
  parent_id?: UUID | null; // Ej. Línea de investigación vinculada a un Área
}

// ============================================================================
// 4. MÁQUINA DE ESTADOS DEL PROYECTO Y TRANSICIONES (FR-014, BR-005, Tabla 8.2)
// ============================================================================

/**
 * Estados oficiales del ciclo de vida del proyecto (Tabla 8.2 de A3 y Sección 7 de A5).
 * 'Rejected', 'Closed' y 'Cancelled' son estados finales de solo lectura.
 */
export type ProjectStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under review'
  | 'Approved'
  | 'Rejected'
  | 'Changes requested'
  | 'In progress'
  | 'Suspended'
  | 'Closure requested'
  | 'Closed'
  | 'Cancelled';

export const FINAL_PROJECT_STATUSES: readonly ProjectStatus[] = [
  'Rejected',
  'Closed',
  'Cancelled',
] as const;

// ============================================================================
// 5. PROYECTOS, VERSIONES Y MIEMBROS (FR-007..013, BR-001, BR-004, OI-003)
// ============================================================================

export interface SpecificObjective {
  readonly id: string; // Ej. "OE1", "OE2", "OE3" (mínimo 3 en el Wizard de Fase 0)
  order: number;
  description: string;
}

export interface BudgetPhaseBreakdown {
  readonly phase_number: 1 | 2 | 3;
  readonly name: string;
  readonly percentage: number; // Ej. 40%, 40%, 20% (Suma = 100%)
  readonly amount_pen: number; // Ej. 63000, 63000, 31500 (Suma = 157500.00 PEN)
  readonly amount_usd?: number;
}

/** Entidad `project` (A5 Tabla 5) */
export interface Project {
  readonly id: UUID;
  readonly code: string; // Ej. "PID-2023-CRH-019"
  readonly anonymous_code?: string; // Ej. "#PROP-2025-084-ANON" para evaluación ciega
  title: string;
  pi_user_id: UUID;
  pi_full_name?: string;
  department_id: UUID;
  department_name?: string;
  area_id: UUID;
  area_name?: string;
  line_id: UUID;
  line_name?: string;
  type_id: UUID;
  type_name?: string;
  status: ProjectStatus;
  /**
   * Si `confidential === true`, su contenido solo es visible para miembros, revisores
   * asignados y coordinación, y queda EXCLUIDO de procesamiento IA (BR-014, NFR-010, AIR-011).
   */
  confidential: boolean;
  start_date: ISODate;
  end_date: ISODate; // Restricción CHECK: end_date >= start_date (FR-009)
  requested_funding: number; // Restricción CHECK: >= 0
  overall_progress?: number; // Promedio ponderado 0-100 (FR-023)
  /** Entero de control de concurrencia optimista para PATCH y POST /submit (A5 Sección 6) */
  row_version: number;
  current_version?: ProjectVersion;
  budget_breakdown?: BudgetPhaseBreakdown[];
  /** Número de resolución de adjudicación y Código de Verificación Digital público (si fue aprobado) */
  resolution_number?: string | null;
  cvd_code?: string | null;
  members?: ProjectMember[];
  status_history?: StatusHistoryEntry[];
  created_at?: ISODateTimeUTC;
  updated_at?: ISODateTimeUTC;
}

/**
 * Entidad `project_version` (A5 Tabla 5, FR-008, FR-012, BR-004).
 * Inmutable: jamás se sobrescribe una versión previa.
 */
export interface ProjectVersion {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly version_no: number;
  readonly summary: string; // Máximo 500 palabras en validación de UI
  readonly general_objective?: string;
  readonly specific_objectives?: SpecificObjective[];
  readonly objectives: string;
  readonly justification: string;
  readonly methodology: string;
  readonly funding_source: string | null;
  readonly created_at: ISODateTimeUTC;
  readonly created_by: UUID;
}

/**
 * Entidad `project_member` (A5 Tabla 5, FR-011, BR-012).
 * Cuando un miembro se retira, se registra `left_at` conservando su historial.
 */
export interface ProjectMember {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly user_id: UUID;
  readonly full_name: string;
  readonly email: string;
  project_role: ProjectMemberRole;
  readonly joined_at: ISODateTimeUTC;
  left_at: ISODateTimeUTC | null;
}

/** Solicitud de modificación de proyecto aprobado (`FR-012`, `POST /projects/:id/modification-requests`) */
export interface ModificationRequest {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly requested_by: UUID;
  readonly motive: string;
  readonly proposed_changes: Partial<Pick<ProjectVersion, 'summary' | 'objectives' | 'justification' | 'methodology' | 'funding_source'>> &
    Partial<Pick<Project, 'title' | 'end_date' | 'requested_funding'>>;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly coordinator_resolution_comment?: string;
  readonly created_at: ISODateTimeUTC;
  readonly resolved_at?: ISODateTimeUTC | null;
}

// ============================================================================
// 6. EVALUACIÓN, DECISIONES E HISTORIAL INMUTABLE (FR-015..019, BR-003, BR-011)
// ============================================================================

export type EvaluationDecisionType = 'approve' | 'reject' | 'request_changes';

/** Entidad `review_assignment` (A5 Tabla 5, FR-015) */
export interface ReviewAssignment {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly reviewer_id: UUID;
  readonly reviewer_alias?: string; // Ej. "Revisor Par #REV-7734"
  readonly due_at: ISODateTimeUTC; // Fecha límite obligatoria (FR-015)
  readonly has_conflict_of_interest?: boolean; // Excluido por BR-011
  readonly evaluation?: Evaluation | null;
}

export interface RubricCriterionScore {
  readonly criterion_id: string;
  readonly criterion_name: string;
  readonly max_score: number;
  score: number;
  qualitative_justification: string; // Justificación obligatoria por criterio (Fase 0)
}

/** Entidad `evaluation` (A5 Tabla 5, FR-016, BR-003) */
export interface Evaluation {
  readonly id: UUID;
  readonly assignment_id: UUID;
  readonly recommendation: EvaluationDecisionType;
  readonly comments: string;
  readonly total_score?: number; // Ej. 91.00 / 100 Puntos
  readonly rubric_scores?: RubricCriterionScore[];
  readonly submitted_at: ISODateTimeUTC;
}

/** Entidades `project_decision` y `status_history` (A5 Tabla 5, FR-017, FR-018) */
export interface StatusHistoryEntry {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly actor_id: UUID;
  readonly actor_name?: string;
  readonly from_status: ProjectStatus | null;
  readonly to_status: ProjectStatus;
  readonly justification: string; // Obligatoria en decisiones y transiciones críticas
  readonly created_at: ISODateTimeUTC;
  readonly evaluation_id: UUID | null;
}

/** Estructura para Subsanación de Observaciones y Redline Diff (RF-08, Fase 0) */
export interface ObservationSubsanationItem {
  readonly id: UUID;
  readonly section_name: string;
  readonly original_text_v1: string;
  corrected_text_v2: string;
  researcher_justification: string;
  evidence_document_id?: UUID | null;
  resolved: boolean;
}

// ============================================================================
// 7. PLAN DE TRABAJO, ACTIVIDADES Y ENTREGABLES (FR-020..024, OI-007)
// ============================================================================

export type DeliverableStatus = 'Pending' | 'Submitted' | 'Overdue' | 'Approved' | 'Cancelled';

/** Entidad `activity` (A5 Tabla 5, FR-020, FR-023, FR-024) */
export interface Activity {
  readonly id: UUID;
  readonly project_id: UUID;
  name: string;
  description: string;
  responsible_user_id: UUID;
  responsible_name?: string;
  /** Peso validado según regla aprobada en OI-007 (`numeric(7,4)`) */
  weight: number;
  /** Versión de la regla de ponderación utilizada (FR-020) */
  readonly weighting_rule_version: string;
  /** Porcentaje de avance de 0 a 100 (`numeric(5,2)`, FR-021) */
  progress: number;
  start_date: ISODate;
  due_date: ISODate;
  is_overdue: boolean; // FR-024
  deliverables?: Deliverable[];
}

/**
 * Entidad `deliverable` (A5 Tabla 5, FR-022, FR-024).
 * Regla FR-022: No puede marcarse como 'Submitted' sin al menos un documento de evidencia adjunto.
 */
export interface Deliverable {
  readonly id: UUID;
  readonly activity_id: UUID;
  readonly code?: string; // Ej. "H2.2"
  name: string;
  description?: string;
  due_date: ISODate;
  status: DeliverableStatus;
  evidence_document_ids: UUID[]; // Debe tener length >= 1 para permitir POST /deliverables/:id/submit
}

/** Entidad `progress_update` (A5 Tabla 5, FR-021) */
export interface ProgressUpdate {
  readonly id: UUID;
  readonly activity_id: UUID;
  readonly author_id: UUID;
  readonly percent: number; // CHECK: 0 <= percent <= 100
  readonly comment: string;
  readonly evidence_document_id?: UUID | null;
  readonly at: ISODateTimeUTC;
}

// ============================================================================
// 8. GESTIÓN DE DOCUMENTOS VERSIONADOS (FR-025..029, OI-010, BR-004)
// ============================================================================

/** Clasificación obligatoria de documentos según FR-025 */
export type ProjectDocumentType =
  | 'proposal'
  | 'technical_report'
  | 'evidence'
  | 'final_report'
  | 'agreement'
  | 'other';

/** Extensiones y tipos permitidos de hasta 25 MB según FR-025 */
export type AllowedFileExtension = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'png' | 'jpg';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (FR-025)

/**
 * Entidad `project_document` (A5 Tabla 5, FR-025, FR-029).
 * Prohibido eliminar documentos o versiones; solo pueden marcarse como obsoletos con motivo.
 */
export interface ProjectDocument {
  readonly id: UUID;
  readonly project_id: UUID;
  name: string;
  type: ProjectDocumentType;
  obsolete_reason: string | null; // Si no es null, el documento está marcado como "Obsoleto" (FR-029)
  versions: DocumentVersion[];
}

/** Entidad `document_version` (A5 Tabla 5, FR-026) */
export interface DocumentVersion {
  readonly id: UUID;
  readonly document_id: UUID;
  readonly version_no: number; // Entero positivo secuencial
  readonly sha256: SHA256Hash;
  readonly mime: string;
  readonly size_bytes: number; // CHECK: <= 26214400 (25 MB)
  readonly author_id: UUID;
  readonly author_name?: string;
  readonly change_note: string; // Nota de cambio obligatoria al versionar (FR-026)
  readonly created_at: ISODateTimeUTC;
  readonly download_url?: string;
}

// ============================================================================
// 9. PRODUCTOS DE INVESTIGACIÓN Y CIERRE (FR-030..032, FR-044, BR-006, BR-013)
// ============================================================================

/** Los 8 tipos de productos de investigación definidos en FR-030 */
export type ResearchProductType =
  | 'journal_article'
  | 'conference_paper'
  | 'book'
  | 'book_chapter'
  | 'thesis'
  | 'patent'
  | 'software'
  | 'other';

/** Estados editoriales del producto definidos en FR-030 */
export type ResearchProductStatus =
  | 'in_preparation'
  | 'submitted'
  | 'accepted'
  | 'published';

/**
 * Entidad `research_product` (A5 Tabla 5, FR-030..032, BR-013).
 * Regla BR-013: Solo los productos con `validated_at !== null` se cuentan en indicadores institucionales.
 */
export interface ResearchProduct {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly project_code?: string;
  type: ResearchProductType;
  title: string;
  authors: string;
  product_date: ISODate;
  venue: string; // Revista, editorial o congreso
  doi_or_url: string | null;
  status: ResearchProductStatus;
  evidence_document_id?: UUID | null; // FR-031
  evidence_filename?: string;
  readonly validated_at: ISODateTimeUTC | null; // FR-032
  readonly validator_id: UUID | null;
  readonly validator_name?: string;
}

/** Checklist formal de cierre de proyecto (FR-044, BR-006, UC-013) */
export interface ProjectClosureChecklist {
  readonly project_id: UUID;
  readonly final_report_uploaded: boolean;
  readonly all_mandatory_deliverables_resolved: boolean; // Enviados o cancelados formalmente por Coordinación
  readonly research_products_registered: boolean;
  readonly can_approve_closure: boolean; // true solo si BR-006 se satisface por completo
}

// ============================================================================
// 10. NOTIFICACIONES Y COLA TRANSACCIONAL (FR-033..036, A5 Tabla 5)
// ============================================================================

export type NotificationKind =
  | 'due_in_7_days'
  | 'due_in_1_day'
  | 'overdue_today'
  | 'status_changed'
  | 'reviewer_comment'
  | 'proposal_submitted'
  | 'closure_requested'
  | 'evaluation_overdue';

/** Entidad `notification` (A5 Tabla 5, FR-033..036) */
export interface AppNotification {
  readonly id: UUID;
  readonly user_id: UUID;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly message: string;
  readonly project_id?: UUID;
  readonly created_at: ISODateTimeUTC;
  read_at: ISODateTimeUTC | null;
  readonly dedupe_key: string; // Evita notificaciones duplicadas del mismo evento (FR-033)
}

// ============================================================================
// 11. ASISTENTE NORMATIVO IA (RAG) Y BASE DE CONOCIMIENTOS (FR-045, AIR-001..014)
// ============================================================================

export type RegulationStatus = 'active' | 'retired';

/** Entidades `regulation` y `regulation_version` (A5 Tabla 5, FR-045, AIR-004) */
export interface RegulationDocument {
  readonly id: UUID;
  readonly version_id: UUID;
  title: string;
  version: string;
  status: RegulationStatus;
  effective_date: ISODate;
  readonly indexed_at?: ISODateTimeUTC; // Disponible/retirado en <= 30 min (AIR-004)
}

/** Cita verificable de un pasaje normativo recuperado por RAG (AIR-002) */
export interface RegulationSourceCitation {
  readonly regulation_id: UUID;
  readonly document_title: string;
  readonly version: string;
  readonly section: string;
  readonly page: number | string;
  readonly excerpt?: string;
}

/**
 * Entidad `ai_interaction` (A5 Tabla 5, AIR-001..007, A4 Defecto AIR-007 Corregido).
 * PROHIBIDO mostrar porcentajes de certeza jurídica. Siempre incluye aviso no vinculante (AIR-005).
 */
export interface AIInteraction {
  readonly id: UUID;
  readonly user_id: UUID;
  readonly at: ISODateTimeUTC;
  /** Máximo 1,000 caracteres en español (AIR-001) */
  readonly allowed_question: string;
  readonly answer: string;
  readonly is_not_found_fallback: boolean; // true cuando no supera el umbral de relevancia (AIR-003)
  readonly is_out_of_scope_declined: boolean; // true cuando sale de la taxonomía aprobada (AIR-013)
  readonly source_refs: RegulationSourceCitation[];
  readonly advisory_disclaimer: string; // Leyenda obligatoria AIR-005
  rating: boolean | null; // true = Útil, false = No útil / Requiere asesoría (AIR-006)
  rating_comment?: string | null;
  readonly expires_at: ISODateTimeUTC; // Retención de 12 meses sujeta a política (AIR-007)
  readonly restricted_access: boolean;
}

/** Observación individual del Pre-chequeo de Completitud con IA (AI-2: AIR-008, AIR-009, UC-012) */
export interface AIPreCheckObservation {
  readonly section_affected: string;
  readonly issue_detected: string;
  readonly suggestion: string;
  readonly guideline_reference: string;
}

export interface AIPreCheckResult {
  readonly project_id: UUID;
  readonly generated_at: ISODateTimeUTC;
  readonly advisory_notice: string; // No bloquea el envío (AIR-009)
  readonly observations: AIPreCheckObservation[];
}

/** Resumen Ejecutivo de Propuesta para Evaluadores (AI-3: AIR-010, UC-005) */
export interface AIProposalSummary {
  readonly project_id: UUID;
  readonly version_no: number;
  /** Máximo 250 palabras sobre objetivos, metodología, productos y cronograma (AIR-010) */
  readonly summary_text: string;
  readonly word_count: number;
  readonly advisory_notice: string;
  readonly generated_at: ISODateTimeUTC;
}

// ============================================================================
// 12. REPORTES, AUDITORÍA INMUTABLE Y PARÁMETROS (FR-037..043, NFR-008, NFR-019)
// ============================================================================

export type ReportKind =
  | 'projects_by_status'     // FR-037 (PDF / XLSX)
  | 'research_products'      // FR-038 (Solo validados BR-013, PDF / XLSX)
  | 'progress_and_overdue'   // FR-039
  | 'project_record_sheet';  // FR-041 (PDF)

export type ReportExportFormat = 'pdf' | 'xlsx';

export interface ReportFilterParams {
  period_year?: number;
  start_date?: ISODate;
  end_date?: ISODate;
  department_id?: UUID;
  research_area_id?: UUID;
  researcher_id?: UUID;
  status?: ProjectStatus;
  project_id?: UUID;
}

/**
 * Entidad `audit_event` (A5 Tabla 5, FR-042, FR-043, NFR-008).
 * Append-only: ningún rol (incluido el Administrador) puede editar o eliminar entradas.
 * Retención mínima de 5 años con cadena hash de integridad.
 */
export interface AuditEvent {
  readonly id: UUID;
  readonly actor_id: UUID | null;
  readonly actor_name?: string;
  readonly actor_role?: SystemRoleCode;
  readonly at: ISODateTimeUTC;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: UUID;
  readonly metadata: Record<string, unknown>;
  readonly prev_hash: SHA256Hash;
  readonly event_hash: SHA256Hash;
}

/**
 * Parámetros configurables sin cambiar código fuente (NFR-019, `system_setting` en A5 Tabla 5).
 */
export type ConfigurableSettingKey =
  | 'notification.lead_days_warning'    // Por defecto: 7 días
  | 'notification.lead_days_critical'   // Por defecto: 1 día
  | 'ai.rag_relevance_threshold'        // Umbral de relevancia del recuperador RAG
  | 'ai.max_answer_length_chars';       // Longitud máxima de respuesta del asistente

export interface SystemSetting<T = number | string | boolean | Record<string, unknown>> {
  readonly key: ConfigurableSettingKey;
  value: T;
  readonly min_allowed?: number;
  readonly max_allowed?: number;
  readonly approved_by: UUID;
  readonly updated_at: ISODateTimeUTC;
  readonly version: number;
}

// ============================================================================
// 13. CONTRATOS GENÉRICOS DE RED Y ERRORES HTTP (/api/v1 - A5 Sección 6 y 10)
// ============================================================================

export interface PaginationQueryParams {
  page?: number;      // Por defecto: 1
  page_size?: number; // Por defecto: 25, Máximo permitido: 100
  search?: string;
  status?: string;
  period?: string;
}

export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly page: number;
  readonly page_size: number;
  readonly total_items: number;
  readonly total_pages: number;
}

export interface ApiFieldValidationError {
  readonly field: string;   // Nombre exacto del input afectado (FR-009, NFR-015)
  readonly message: string; // Corrección requerida en español
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'           // 401: Sesión vencida o no iniciada
  | 'FORBIDDEN'              // 403: Rol insuficiente o proyecto confidencial
  | 'NOT_FOUND'              // 404: Recurso no encontrado (o enmascaramiento de confidencial)
  | 'CONFLICT'               // 409: Correo duplicado (FR-003) o row_version obsoleto
  | 'PAYLOAD_TOO_LARGE'      // 413: Archivo > 25 MB (FR-025)
  | 'UNSUPPORTED_MEDIA_TYPE' // 415: Extensión no permitida
  | 'UNPROCESSABLE_ENTITY'   // 422: Campos obligatorios faltantes, fechas inválidas o cuota excedida
  | 'SERVICE_UNAVAILABLE';   // 503: SSO, BD, Almacenamiento o LLM temporalmente fuera de servicio

/** Contrato de error estándar devuelto por el servidor Go (A5 Sección 6) */
export interface ApiErrorResponse {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly fields: ApiFieldValidationError[];
  };
  readonly request_id: string;
}
