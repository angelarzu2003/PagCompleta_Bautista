import express from 'express';
import { all, get, fromJson } from '../db.js';
import { requireAuth } from '../auth.js';
import { errors, audit, sha256, hasPermission } from '../lib.js';
import { listProjects, maskNationalId, PRODUCT_SELECT, serializeProduct, canRead, listActivities } from '../repo.js';
import { buildPdf } from '../pdf.js';

export const router = express.Router();

// ===========================================================================
// REPORTES INSTITUCIONALES (FR-037..041)
// ===========================================================================
function scopedData(session, { department_id, year }) {
  if (!hasPermission(session.role, 'view_reports') && session.role !== 'researcher') throw errors.forbidden();
  let projects = listProjects(session);
  if (session.role === 'department_coordinator') projects = projects.filter(p => p.department_id === session.user.department_id);
  if (department_id && department_id !== 'all') projects = projects.filter(p => p.department_id === department_id);
  if (year && year !== 'all') {
    const y = Number(year);
    projects = projects.filter(p => Number(p.start_date.slice(0, 4)) <= y && Number(p.end_date.slice(0, 4)) >= y);
  }
  const ids = new Set(projects.map(p => p.id));
  // BR-013: solo productos validados cuentan en los indicadores
  const products = all(`${PRODUCT_SELECT} WHERE pr.validated_at IS NOT NULL ORDER BY pr.product_date DESC`)
    .filter(r => ids.has(r.project_id))
    .map(serializeProduct);
  const overdue = [];
  for (const p of projects) {
    if (p.status !== 'In progress') continue;
    for (const a of listActivities(p.id)) {
      for (const d of a.deliverables || []) {
        if (d.status === 'Overdue') overdue.push({ project_id: p.id, project_code: p.code, project_title: p.title, activity: a.name, code: d.code, name: d.name, due_date: d.due_date, responsible: a.responsible_name });
      }
    }
  }
  return { projects, products, overdue };
}

router.get('/reports/summary', requireAuth, (req, res) => {
  const { projects, products, overdue } = scopedData(req.session, req.query);
  const byStatus = {};
  const byDepartment = {};
  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    const key = p.department_name || p.department_id;
    byDepartment[key] ||= { projects: 0, funding: 0 };
    byDepartment[key].projects++;
    byDepartment[key].funding += p.requested_funding;
  }
  const productsByType = {};
  for (const pr of products) productsByType[pr.type] = (productsByType[pr.type] || 0) + 1;
  const execution = projects.filter(p => p.status === 'In progress');
  res.json({
    generated_at: new Date().toISOString(),
    totals: {
      projects: projects.length,
      in_progress: execution.length,
      approved_funding: projects.filter(p => ['Approved', 'In progress', 'Closure requested', 'Closed'].includes(p.status)).reduce((a, p) => a + p.requested_funding, 0),
      requested_funding: projects.reduce((a, p) => a + p.requested_funding, 0),
      validated_products: products.length,
      overdue_deliverables: overdue.length,
      average_progress: execution.length ? Number((execution.reduce((a, p) => a + (p.overall_progress || 0), 0) / execution.length).toFixed(2)) : 0,
    },
    by_status: byStatus,
    by_department: byDepartment,
    products_by_type: productsByType,
    projects,
    products,
    overdue,
  });
});

const csvCell = v => {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutraliza inyección de fórmulas en Excel (CSV injection)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const STATUS_ES = {
  Draft: 'Borrador', Submitted: 'Enviado', 'Under review': 'En evaluación', Approved: 'Aprobado', Rejected: 'Rechazado',
  'Changes requested': 'Subsanación', 'In progress': 'En ejecución', Suspended: 'Suspendido', 'Closure requested': 'Cierre solicitado', Closed: 'Cerrado', Cancelled: 'Cancelado',
};

router.get('/reports/export', requireAuth, (req, res) => {
  const kind = req.query.kind || 'projects';
  const format = req.query.format === 'pdf' ? 'pdf' : 'csv';
  const { projects, products, overdue } = scopedData(req.session, req.query);
  let header;
  let rows;
  let title;
  if (kind === 'products') {
    title = 'Reporte de Productos Científicos Validados (BR-013)';
    header = ['Proyecto', 'Tipo', 'Título', 'Autores', 'Fecha', 'Medio', 'DOI/URL', 'Validado el'];
    rows = products.map(p => [p.project_code, p.type, p.title, p.authors, p.product_date, p.venue, p.doi_or_url, p.validated_at?.slice(0, 10)]);
  } else if (kind === 'overdue') {
    title = 'Reporte de Entregables Vencidos (FR-039)';
    header = ['Proyecto', 'Código', 'Entregable', 'Actividad', 'Responsable', 'Vencimiento'];
    rows = overdue.map(o => [o.project_code, o.code, o.name, o.activity, o.responsible, o.due_date]);
  } else {
    title = 'Reporte de Proyectos por Estado (FR-037)';
    header = ['Código', 'Título', 'Investigador Principal', 'Departamento', 'Estado', 'Inicio', 'Término', 'Monto (S/)', 'Avance (%)'];
    rows = projects.map(p => [p.code, p.title, p.pi_full_name, p.department_name, STATUS_ES[p.status] || p.status, p.start_date, p.end_date, p.requested_funding.toFixed(2), p.overall_progress]);
  }
  if (!rows.length) throw errors.invalid('La exportación está deshabilitada porque no existen registros que coincidan con los filtros.');
  audit(req.session, 'REPORT_EXPORTED', 'report', kind, { format, rows: rows.length, filters: req.query });
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    const csv = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${kind}_${stamp}.csv"`);
    return res.send(csv);
  }
  const body = [
    `Generado: ${new Date().toLocaleString('es-PE')} por ${req.session.fullName}`,
    `Registros: ${rows.length}`,
    '',
    ...rows.map((r, i) => `${i + 1}. ${r.filter(v => v !== null && v !== undefined && v !== '').join(' | ')}`),
  ];
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_${kind}_${stamp}.pdf"`);
  res.send(buildPdf(title, body));
});

// ===========================================================================
// VERIFICACIÓN PÚBLICA (sin sesión, NFR-009: datos personales enmascarados)
// ===========================================================================
function publicRecord(cvd) {
  const p = get(
    `SELECT p.*, u.full_name AS pi_name, u.national_id, d.name AS department_name FROM projects p
     JOIN users u ON u.id = p.pi_user_id LEFT JOIN catalog_items d ON d.id = p.department_id
     WHERE upper(p.cvd_code) = upper(?)`,
    [String(cvd || '').trim()]
  );
  if (!p) throw errors.notFound('No existe un documento con ese Código de Verificación Digital.');
  const approvedAt = get(`SELECT created_at FROM status_history WHERE project_id = ? AND to_status = 'Approved' ORDER BY created_at LIMIT 1`, [p.id])?.created_at;
  const hash = sha256([p.cvd_code, p.code, p.resolution_number, p.pi_user_id, p.requested_funding, approvedAt].join('|'));
  const score = get(
    `SELECT AVG(e.total_score) AS s FROM evaluations e JOIN review_assignments a ON a.id = e.assignment_id WHERE a.project_id = ?`,
    [p.id]
  )?.s;
  return {
    cvd_code: p.cvd_code,
    anonymous_code: p.anonymous_code,
    evaluation_score: score === null || score === undefined ? null : Number(Number(score).toFixed(2)),
    valid: !['Cancelled'].includes(p.status),
    project_code: p.code,
    project_title: p.confidential ? 'Proyecto Confidencial (título reservado)' : p.title,
    department_name: p.department_name,
    pi_full_name: p.pi_name,
    pi_masked_national_id: maskNationalId(p.national_id),
    resolution_number: p.resolution_number,
    approved_at: approvedAt,
    status: p.status,
    start_date: p.start_date,
    end_date: p.end_date,
    requested_funding: p.requested_funding,
    budget_breakdown: fromJson(p.budget_breakdown, []),
    document_hash: hash,
  };
}

router.get('/public/verify/:cvd', (req, res) => {
  res.json(publicRecord(req.params.cvd));
});

router.get('/public/verify/:cvd/certificate.pdf', (req, res) => {
  const r = publicRecord(req.params.cvd);
  const pdf = buildPdf('Constancia de Verificacion Digital - URPMP', [
    `Codigo CVD: ${r.cvd_code}`,
    `Estado del documento: ${r.valid ? 'AUTENTICO Y VIGENTE' : 'ANULADO'}`,
    '',
    `Proyecto: ${r.project_title}`,
    `Codigo de proyecto: ${r.project_code}`,
    `Unidad academica: ${r.department_name}`,
    `Investigador Principal: ${r.pi_full_name} (DNI ${r.pi_masked_national_id})`,
    `Resolucion de adjudicacion: ${r.resolution_number || '-'}`,
    `Fecha de aprobacion: ${r.approved_at ? r.approved_at.slice(0, 10) : '-'}`,
    `Periodo de ejecucion: ${r.start_date} a ${r.end_date}`,
    `Monto adjudicado: S/ ${r.requested_funding.toFixed(2)}`,
    '',
    `Huella SHA-256: ${r.document_hash}`,
    '',
    `Verifique en linea ingresando el codigo CVD en la seccion "Verificacion publica" de la plataforma.`,
  ]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="constancia_${r.cvd_code}.pdf"`);
  res.send(pdf);
});

router.get('/public/resolution/:cvd', (req, res) => {
  const r = publicRecord(req.params.cvd);
  res.json(r);
});

export { canRead };
