/**
 * Capa de persistencia: SQLite embebido mediante sql.js (WebAssembly).
 * No requiere compilar módulos nativos ni instalar un servidor de base de datos,
 * por lo que el proyecto funciona igual en Windows, macOS y Linux.
 *
 * La base de datos vive en memoria y se vuelca de forma atómica al archivo
 * `data/urpmp.sqlite` después de cada operación de escritura.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import { config } from './config.js';

const require = createRequire(import.meta.url);

let SQL = null;
let db = null;
let dbFile = null;
let saveTimer = null;
let inTransaction = false;

const SCHEMA = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export async function openDatabase({ file = config.dbFile, reset = false } = {}) {
  if (!SQL) {
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    SQL = await initSqlJs({ locateFile: () => wasmPath });
  }
  dbFile = file;
  let isNew = true;
  if (file && !reset && fs.existsSync(file)) {
    db = new SQL.Database(fs.readFileSync(file));
    isNew = false;
  } else {
    db = new SQL.Database();
  }
  db.exec(SCHEMA);
  return { isNew };
}

export function getDb() {
  if (!db) throw new Error('La base de datos no ha sido inicializada.');
  return db;
}

function normalizeParams(params) {
  return (params || []).map(v => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  });
}

export function all(sql, params = []) {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(normalizeParams(params));
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

export function get(sql, params = []) {
  return all(sql, params)[0] ?? null;
}

export function run(sql, params = []) {
  const stmt = getDb().prepare(sql);
  try {
    stmt.run(normalizeParams(params));
  } finally {
    stmt.free();
  }
  if (!inTransaction) scheduleSave();
  return getDb().getRowsModified();
}

/** Ejecuta `fn` dentro de una transacción; si lanza, se revierte todo. */
export function transaction(fn) {
  if (inTransaction) return fn();
  getDb().exec('BEGIN');
  inTransaction = true;
  try {
    const result = fn();
    getDb().exec('COMMIT');
    return result;
  } catch (err) {
    getDb().exec('ROLLBACK');
    throw err;
  } finally {
    inTransaction = false;
    scheduleSave();
  }
}

function scheduleSave() {
  if (!dbFile) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 150);
}

export function saveNow() {
  if (!dbFile || !db) return;
  clearTimeout(saveTimer);
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const tmp = `${dbFile}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, dbFile);
}

export function closeDatabase() {
  if (!db) return;
  saveNow();
  db.close();
  db = null;
}

// Helpers de serialización JSON para columnas TEXT
export const toJson = v => (v === undefined || v === null ? null : JSON.stringify(v));
export const fromJson = (v, fallback = null) => {
  if (v === null || v === undefined || v === '') return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};
