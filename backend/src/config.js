import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(__dirname, '..');

// Carga mínima de backend/.env (sin dependencias). Las variables del sistema tienen prioridad.
const envFile = path.join(BACKEND_ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
const resolveFromRoot = p => (path.isAbsolute(p) ? p : path.resolve(BACKEND_ROOT, p));

export const config = {
  port: Number(env.PORT) || 4000,
  host: env.HOST || '127.0.0.1',
  dbFile: resolveFromRoot(env.DB_FILE || 'data/urpmp.sqlite'),
  uploadsDir: resolveFromRoot(env.UPLOADS_DIR || 'data/uploads'),
  /** Carpeta del build del frontend que el backend sirve como sitio estático. */
  frontendDist: resolveFromRoot(env.FRONTEND_DIST || '../frontend/dist'),
  idleTimeoutMinutes: Number(env.IDLE_TIMEOUT_MINUTES) || 30,
  maxUploadBytes: (Number(env.MAX_FILE_SIZE_MB) || 25) * 1024 * 1024,
  /** Habilita el cambio de rol de pruebas (solo para demostraciones / desarrollo). */
  enableRoleSwitcher: (env.ENABLE_DEV_ROLE_SWITCHER ?? 'true') === 'true',
  cookieSecure: env.COOKIE_SECURE === 'true',
};
