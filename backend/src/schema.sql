-- Esquema relacional de URPMP (basado en A5 Tabla 5). Idempotente.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  institutional_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  department_id TEXT NOT NULL,
  roles TEXT NOT NULL,                 -- JSON array de SystemRoleCode
  title TEXT,                          -- cargo / función visible
  active INTEGER NOT NULL DEFAULT 1,
  national_id TEXT,                    -- nunca se expone completo
  privacy_accepted_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                 -- token opaco (cookie HttpOnly)
  user_id TEXT NOT NULL,
  active_role TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  catalog_type TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  parent_id TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  anonymous_code TEXT,
  title TEXT NOT NULL,
  pi_user_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  type_id TEXT NOT NULL,
  status TEXT NOT NULL,
  confidential INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL CHECK (end_date >= start_date),
  requested_funding REAL NOT NULL DEFAULT 0 CHECK (requested_funding >= 0),
  overall_progress REAL NOT NULL DEFAULT 0,
  row_version INTEGER NOT NULL DEFAULT 1,
  budget_breakdown TEXT,               -- JSON
  resolution_number TEXT,
  cvd_code TEXT UNIQUE,                -- Código de Verificación Digital público
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  summary TEXT NOT NULL,
  general_objective TEXT,
  specific_objectives TEXT,            -- JSON
  objectives TEXT NOT NULL,
  justification TEXT NOT NULL,
  methodology TEXT NOT NULL,
  funding_source TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE (project_id, version_no)
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  left_at TEXT
);

CREATE TABLE IF NOT EXISTS status_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  justification TEXT NOT NULL,
  evaluation_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  responsible_user_id TEXT NOT NULL,
  weight REAL NOT NULL,
  weighting_rule_version TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_document_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  percent REAL NOT NULL,
  comment TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  obsolete_reason TEXT
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes <= 26214400),
  author_id TEXT NOT NULL,
  change_note TEXT NOT NULL,
  storage_path TEXT,                   -- relativo a la carpeta de uploads
  created_at TEXT NOT NULL,
  UNIQUE (document_id, version_no)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,
  product_date TEXT NOT NULL,
  venue TEXT NOT NULL,
  doi_or_url TEXT,
  status TEXT NOT NULL,
  evidence_document_id TEXT,
  evidence_filename TEXT,
  validated_at TEXT,
  validator_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  project_id TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT,
  dedupe_key TEXT NOT NULL,
  UNIQUE (user_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS regulations (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  indexed_at TEXT
);

-- Fragmentos (chunks) del corpus normativo sobre los que trabaja el recuperador RAG
CREATE TABLE IF NOT EXISTS regulation_sections (
  id TEXT PRIMARY KEY,
  regulation_id TEXT NOT NULL,
  section TEXT NOT NULL,
  page TEXT NOT NULL,
  topic TEXT,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_interactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  at TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_not_found_fallback INTEGER NOT NULL,
  is_out_of_scope_declined INTEGER NOT NULL,
  source_refs TEXT NOT NULL,
  rating INTEGER,
  rating_comment TEXT,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                 -- JSON
  min_allowed REAL,
  max_allowed REAL,
  approved_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  section_name TEXT NOT NULL,
  original_text_v1 TEXT NOT NULL,
  corrected_text_v2 TEXT NOT NULL DEFAULT '',
  researcher_justification TEXT NOT NULL DEFAULT '',
  evidence_document_id TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS review_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_alias TEXT NOT NULL,
  due_at TEXT NOT NULL,
  has_conflict_of_interest INTEGER NOT NULL DEFAULT 0,
  conflict_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL UNIQUE,
  recommendation TEXT NOT NULL,
  comments TEXT NOT NULL,
  total_score REAL,
  rubric_scores TEXT,                  -- JSON
  submitted_at TEXT NOT NULL
);

-- Sesiones colegiadas del Comité y votos firmados (V08)
CREATE TABLE IF NOT EXISTS committee_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_number TEXT NOT NULL,
  required_quorum INTEGER NOT NULL DEFAULT 3,
  resolution_number TEXT,
  resolution_issued_at TEXT,
  resolution_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS committee_votes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_role TEXT NOT NULL,
  user_id TEXT,
  vote TEXT,                           -- favor | contra | abstencion | NULL
  signature_hash TEXT,
  voted_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_projects_pi ON projects (pi_user_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities (project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_activity ON deliverables (activity_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents (project_id);
CREATE INDEX IF NOT EXISTS idx_docver_document ON document_versions (document_id);
CREATE INDEX IF NOT EXISTS idx_products_project ON products (project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_sections_regulation ON regulation_sections (regulation_id);
