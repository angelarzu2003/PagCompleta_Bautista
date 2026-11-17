import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  maskEmail,
  isValidSha256,
  hasPermission,
  validateCsrfHeader,
  generateCsrfToken,
  safeExternalUrl,
  validateUploadFileName,
} from '../utils/security';
import { calculateWeightedProgress, validateBudgetBreakdown, simulateNetworkDelay } from '../utils/async';
import { Activity, BudgetPhaseBreakdown } from '../types/domain';

// Pruebas de utilidades puras del cliente. Las reglas de negocio y de autorización
// (CSRF, IDOR, 409, BR-013, FR-022...) se prueban contra la API real en backend/test/.

describe('Utilidades de seguridad, concurrencia y formato del cliente', () => {
  it('Sanitiza cadenas con código potencialmente malicioso (XSS)', () => {
    const dirty = '<script>alert("hack")</script>&param=\'test\'/';
    const clean = sanitizeInput(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('</script>');
    expect(clean).toContain('&lt;script&gt;');
    expect(clean).toContain('&quot;hack&quot;');
    expect(clean).toContain('&#x27;test&#x27;');
  });

  it('Enmascara correos institucionales para resguardo de privacidad', () => {
    expect(maskEmail('roberto.mendoza@urpmp.edu.pe')).toBe('r***a@urpmp.edu.pe');
    expect(maskEmail('coordinacion@urpmp.edu.pe')).toBe('c***n@urpmp.edu.pe');
    expect(maskEmail('invalid')).toBe('***@***.***');
  });

  it('Valida hashes criptográficos de integridad SHA-256 (64 caracteres hexadecimales)', () => {
    const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const invalidHashShort = 'e3b0c44298fc1c149afbf4c8';
    const invalidHashChars = 'z3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85g';

    expect(isValidSha256(validHash)).toBe(true);
    expect(isValidSha256(invalidHashShort)).toBe(false);
    expect(isValidSha256(invalidHashChars)).toBe(false);
  });

  it('Verifica tokens CSRF para peticiones mutables (coincidencia exacta con el token emitido)', () => {
    const issued = generateCsrfToken();
    expect(validateCsrfHeader(issued, issued)).toBe(true);
    // Antes cualquier cadena con el prefijo 'csrf-tok-' se aceptaba
    expect(validateCsrfHeader('csrf-tok-inventado-por-atacante', issued)).toBe(false);
    expect(validateCsrfHeader('invalid-token', issued)).toBe(false);
    expect(validateCsrfHeader(null, issued)).toBe(false);
    expect(validateCsrfHeader(issued, null)).toBe(false);
  });

  it('Genera tokens CSRF aleatorios y distintos', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^csrf-tok-[0-9a-f]{32}$/);
  });

  it('Aplica matriz de permisos RBAC estricta (Tabla 8.3 de A3)', () => {
    expect(hasPermission('researcher', 'create_project')).toBe(true);
    expect(hasPermission('researcher', 'assign_reviewers')).toBe(false);
    expect(hasPermission('committee_member', 'vote_committee')).toBe(true);
    expect(hasPermission('committee_member', 'edit_parameters')).toBe(false);
    expect(hasPermission('research_coordinator', 'validate_product')).toBe(true);
    expect(hasPermission('administrator', 'view_audit_log')).toBe(true);
  });

  it('Calcula sincrónicamente el avance ponderado de actividades con precisión', () => {
    const activities: Activity[] = [
      {
        id: 'act-1',
        project_id: 'proj-1',
        name: 'Actividad 1',
        description: 'Descripción de prueba',
        responsible_user_id: 'u-pi-001',
        weight: 40,
        weighting_rule_version: 'v1.0',
        progress: 100,
        start_date: '2026-01-01',
        due_date: '2026-03-31',
        is_overdue: false,
        deliverables: [],
      },
      {
        id: 'act-2',
        project_id: 'proj-1',
        name: 'Actividad 2',
        description: 'Descripción de prueba',
        responsible_user_id: 'u-pi-001',
        weight: 60,
        weighting_rule_version: 'v1.0',
        progress: 50,
        start_date: '2026-04-01',
        due_date: '2026-08-31',
        is_overdue: false,
        deliverables: [],
      },
    ];

    // (40*100 + 60*50) / 100 = (4000 + 3000) / 100 = 70.00%
    const overall = calculateWeightedProgress(activities);
    expect(overall).toBe(70);
  });

  it('Verifica el desglose presupuestal del 100% y detecta discrepancias de redondeo', () => {
    const total = 100000;
    const validPhases: BudgetPhaseBreakdown[] = [
      { phase_number: 1, percentage: 40, amount_pen: 40000, name: 'Fase 1' },
      { phase_number: 2, percentage: 40, amount_pen: 40000, name: 'Fase 2' },
      { phase_number: 3, percentage: 20, amount_pen: 20000, name: 'Fase 3' },
    ];

    const result = validateBudgetBreakdown(total, validPhases);
    expect(result.isValid).toBe(true);
    expect(result.totalPercentage).toBe(100);
    expect(result.discrepancy).toBe(0);

    const invalidPhases: BudgetPhaseBreakdown[] = [
      { phase_number: 1, percentage: 40, amount_pen: 40000, name: 'Fase 1' },
      { phase_number: 2, percentage: 35, amount_pen: 35000, name: 'Fase 2' },
      { phase_number: 3, percentage: 20, amount_pen: 20000, name: 'Fase 3' },
    ];

    const invalidResult = validateBudgetBreakdown(total, invalidPhases);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.totalPercentage).toBe(95);
  });

  it('Maneja la simulación de retardo de red asíncrono', async () => {
    const start = Date.now();
    await simulateNetworkDelay(40);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(30);
  });

  it('XSS: bloquea enlaces javascript:, data: y vbscript: en productos científicos', () => {
    expect(safeExternalUrl('javascript:alert(document.cookie)')).toBeNull();
    expect(safeExternalUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeExternalUrl('java\tscript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull();
    expect(safeExternalUrl('Expediente Nº 001942-2026/DIN')).toBeNull();
    expect(safeExternalUrl('https://doi.org/10.1109/JIOT.2025.318942')).toBe('https://doi.org/10.1109/JIOT.2025.318942');
    expect(safeExternalUrl('10.1109/JIOT.2025.318942')).toBe('https://doi.org/10.1109/JIOT.2025.318942');
  });

});
