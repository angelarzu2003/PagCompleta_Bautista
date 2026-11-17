/**
 * Pruebas de integración de la API REST contra una base de datos temporal.
 * Ejecutar con: npm test (desde backend/) o npm test (desde la raíz).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urpmp-test-'));
process.env.DB_FILE = path.join(tmp, 'test.sqlite');
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.MAX_FILE_SIZE_MB = '1';
process.env.FRONTEND_DIST = path.join(tmp, 'no-dist');

const { openDatabase, closeDatabase } = await import('../src/db.js');
const { seedIfEmpty } = await import('../src/seed.js');
const { createApp } = await import('../src/app.js');
const { buildPdf } = await import('../src/pdf.js');

let server;
let base;

before(async () => {
  await openDatabase({ reset: true });
  seedIfEmpty();
  await new Promise(resolve => {
    server = createApp().listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(() => {
  server?.close();
  closeDatabase();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Cliente con cookie de sesión y token CSRF, como el navegador. */
function client() {
  let cookie = '';
  let csrf = '';
  const call = async (method, url, body, { form, noCsrf, headers = {} } = {}) => {
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (method !== 'GET' && csrf && !noCsrf) h['X-CSRF-Token'] = csrf;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + url, { method, headers: h, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  };
  return {
    get: url => call('GET', url),
    post: (url, body, opts) => call('POST', url, body ?? {}, opts),
    patch: (url, body, opts) => call('PATCH', url, body ?? {}, opts),
    async login(email) {
      const r = await call('POST', '/auth/login', { provider: 'entra', email });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      csrf = r.data.csrf_token;
      return r.data;
    },
    setCsrf: t => (csrf = t),
  };
}

const PI = 'roberto.mendoza@urpmp.edu.pe';
const STUDENT = 'carlos.alva@urpmp.edu.pe';
const COORD = 'elena.morales@urpmp.edu.pe';
const COMMITTEE = 'carmen.valdivia@urpmp.edu.pe';
const ADMIN = 'sofia.quispe@urpmp.edu.pe';
const OTHER_PI = 'lucia.paredes@urpmp.edu.pe';

const pdfFile = (name, text = 'Contenido de prueba') => {
  const form = new FormData();
  const buf = buildPdf('Prueba', text);
  form.append('file', new Blob([buf], { type: 'application/pdf' }), name);
  return { form, buf };
};

describe('Autenticación, sesión y CSRF', () => {
  test('sin sesión la API responde 401', async () => {
    const c = client();
    assert.equal((await c.get('/projects')).status, 401);
    assert.equal((await c.get('/projects/proj-2023-019')).status, 401);
  });

  test('una cuenta no registrada no puede iniciar sesión', async () => {
    const r = await client().post('/auth/login', { email: 'intruso@gmail.com' });
    assert.equal(r.status, 401);
  });

  test('las mutaciones sin token CSRF válido se rechazan con 403', async () => {
    const c = client();
    await c.login(PI);
    const r1 = await c.post('/notifications/read-all', {}, { noCsrf: true });
    assert.equal(r1.status, 403);
    c.setCsrf('csrf-tok-falsificado-con-prefijo-valido00000');
    const r2 = await c.post('/notifications/read-all');
    assert.equal(r2.status, 403);
  });

  test('la sesión se restaura con la cookie y el token CSRF rota en cada login', async () => {
    const c = client();
    const a = await c.login(PI);
    const s = await c.get('/auth/session');
    assert.equal(s.status, 200);
    assert.equal(s.data.user.id, 'u-pi-001');
    const b = await c.login(PI);
    assert.notEqual(a.csrf_token, b.csrf_token);
  });
});

describe('Control de acceso por objeto (IDOR / BR-011)', () => {
  test('un investigador solo ve sus proyectos', async () => {
    const c = client();
    await c.login(PI);
    const r = await c.get('/projects');
    assert.ok(r.data.length > 0);
    assert.ok(r.data.every(p => p.pi_user_id === 'u-pi-001'));
  });

  test('un estudiante no puede abrir un expediente del que no es miembro (404)', async () => {
    const c = client();
    await c.login(STUDENT);
    assert.equal((await c.get('/projects/proj-2023-019')).status, 200); // es miembro
    assert.equal((await c.get('/projects/proj-2024-042')).status, 404);
    assert.equal((await c.get('/projects/proj-2024-042/documents')).status, 404);
  });

  test('otro investigador no puede ver ni modificar un proyecto ajeno', async () => {
    const c = client();
    await c.login(OTHER_PI);
    assert.equal((await c.get('/projects/proj-2023-019')).status, 404);
    assert.equal((await c.patch('/projects/proj-2025-028', { title: 'Secuestro de expediente' }, { headers: { 'If-Match': '1' } })).status, 404);
  });

  test('el comité solo ve los expedientes asignados y en evaluación ciega', async () => {
    const c = client();
    await c.login(COMMITTEE);
    const r = await c.get('/reviews/assignments');
    assert.equal(r.status, 200);
    assert.ok(r.data.length > 0);
    assert.ok(r.data.every(a => a.project.pi_full_name.includes('anónimo')));
  });
});

describe('Proyectos: creación, concurrencia y máquina de estados', () => {
  let projectId;
  let version;
  const c = client();

  test('crea un borrador asignando al usuario de la sesión como PI (no el del formulario)', async () => {
    await c.login(PI);
    const r = await c.post('/projects', {
      title: 'Propuesta de prueba para concurrencia optimista',
      pi_user_id: 'u-otro',
      department_id: 'dept-ingenieria',
      area_id: 'area-ambiente',
      line_id: 'line-cuencas',
      type_id: 'type-fondos-internos',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
      requested_funding: 50000,
      current_version: { summary: 'Resumen', general_objective: 'Objetivo', specific_objectives: ['Medir 1', 'Medir 2', 'Medir 3'], justification: 'J', methodology: 'M' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.pi_user_id, 'u-pi-001');
    assert.equal(r.data.status, 'Draft');
    projectId = r.data.id;
    version = r.data.row_version;
  });

  test('valida fechas (end_date >= start_date) con error de campo 422', async () => {
    const r = await c.post('/projects', {
      title: 'Propuesta con fechas invertidas',
      department_id: 'dept-ingenieria', area_id: 'area-ambiente', line_id: 'line-cuencas', type_id: 'type-fondos-internos',
      start_date: '2027-12-31', end_date: '2027-01-01',
    });
    assert.equal(r.status, 422);
    assert.ok(r.data.error.fields.some(f => f.field === 'end_date'));
  });

  test('PATCH con la versión correcta incrementa row_version; con versión obsoleta da 409', async () => {
    const ok = await c.patch(`/projects/${projectId}`, { title: 'Título actualizado de la propuesta', row_version: 999 }, { headers: { 'If-Match': String(version) } });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.row_version, version + 1);
    const stale = await c.patch(`/projects/${projectId}`, { title: 'Sobrescritura obsoleta' }, { headers: { 'If-Match': String(version) } });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.error.code, 'CONFLICT');
  });

  test('mass assignment: no se puede cambiar dueño, código ni row_version', async () => {
    const cur = (await c.get(`/projects/${projectId}`)).data;
    const r = await c.patch(`/projects/${projectId}`, { pi_user_id: 'u-otro', code: 'HACK', status: 'Approved' }, { headers: { 'If-Match': String(cur.row_version) } });
    assert.equal(r.status, 200);
    assert.equal(r.data.pi_user_id, 'u-pi-001');
    assert.equal(r.data.code, cur.code);
    assert.equal(r.data.status, 'Draft');
  });

  test('el investigador envía la propuesta pero no puede aprobarla', async () => {
    const cur = (await c.get(`/projects/${projectId}`)).data;
    const sub = await c.post(`/projects/${projectId}/submit`, { row_version: cur.row_version });
    assert.equal(sub.status, 200, JSON.stringify(sub.data));
    assert.equal(sub.data.status, 'Submitted');
    const hack = await c.post(`/projects/${projectId}/transitions`, { to_status: 'Under review', justification: 'Me autoapruebo' });
    assert.equal(hack.status, 403);
  });

  test('la coordinación decide con justificación obligatoria', async () => {
    const coord = client();
    await coord.login(COORD);
    const noJust = await coord.post(`/projects/${projectId}/transitions`, { to_status: 'Under review', justification: '' });
    assert.equal(noJust.status, 422);
    const ok = await coord.post(`/projects/${projectId}/transitions`, { to_status: 'Under review', justification: 'Pasa a evaluación por pares.' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.status, 'Under review');
    const invalid = await coord.post(`/projects/${projectId}/transitions`, { to_status: 'Closed', justification: 'Salto inválido' });
    assert.equal(invalid.status, 422);
  });
});

describe('Plan de trabajo y documentos', () => {
  const c = client();
  before(async () => c.login(PI));

  test('FR-022: no se puede enviar un entregable sin evidencia', async () => {
    const r = await c.post('/deliverables/del-02/submit', { evidence_document_ids: [] });
    assert.equal(r.status, 422);
    const fake = await c.post('/deliverables/del-02/submit', { evidence_document_ids: ['doc-inexistente'] });
    assert.equal(fake.status, 422);
  });

  test('FR-023: actualizar el avance recalcula el promedio ponderado', async () => {
    const r = await c.patch('/activities/act-03/progress', { progress: 50 });
    assert.equal(r.status, 200);
    const p = (await c.get('/projects/proj-2023-019')).data;
    // 0.3*100 + 0.4*75 + 0.3*50 = 75
    assert.equal(p.overall_progress, 75);
    assert.equal((await c.patch('/activities/act-03/progress', { progress: 150 })).status, 422);
  });

  test('carga real de archivo: el servidor calcula el SHA-256 y versiona por nombre', async () => {
    const { form, buf } = pdfFile('Acta_Prueba_H2.2.pdf');
    form.append('type', 'evidence');
    form.append('change_note', 'Acta de recepción');
    const r = await c.post('/projects/proj-2023-019/documents', undefined, { form });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.versions[0].sha256, crypto.createHash('sha256').update(buf).digest('hex'));

    const again = pdfFile('Acta_Prueba_H2.2.pdf', 'Segunda versión');
    const r2 = await c.post('/projects/proj-2023-019/documents', undefined, { form: again.form });
    assert.equal(r2.data.versions.length, 2);

    // Descarga íntegra
    const dl = await c.get(`/documents/versions/${r2.data.versions[1].id}/download`);
    assert.equal(dl.status, 200);
    assert.equal(crypto.createHash('sha256').update(dl.data).digest('hex'), r2.data.versions[1].sha256);

    // Con evidencia real ya se puede enviar el entregable
    const sub = await c.post('/deliverables/del-02/submit', { evidence_document_ids: [r.data.id] });
    assert.equal(sub.status, 200);
    assert.equal(sub.data.status, 'Submitted');
  });

  test('lista blanca de extensiones, firma de contenido y límite de tamaño', async () => {
    const php = new FormData();
    php.append('file', new Blob(['<?php system($_GET[1]);']), 'shell.php');
    assert.equal((await c.post('/projects/proj-2023-019/documents', undefined, { form: php })).status, 415);

    const fakePdf = new FormData();
    fakePdf.append('file', new Blob(['<html>no soy un pdf</html>']), 'falso.pdf');
    assert.equal((await c.post('/projects/proj-2023-019/documents', undefined, { form: fakePdf })).status, 415);

    const big = new FormData();
    big.append('file', new Blob([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1.2 * 1024 * 1024)])]), 'grande.pdf');
    assert.equal((await c.post('/projects/proj-2023-019/documents', undefined, { form: big })).status, 413);
  });

  test('FR-029: declarar obsoleto exige motivo', async () => {
    assert.equal((await c.post('/documents/doc-001/obsolete', { reason: '   ' })).status, 422);
  });
});

describe('Productos científicos (BR-013)', () => {
  test('rechaza enlaces javascript: y nunca nace validado', async () => {
    const c = client();
    await c.login(PI);
    const form = new FormData();
    form.append('project_id', 'proj-2023-019');
    form.append('type', 'journal_article');
    form.append('title', 'Paper con enlace malicioso');
    form.append('doi_or_url', 'javascript:alert(1)');
    assert.equal((await c.post('/products', undefined, { form })).status, 422);

    const ok = new FormData();
    ok.append('project_id', 'proj-2023-019');
    ok.append('type', 'journal_article');
    ok.append('title', 'Paper legítimo de prueba');
    ok.append('validated_at', '2026-01-01');
    const r = await c.post('/products', undefined, { form: ok });
    assert.equal(r.status, 201);
    assert.equal(r.data.validated_at, null);
    assert.equal((await c.post(`/products/${r.data.id}/validate`)).status, 403);

    const coord = client();
    await coord.login(COORD);
    const v = await coord.post(`/products/${r.data.id}/validate`, { validator_id: 'u-falso' });
    assert.equal(v.status, 200);
    assert.equal(v.data.validator_id, 'u-coord-003');
  });
});

describe('Asistente normativo e IA (AIR)', () => {
  const c = client();
  before(async () => c.login(PI));

  test('AIR-001: rechaza preguntas de más de 1000 caracteres', async () => {
    assert.equal((await c.post('/ai/normative-assistant', { question: 'a'.repeat(1001) })).status, 422);
  });

  test('responde con cita verificable del corpus vigente', async () => {
    const r = await c.post('/ai/normative-assistant', { question: '¿Qué necesito para redistribuir el presupuesto entre partidas?' });
    assert.equal(r.status, 200);
    assert.equal(r.data.is_out_of_scope_declined, false);
    assert.ok(r.data.source_refs.some(s => s.section.includes('24.3')), JSON.stringify(r.data.source_refs));
  });

  test('AIR-013: declina preguntas fuera del dominio', async () => {
    const r = await c.post('/ai/normative-assistant', { question: '¿Cuál es la receta del ceviche?' });
    assert.equal(r.data.is_out_of_scope_declined, true);
    assert.equal(r.data.source_refs.length, 0);
  });

  test('AIR-011: excluye proyectos confidenciales del pre-chequeo', async () => {
    assert.equal((await c.post('/ai/precheck', { project_id: 'proj-2024-009-conf' })).status, 403);
    const ok = await c.post('/ai/precheck', { project_id: 'proj-2024-042' });
    assert.equal(ok.status, 200);
    assert.ok(Array.isArray(ok.data.observations));
  });
});

describe('Administración, auditoría y verificación pública', () => {
  test('bitácora y parámetros solo para administración; la cadena hash es íntegra', async () => {
    const pi = client();
    await pi.login(PI);
    assert.equal((await pi.get('/audit-events')).status, 403);
    assert.equal((await pi.patch('/settings/ai.max_answer_length_chars', { value: 900 })).status, 403);

    const admin = client();
    await admin.login(ADMIN);
    const ev = await admin.get('/audit-events');
    assert.equal(ev.status, 200);
    assert.ok(ev.data.length > 10);
    assert.equal((await admin.patch('/settings/notification.lead_days_warning', { value: 99 })).status, 422);
    assert.equal((await admin.patch('/settings/notification.lead_days_warning', { value: 10 })).status, 200);
    const chain = await admin.get('/audit-events/verify');
    assert.equal(chain.data.valid, true);
  });

  test('alta de usuario con correo duplicado responde 409 (FR-003)', async () => {
    const admin = client();
    await admin.login(ADMIN);
    const r = await admin.post('/admin/users', { email: PI, full_name: 'Duplicado Prueba', department_id: 'dept-ingenieria', roles: ['researcher'] });
    assert.equal(r.status, 409);
  });

  test('verificación pública por CVD sin sesión y con DNI enmascarado', async () => {
    const r = await client().get('/public/verify/URP-9482-TX-2024');
    assert.equal(r.status, 200);
    assert.equal(r.data.project_code, 'PID-2023-CRH-019');
    assert.match(r.data.pi_masked_national_id, /^\*\*\*\.\*\*\*\.\d{3}$/);
    assert.equal((await client().get('/public/verify/NO-EXISTE')).status, 404);
  });
});
