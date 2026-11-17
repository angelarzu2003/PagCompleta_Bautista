/**
 * Sesiones de servidor con cookie HttpOnly + token CSRF por sesión (A5 Sección 10, NFR-004).
 *
 * SSO: la autenticación real se delega al proveedor institucional (Entra ID / Google / SAML).
 * Este backend implementa el "puente" de sesión: una vez identificado el usuario, se emite una
 * cookie opaca y nunca se manejan contraseñas locales (CON-002). En el entorno local el
 * proveedor se simula eligiendo una de las cuentas institucionales registradas.
 */
import crypto from 'node:crypto';
import { config } from './config.js';
import { get, run, fromJson } from './db.js';
import { errors, hasPermission, nowIso, randomToken } from './lib.js';

export const SESSION_COOKIE = 'urpmp_sid';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const idleMs = () => config.idleTimeoutMinutes * 60 * 1000;

export function createSession(user, role, provider) {
  const id = randomToken(32);
  const csrf = `csrf-tok-${randomToken(16)}`;
  const now = nowIso();
  run('INSERT INTO sessions (id, user_id, active_role, csrf_token, provider, created_at, last_seen_at) VALUES (?,?,?,?,?,?,?)', [id, user.id, role, csrf, provider, now, now]);
  return { id, csrf };
}

export function destroySession(id) {
  if (id) run('DELETE FROM sessions WHERE id = ?', [id]);
}

export function setSessionCookie(res, id) {
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Carga la sesión (si existe) en req.session = { id, userId, fullName, role, csrf, user }. */
export function loadSession(req, _res, next) {
  req.session = null;
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return next();
  const s = get('SELECT * FROM sessions WHERE id = ?', [sid]);
  if (!s) return next();
  if (Date.now() - Date.parse(s.last_seen_at) > idleMs()) {
    destroySession(sid); // expiración por inactividad (NFR-004)
    return next();
  }
  const user = get('SELECT * FROM users WHERE id = ?', [s.user_id]);
  if (!user || !user.active) {
    destroySession(sid);
    return next();
  }
  const roles = fromJson(user.roles, []);
  // Si al usuario le quitaron el rol activo, la sesión cae al primero que tenga.
  const role = roles.includes(s.active_role) ? s.active_role : roles[0];
  if (!role) {
    destroySession(sid);
    return next();
  }
  // Solo se "toca" la sesión cada 30 s para no escribir en disco en cada petición.
  if (Date.now() - Date.parse(s.last_seen_at) > 30_000 || role !== s.active_role) {
    run('UPDATE sessions SET last_seen_at = ?, active_role = ? WHERE id = ?', [nowIso(), role, sid]);
  }
  req.session = { id: sid, userId: user.id, fullName: user.full_name, role, csrf: s.csrf_token, user, roles, lastSeen: s.last_seen_at };
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.session) return next(errors.unauthorized());
  next();
}

/** CSRF: toda mutación autenticada debe traer X-CSRF-Token igual al de la sesión. */
export function verifyCsrf(req, _res, next) {
  if (!MUTATING.has(req.method) || !req.session) return next();
  const token = req.get('X-CSRF-Token');
  if (!safeEqual(token, req.session.csrf)) {
    return next(errors.forbidden('Token CSRF inválido o ausente en operación de mutación.'));
  }
  next();
}

export const requirePermission = action => (req, _res, next) => {
  if (!req.session) return next(errors.unauthorized());
  if (!hasPermission(req.session.role, action)) return next(errors.forbidden());
  next();
};

export function sessionPayload(session, csrf) {
  return {
    active_role: session.role,
    csrf_token: csrf ?? session.csrf,
    expires_at: new Date(Date.now() + idleMs()).toISOString(),
    idle_timeout_minutes: config.idleTimeoutMinutes,
    role_switcher_enabled: config.enableRoleSwitcher,
  };
}
