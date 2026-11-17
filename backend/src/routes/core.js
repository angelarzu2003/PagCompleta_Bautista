import express from 'express';
import { config } from '../config.js';
import { all, get, run, transaction, toJson, fromJson } from '../db.js';
import { createSession, destroySession, setSessionCookie, sessionPayload, requireAuth, requirePermission, SESSION_COOKIE } from '../auth.js';
import { errors, audit, newId, nowIso, cleanText, ALL_ROLES, verifyAuditChain } from '../lib.js';
import { serializeUser, getCatalogs } from '../repo.js';
import { answerQuestion, getSettingValue } from '../ai.js';

export const router = express.Router();

const PROVIDERS = { entra: 'microsoft_entra', google: 'google_workspace', saml: 'saml_institutional', microsoft_entra: 'microsoft_entra', google_workspace: 'google_workspace', saml_institutional: 'saml_institutional' };

// ===========================================================================
// AUTENTICACIÓN (puente SSO) Y SESIÓN
// ===========================================================================

/** Cuentas institucionales disponibles en el proveedor de identidad simulado (entorno local). */
router.get('/auth/accounts', (_req, res) => {
  const rows = all('SELECT * FROM users WHERE active = 1 ORDER BY full_name');
  res.json(rows.map(u => {
    const s = serializeUser(u);
    return { id: s.id, email: s.email, full_name: s.full_name, title: s.title, department_name: s.department_name, roles: s.roles };
  }));
});

router.post('/auth/login', (req, res) => {
  const provider = PROVIDERS[req.body?.provider] || 'microsoft_entra';
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) throw errors.invalid('Seleccione su cuenta institucional.', [{ field: 'email', message: 'Requerido.' }]);
  const user = get('SELECT * FROM users WHERE lower(email) = ?', [email]);
  if (!user) throw errors.unauthorized('La cuenta no está registrada en la plataforma. Solicite su alta a la Administración (FR-003).');
  if (!user.active) throw errors.forbidden('La cuenta institucional está desactivada.');
  const roles = fromJson(user.roles, []);
  if (!roles.length) throw errors.forbidden('La cuenta no tiene roles asignados.');

  // Evita fijación de sesión: se descarta cualquier sesión previa del navegador
  destroySession(req.cookies?.[SESSION_COOKIE]);
  const { id, csrf } = createSession(user, roles[0], provider);
  setSessionCookie(res, id);
  const session = { userId: user.id, fullName: user.full_name, role: roles[0] };
  audit(session, 'USER_LOGIN', 'user', user.id, { provider });
  res.json({ user: serializeUser(user), ...sessionPayload(session, csrf) });
});

router.get('/auth/session', (req, res) => {
  if (!req.session) throw errors.unauthorized();
  res.json({ user: serializeUser(req.session.user), ...sessionPayload(req.session) });
});

router.post('/auth/logout', (req, res) => {
  if (req.session) {
    audit(req.session, 'USER_LOGOUT', 'user', req.session.userId, {});
    destroySession(req.session.id);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(204).end();
});

/**
 * Cambio de rol activo. Si el usuario tiene el rol, simplemente lo activa.
 * Con el selector de pruebas habilitado (ENABLE_DEV_ROLE_SWITCHER) además permite
 * entrar como la cuenta de prueba que tenga ese rol (impersonación para demostraciones).
 */
router.post('/auth/switch-role', requireAuth, (req, res) => {
  const role = req.body?.role;
  if (!ALL_ROLES.includes(role)) throw errors.invalid('Rol inválido.');
  const s = req.session;
  let user = s.user;
  if (!s.roles.includes(role)) {
    if (!config.enableRoleSwitcher) throw errors.forbidden('Usted no tiene asignado ese rol.');
    user = all('SELECT * FROM users WHERE active = 1 ORDER BY id').find(u => fromJson(u.roles, []).includes(role));
    if (!user) throw errors.notFound('No existe una cuenta activa con ese rol.');
  }
  destroySession(s.id);
  const { id, csrf } = createSession(user, role, 'role_switch');
  setSessionCookie(res, id);
  const next = { userId: user.id, fullName: user.full_name, role };
  audit(next, 'ACTIVE_ROLE_SWITCHED', 'user', user.id, { from_user: s.userId, from_role: s.role, to_role: role });
  res.json({ user: serializeUser(user), ...sessionPayload(next, csrf) });
});

router.get('/me', requireAuth, (req, res) => res.json(serializeUser(req.session.user)));

router.post('/me/privacy-acceptance', requireAuth, (req, res) => {
  const at = nowIso();
  run('UPDATE users SET privacy_accepted_at = ? WHERE id = ?', [at, req.session.userId]);
  audit(req.session, 'PRIVACY_NOTICE_ACCEPTED', 'user', req.session.userId, { at });
  res.json(serializeUser(get('SELECT * FROM users WHERE id = ?', [req.session.userId])));
});

// ===========================================================================
// CATÁLOGOS (FR-006)
// ===========================================================================
router.get('/catalogs', requireAuth, (req, res) => {
  res.json(getCatalogs({ includeInactive: req.query.all === '1' && req.session.role === 'administrator' }));
});

router.post('/admin/catalogs', requirePermission('manage_catalogs'), (req, res) => {
  const types = ['departments', 'research_areas', 'research_lines', 'project_types', 'deliverable_types'];
  const type = req.body?.catalog_type;
  const name = cleanText(req.body?.name, 200);
  if (!types.includes(type)) throw errors.invalid('Tipo de catálogo inválido.');
  if (name.length < 3) throw errors.invalid('El nombre es obligatorio.', [{ field: 'name', message: 'Mínimo 3 caracteres.' }]);
  if (get('SELECT 1 AS x FROM catalog_items WHERE catalog_type = ? AND lower(name) = lower(?)', [type, name])) throw errors.conflict('Ya existe un elemento con ese nombre.');
  const id = newId(type.slice(0, 4));
  run('INSERT INTO catalog_items (id, catalog_type, name, active, parent_id) VALUES (?,?,?,1,?)', [id, type, name, req.body?.parent_id || null]);
  audit(req.session, 'CATALOG_ITEM_CREATED', 'catalog_item', id, { catalog_type: type, name });
  res.status(201).json({ id, name, active: true, parent_id: req.body?.parent_id || null });
});

router.patch('/admin/catalogs/:id', requirePermission('manage_catalogs'), (req, res) => {
  const item = get('SELECT * FROM catalog_items WHERE id = ?', [req.params.id]);
  if (!item) throw errors.notFound();
  const name = req.body?.name !== undefined ? cleanText(req.body.name, 200) : item.name;
  const active = req.body?.active !== undefined ? Boolean(req.body.active) : Boolean(item.active);
  run('UPDATE catalog_items SET name = ?, active = ? WHERE id = ?', [name, active, item.id]);
  audit(req.session, 'CATALOG_ITEM_UPDATED', 'catalog_item', item.id, { name, active });
  res.json({ id: item.id, name, active, parent_id: item.parent_id });
});

// ===========================================================================
// NOTIFICACIONES (FR-033..036)
// ===========================================================================
router.get('/notifications', requireAuth, (req, res) => {
  res.json(all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.session.userId]));
});

router.post('/notifications/:id/read', requireAuth, (req, res) => {
  run('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?', [nowIso(), req.params.id, req.session.userId]);
  res.status(204).end();
});

router.post('/notifications/read-all', requireAuth, (req, res) => {
  run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [nowIso(), req.session.userId]);
  res.status(204).end();
});

// ===========================================================================
// ADMINISTRACIÓN DE USUARIOS (FR-002..004)
// ===========================================================================
router.get('/admin/users', requirePermission('manage_users'), (_req, res) => {
  res.json(all('SELECT * FROM users ORDER BY full_name').map(serializeUser));
});

router.post('/admin/users', requirePermission('manage_users'), (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = cleanText(req.body?.full_name, 200);
  const roles = (req.body?.roles || []).filter(r => ALL_ROLES.includes(r));
  const dept = req.body?.department_id;
  const fields = [];
  if (!/^[^@\s]+@urpmp\.edu\.pe$/.test(email)) fields.push({ field: 'email', message: 'Debe ser un correo institucional @urpmp.edu.pe.' });
  if (name.length < 5) fields.push({ field: 'full_name', message: 'Nombre completo obligatorio.' });
  if (!roles.length) fields.push({ field: 'roles', message: 'Asigne al menos un rol.' });
  if (!get(`SELECT 1 AS x FROM catalog_items WHERE id = ? AND catalog_type = 'departments'`, [dept])) fields.push({ field: 'department_id', message: 'Departamento inválido.' });
  if (fields.length) throw errors.invalid('Error de validación en el formulario.', fields);
  if (get('SELECT 1 AS x FROM users WHERE lower(email) = ?', [email])) throw errors.conflict('Ya existe un usuario con ese correo institucional (FR-003).');
  const id = newId('u');
  run('INSERT INTO users (id, institutional_subject, email, full_name, department_id, roles, title, active, national_id, privacy_accepted_at, created_at) VALUES (?,?,?,?,?,?,?,1,NULL,NULL,?)',
    [id, email, email, name, dept, toJson(roles), cleanText(req.body?.title, 200) || null, nowIso()]);
  audit(req.session, 'USER_CREATED', 'user', id, { email, roles });
  res.status(201).json(serializeUser(get('SELECT * FROM users WHERE id = ?', [id])));
});

router.patch('/admin/users/:id', requirePermission('manage_users'), (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!u) throw errors.notFound('Usuario no encontrado.');
  const updates = {};
  if (req.body?.roles !== undefined) {
    const roles = [...new Set((req.body.roles || []).filter(r => ALL_ROLES.includes(r)))];
    if (!roles.length) throw errors.invalid('El usuario debe conservar al menos un rol.');
    if (u.id === req.session.userId && !roles.includes('administrator')) throw errors.invalid('No puede retirarse a sí mismo el rol de administrador.');
    updates.roles = roles;
  }
  if (req.body?.active !== undefined) {
    if (u.id === req.session.userId && !req.body.active) throw errors.invalid('No puede desactivar su propia cuenta.');
    updates.active = Boolean(req.body.active);
  }
  transaction(() => {
    if (updates.roles) run('UPDATE users SET roles = ? WHERE id = ?', [toJson(updates.roles), u.id]);
    if (updates.active !== undefined) {
      run('UPDATE users SET active = ? WHERE id = ?', [updates.active, u.id]);
      if (!updates.active) run('DELETE FROM sessions WHERE user_id = ?', [u.id]); // revoca sesiones activas
    }
    audit(req.session, 'USER_UPDATED', 'user', u.id, { before: { roles: fromJson(u.roles, []), active: Boolean(u.active) }, after: updates });
  });
  res.json(serializeUser(get('SELECT * FROM users WHERE id = ?', [u.id])));
});

// ===========================================================================
// PARÁMETROS (NFR-019) Y AUDITORÍA (FR-042, FR-043)
// ===========================================================================
const serializeSetting = s => ({ ...s, value: fromJson(s.value) });

router.get('/settings', requirePermission('edit_parameters'), (_req, res) => {
  res.json(all('SELECT * FROM settings ORDER BY key').map(serializeSetting));
});

router.patch('/settings/:key', requirePermission('edit_parameters'), (req, res) => {
  const s = get('SELECT * FROM settings WHERE key = ?', [req.params.key]);
  if (!s) throw errors.notFound('Parámetro no encontrado.');
  const value = Number(req.body?.value);
  if (!Number.isFinite(value)) throw errors.invalid('El valor debe ser numérico.');
  if ((s.min_allowed !== null && value < s.min_allowed) || (s.max_allowed !== null && value > s.max_allowed)) {
    throw errors.invalid(`El valor debe estar entre ${s.min_allowed} y ${s.max_allowed}.`, [{ field: 'value', message: 'Fuera de rango.' }]);
  }
  run('UPDATE settings SET value = ?, approved_by = ?, updated_at = ?, version = version + 1 WHERE key = ?', [toJson(value), req.session.userId, nowIso(), s.key]);
  audit(req.session, 'SETTING_UPDATED', 'system_setting', s.key, { from: fromJson(s.value), to: value });
  res.json(serializeSetting(get('SELECT * FROM settings WHERE key = ?', [s.key])));
});

router.get('/audit-events', requirePermission('view_audit_log'), (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const rows = all('SELECT * FROM audit_events ORDER BY seq DESC LIMIT ?', [limit]);
  res.json(rows.map(r => ({ ...r, metadata: fromJson(r.metadata, {}) })));
});

router.get('/audit-events/verify', requirePermission('view_audit_log'), (_req, res) => {
  res.json(verifyAuditChain());
});

// ===========================================================================
// CORPUS NORMATIVO Y ASISTENTE RAG (FR-045, AIR-001..007)
// ===========================================================================
router.get('/regulations', requireAuth, (_req, res) => {
  const rows = all(`SELECT r.*, (SELECT COUNT(*) FROM regulation_sections s WHERE s.regulation_id = r.id) AS section_count FROM regulations r ORDER BY r.status, r.effective_date DESC`);
  res.json(rows);
});

router.get('/regulations/:id/sections', requireAuth, (req, res) => {
  res.json(all('SELECT * FROM regulation_sections WHERE regulation_id = ? ORDER BY rowid', [req.params.id]));
});

router.post('/regulations', requirePermission('manage_corpus'), (req, res) => {
  const title = cleanText(req.body?.title, 300);
  const version = cleanText(req.body?.version, 50);
  const content = String(req.body?.content || '');
  if (!title || !version) throw errors.invalid('Debe completar el título y versión de la directiva.');
  const id = newId('reg');
  // Cada párrafo "Artículo N (...)" o bloque separado por línea en blanco se convierte en un fragmento recuperable
  const blocks = content.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 20);
  transaction(() => {
    run('INSERT INTO regulations (id, version_id, title, version, status, effective_date, indexed_at) VALUES (?,?,?,?,?,?,?)',
      [id, newId('v'), title, version, 'active', req.body?.effective_date || nowIso().slice(0, 10), nowIso()]);
    blocks.forEach((b, i) => {
      const m = b.match(/^((?:Art[íi]culo|Art\.)\s*[\d.]+[^:\n]*?)[:.\n]\s*([\s\S]+)$/i);
      run('INSERT INTO regulation_sections (id, regulation_id, section, page, topic, text) VALUES (?,?,?,?,?,?)',
        [`${id}-s${i + 1}`, id, m ? cleanText(m[1], 200) : `Sección ${i + 1}`, String(i + 1), null, cleanText(m ? m[2] : b, 5000)]);
    });
    audit(req.session, 'REGULATION_INDEXED', 'regulation', id, { title, version, sections: blocks.length });
  });
  res.status(201).json({ ...get('SELECT * FROM regulations WHERE id = ?', [id]), section_count: blocks.length });
});

router.post('/regulations/:id/retire', requirePermission('manage_corpus'), (req, res) => {
  const r = get('SELECT * FROM regulations WHERE id = ?', [req.params.id]);
  if (!r) throw errors.notFound('Norma no encontrada.');
  run(`UPDATE regulations SET status = 'retired', indexed_at = ? WHERE id = ?`, [nowIso(), r.id]);
  audit(req.session, 'REGULATION_RETIRED', 'regulation', r.id, { title: r.title });
  res.json(get('SELECT * FROM regulations WHERE id = ?', [r.id]));
});

// Límite simple de uso del asistente por usuario (AIR-012): 20 preguntas por minuto
const aiHits = new Map();
function rateLimitAi(userId) {
  const now = Date.now();
  const hits = (aiHits.get(userId) || []).filter(t => now - t < 60_000);
  if (hits.length >= 20) throw errors.invalid('Cuota de consultas excedida. Intente nuevamente en un minuto.');
  hits.push(now);
  aiHits.set(userId, hits);
}

const serializeInteraction = i => ({
  id: i.id,
  user_id: i.user_id,
  at: i.at,
  allowed_question: i.question,
  answer: i.answer,
  is_not_found_fallback: Boolean(i.is_not_found_fallback),
  is_out_of_scope_declined: Boolean(i.is_out_of_scope_declined),
  source_refs: fromJson(i.source_refs, []),
  advisory_disclaimer:
    'Aviso Importante: Esta respuesta es generada automáticamente con fines orientativos (no vinculantes) a partir del corpus normativo vigente. Las decisiones institucionales oficiales corresponden exclusivamente a la Coordinación de Investigación y al Comité de Ética.',
  rating: i.rating === null ? null : Boolean(i.rating),
  rating_comment: i.rating_comment,
  expires_at: i.expires_at,
  restricted_access: true,
});

router.post('/ai/normative-assistant', requireAuth, (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question : '';
  if (!question.trim()) throw errors.invalid('La pregunta no puede estar vacía.');
  if (question.length > 1000) throw errors.invalid('La pregunta no puede exceder los 1,000 caracteres.');
  rateLimitAi(req.session.userId);
  const result = answerQuestion(question, {
    threshold: Number(getSettingValue('ai.rag_relevance_threshold', 0.2)),
    maxChars: Number(getSettingValue('ai.max_answer_length_chars', 1000)),
  });
  const id = newId('ai');
  const at = nowIso();
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(); // retención 12 meses (AIR-007)
  run(
    `INSERT INTO ai_interactions (id, user_id, at, question, answer, is_not_found_fallback, is_out_of_scope_declined, source_refs, rating, rating_comment, expires_at)
     VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?)`,
    [id, req.session.userId, at, cleanText(question, 1000), result.answer, result.is_not_found_fallback, result.is_out_of_scope_declined, toJson(result.source_refs), expires]
  );
  res.json(serializeInteraction(get('SELECT * FROM ai_interactions WHERE id = ?', [id])));
});

router.get('/ai/interactions', requireAuth, (req, res) => {
  res.json(all('SELECT * FROM ai_interactions WHERE user_id = ? AND expires_at > ? ORDER BY at ASC LIMIT 50', [req.session.userId, nowIso()]).map(serializeInteraction));
});

router.post('/ai/interactions/:id/rating', requireAuth, (req, res) => {
  const i = get('SELECT * FROM ai_interactions WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
  if (!i) throw errors.notFound();
  run('UPDATE ai_interactions SET rating = ?, rating_comment = ? WHERE id = ?', [Boolean(req.body?.rating), cleanText(req.body?.comment, 500) || null, i.id]);
  res.json(serializeInteraction(get('SELECT * FROM ai_interactions WHERE id = ?', [i.id])));
});
