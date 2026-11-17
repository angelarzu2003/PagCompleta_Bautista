import { config } from './config.js';
import { openDatabase, closeDatabase, all, run } from './db.js';
import { seedIfEmpty } from './seed.js';
import { createApp } from './app.js';
import { notify, nowIso } from './lib.js';
import { getSettingValue } from './ai.js';

/**
 * Tarea de alertas de vencimiento (FR-033..036): genera notificaciones a 7 días, 1 día
 * y el día de vencimiento de cada entregable pendiente. La clave de deduplicación evita repetirlas.
 */
export function runDeadlineJob() {
  const warn = Number(getSettingValue('notification.lead_days_warning', 7));
  const crit = Number(getSettingValue('notification.lead_days_critical', 1));
  const today = new Date(nowIso().slice(0, 10));
  const rows = all(
    `SELECT d.*, p.id AS project_id, p.code AS project_code, p.pi_user_id, a.responsible_user_id
     FROM deliverables d JOIN activities a ON a.id = d.activity_id JOIN projects p ON p.id = a.project_id
     WHERE d.status = 'Pending' AND p.status = 'In progress'`
  );
  for (const d of rows) {
    const days = Math.round((new Date(d.due_date) - today) / 86_400_000);
    let kind = null;
    let title = '';
    if (days < 0) [kind, title] = ['overdue_today', 'Entregable vencido'];
    else if (days <= crit) [kind, title] = ['due_in_1_day', `Entregable vence en ${days} día(s)`];
    else if (days <= warn) [kind, title] = ['due_in_7_days', `Entregable próximo a vencer (${days} días)`];
    if (!kind) continue;
    const msg = `El entregable ${d.code} "${d.name}" del proyecto ${d.project_code} ${days < 0 ? 'venció' : 'vence'} el ${d.due_date.split('-').reverse().join('/')}.`;
    for (const uid of new Set([d.pi_user_id, d.responsible_user_id])) {
      notify(uid, { kind, title, message: msg, project_id: d.project_id, dedupe_key: `${d.id}-${kind}` });
    }
  }
  // Limpieza de sesiones expiradas
  run('DELETE FROM sessions WHERE last_seen_at < ?', [new Date(Date.now() - config.idleTimeoutMinutes * 60_000).toISOString()]);
}

async function main() {
  const { isNew } = await openDatabase();
  if (seedIfEmpty()) console.log(`✔ Base de datos inicial creada con datos de la plataforma (${config.dbFile})`);
  else if (isNew) console.log('Base de datos nueva.');
  runDeadlineJob();
  const timer = setInterval(runDeadlineJob, 60 * 60 * 1000);

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`\n  URPMP API escuchando en http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
    console.log(`  Endpoints REST: http://localhost:${config.port}/api/v1\n`);
  });

  const shutdown = () => {
    clearInterval(timer);
    server.close();
    closeDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
