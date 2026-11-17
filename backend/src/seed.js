/**
 * Datos iniciales de la plataforma URPMP.
 * Se cargan automáticamente la primera vez que arranca el servidor (BD vacía) o
 * manualmente con `npm run seed` (borra y vuelve a crear la base de datos).
 *
 * Todo lo que el sistema muestra sale de estas tablas: no hay datos "quemados" en el frontend.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { openDatabase, run, get, transaction, toJson, saveNow, closeDatabase } from './db.js';
import { audit, sha256 } from './lib.js';
import { buildPdf } from './pdf.js';

const USERS = [
  ['u-pi-001', 'roberto.mendoza@urpmp.edu.pe', 'Dr. Roberto Mendoza Vargas', 'dept-ingenieria', ['researcher'], 'Docente Investigador Principal - RENACYT Nivel III', '41890342', '2026-01-10T08:00:00Z'],
  ['u-student-002', 'carlos.alva@urpmp.edu.pe', 'Br. Carlos Alva Paredes', 'dept-ingenieria', ['student_researcher'], 'Tesista de Ingeniería Electrónica', '72451891', '2026-01-12T09:30:00Z'],
  ['u-coord-003', 'elena.morales@urpmp.edu.pe', 'Dra. Elena Morales', 'dept-investigacion', ['research_coordinator'], 'Coordinadora General de Investigación', '40122554', '2026-01-05T10:15:00Z'],
  ['u-committee-004', 'carmen.valdivia@urpmp.edu.pe', 'Dra. Carmen Valdivia Prado', 'dept-etica', ['committee_member'], 'Presidenta del Comité Institucional de Ética (CIE)', '29811112', '2026-01-08T11:00:00Z'],
  ['u-deptcoord-005', 'marcos.salinas@urpmp.edu.pe', 'Ing. Marcos Salinas', 'dept-ingenieria', ['department_coordinator'], 'Coordinador de Investigación - Facultad de Ingeniería', '43560729', '2026-01-09T14:20:00Z'],
  ['u-authority-006', 'aurelio.benavides@urpmp.edu.pe', 'Dr. Aurelio Benavides Castro (Rector)', 'dept-rectorado', ['university_authority'], 'Rector', '08451001', '2026-01-02T10:00:00Z'],
  ['u-admin-007', 'sofia.quispe@urpmp.edu.pe', 'Lic. Sofía Quispe', 'dept-ti', ['administrator'], 'Administradora de Sistemas', '46778990', '2026-01-02T08:00:00Z'],
  ['u-pi-008', 'lucia.paredes@urpmp.edu.pe', 'Dra. Lucía Paredes Huamán', 'dept-salud', ['researcher'], 'Docente Investigadora - Salud Pública', '40995123', '2026-01-14T09:00:00Z'],
  ['u-pi-009', 'javier.rojas@urpmp.edu.pe', 'Mg. Javier Rojas Calderón', 'dept-empresas', ['researcher'], 'Docente Investigador - Economía Circular', '44120876', '2026-01-15T16:40:00Z'],
  ['u-pi-010', 'ana.torres@urpmp.edu.pe', 'Dra. Ana Torres Villanueva', 'dept-humanidades', ['researcher'], 'Docente Investigadora - Lingüística Andina', '41237765', '2026-01-16T11:25:00Z'],
  ['u-committee-011', 'fernando.cardenas@urpmp.edu.pe', 'Dr. Fernando Cárdenas Rojas', 'dept-etica', ['committee_member'], 'Vocal de Metodología y Bioética del CIE', '25660341', '2026-01-08T12:10:00Z'],
  ['u-committee-012', 'teresa.palomino@urpmp.edu.pe', 'Mg. Teresa Palomino Hurtado', 'dept-etica', ['committee_member'], 'Secretaria Técnica del CIE', '42318870', '2026-01-08T12:30:00Z'],
  ['u-student-013', 'diana.quispe@urpmp.edu.pe', 'Br. Diana Quispe Mamani', 'dept-salud', ['student_researcher'], 'Tesista de Enfermería', '74120455', null],
];

const CATALOGS = {
  departments: [
    ['dept-ingenieria', 'Facultad de Ingeniería y Ciencias Ambientales'],
    ['dept-salud', 'Facultad de Ciencias de la Salud'],
    ['dept-empresas', 'Facultad de Ciencias Empresariales'],
    ['dept-humanidades', 'Facultad de Humanidades y Educación'],
    ['dept-investigacion', 'Coordinación General de Investigación'],
    ['dept-etica', 'Comité Institucional de Ética en Investigación'],
    ['dept-rectorado', 'Rectorado Institucional'],
    ['dept-ti', 'Dirección de Tecnologías de Información'],
  ],
  research_areas: [
    ['area-ambiente', 'Monitoreo Ambiental y Cambio Climático'],
    ['area-iot', 'Internet de las Cosas y Redes de Sensores'],
    ['area-biotec', 'Biotecnología y Recursos Hídricos'],
    ['area-salud', 'Salud Pública y Epidemiología'],
    ['area-economia', 'Economía Circular y Desarrollo Sostenible'],
    ['area-educacion', 'Educación Intercultural y Lenguas Originarias'],
  ],
  research_lines: [
    ['line-cuencas', 'Sensores Inalámbricos en Cuencas Altoandinas', 'area-ambiente'],
    ['line-calidad-agua', 'Biomarcadores de Calidad Hídrica', 'area-biotec'],
    ['line-telemetria', 'Telemetría de Bajo Costo en Zonas Remotas', 'area-iot'],
    ['line-nutricion', 'Nutrición y Anemia Infantil', 'area-salud'],
    ['line-mypes', 'Cadenas de Valor y MYPEs Sostenibles', 'area-economia'],
    ['line-quechua', 'Revitalización Digital del Quechua', 'area-educacion'],
  ],
  project_types: [
    ['type-fondos-internos', 'Investigación con Fondos Concursables Internos'],
    ['type-fondos-externos', 'Investigación con Financiamiento Externo / Canon'],
    ['type-institucional', 'Proyecto de Innovación Institucional Estratégica'],
  ],
  deliverable_types: [
    ['deliv-informe-tecnico', 'Informe Técnico Periódico'],
    ['deliv-prototipo', 'Prototipo Funcional de Hardware/Software'],
    ['deliv-articulo', 'Manuscrito de Artículo Científico'],
    ['deliv-informe-final', 'Informe Final de Liquidación Científica'],
  ],
};

const budget = (total, names) => {
  const pct = [40, 40, 20];
  return pct.map((p, i) => ({
    phase_number: i + 1,
    name: names[i],
    percentage: p,
    amount_pen: Math.round(total * p) / 100,
    amount_usd: Math.round((total * p) / 100 / 3.75),
  }));
};
const STD_PHASES = ['Anticipo Fase I: Adquisiciones y Preparación', 'Hito Intermedio Fase II: Trabajo de Campo', 'Hito Final Fase III: Análisis y Publicación'];

const PROJECTS = [
  {
    id: 'proj-2023-019', code: 'PID-2023-CRH-019', anonymous_code: '#PROP-2025-084-ANON',
    title: 'Despliegue de Red Telemétrica de Sensores IoT de Bajo Costo para Monitoreo Bioclimático en Cuencas Altoandinas',
    pi: 'u-pi-001', dept: 'dept-ingenieria', area: 'area-ambiente', line: 'line-cuencas', type: 'type-fondos-internos',
    status: 'In progress', confidential: false, start: '2024-03-01', end: '2026-11-30', funding: 157500,
    row_version: 4, resolution: 'R.R. Nº 1042-2024-R-URPMP', cvd: 'URP-9482-TX-2024', created: '2024-01-15T10:00:00Z',
    budget: budget(157500, ['Anticipo Fase I: Adquisición de Sensores y Calibración', 'Hito Intermedio Fase II: Despliegue en Campo y Telemetría', 'Hito Final Fase III: Validación de Datos y Publicación']),
    version: {
      no: 2,
      summary: 'El proyecto propone diseñar, construir e instalar nodos sensores IoT de bajo costo energéticamente autónomos para medir variables microclimáticas críticas en cuencas de cabecera. Se desplegarán 12 estaciones LoRaWAN en un gradiente altitudinal de 3200 a 4400 msnm, cuyos datos se validarán frente a estaciones meteorológicas de referencia del SENAMHI.',
      general_objective: 'Implementar una red telemétrica resiliente basada en tecnología LoRaWAN para el monitoreo bioclimático continuo en cuencas altoandinas.',
      specific: [
        'Diseñar la arquitectura electrónica y encapsulado estanco IP67 para nodos sensores de bajo consumo.',
        'Desplegar 12 estaciones de telemetría distribuidas a lo largo de la cuenca piloto.',
        'Validar la exactitud de los datos mediante correlación con estaciones meteorológicas estándar de referencia.',
      ],
      justification: 'La escasez de estaciones en zonas de altitud limita la toma de decisiones para prevención de desastres y gestión hídrica eficiente.',
      methodology: 'Metodología mixta con diseño experimental de circuitos, pruebas de campo en gradiente altitudinal de 3200 a 4400 msnm y análisis estadístico multivariado.',
      funding_source: 'Fondos Concursables Extraordinarios de Canon 2024 - URPMP',
      created: '2024-02-15T12:00:00Z',
    },
    members: [['u-student-002', 'student_researcher', '2024-03-01T09:00:00Z']],
    history: [
      [null, 'Draft', 'Registro inicial de la propuesta.', '2024-01-10T09:00:00Z', 'u-pi-001'],
      ['Draft', 'Submitted', 'Envío formal a la Convocatoria de Fondos Concursables 2024.', '2024-01-15T10:00:00Z', 'u-pi-001'],
      ['Submitted', 'Under review', 'Asignación de revisor par ciego y Comité de Ética.', '2024-01-20T14:30:00Z', 'u-coord-003'],
      ['Under review', 'Changes requested', 'Observaciones del CIE sobre consentimiento comunal y sostenibilidad de equipos.', '2024-02-02T11:00:00Z', 'u-coord-003'],
      ['Changes requested', 'Under review', 'Subsanación v1.1 presentada por el investigador.', '2024-02-15T12:00:00Z', 'u-pi-001'],
      ['Under review', 'Approved', 'Dictamen colegiado favorable 3/3. Puntaje 91/100.', '2024-02-26T16:00:00Z', 'u-coord-003'],
      ['Approved', 'In progress', 'Promulgación de R.R. Nº 1042-2024-R-URPMP e inicio de ejecución.', '2024-03-01T08:00:00Z', 'u-coord-003'],
    ],
  },
  {
    id: 'proj-2024-042', code: 'PID-2024-BTH-042', anonymous_code: '#PROP-2026-112-ANON',
    title: 'Bioprospección de Microalgas Nativas para Tratamiento de Efluentes Mineros en Lagunas Altoandinas',
    pi: 'u-pi-001', dept: 'dept-ingenieria', area: 'area-biotec', line: 'line-calidad-agua', type: 'type-fondos-externos',
    status: 'Submitted', confidential: false, start: '2026-06-01', end: '2027-12-31', funding: 98000, row_version: 1, created: '2026-09-28T15:20:00Z',
    budget: budget(98000, STD_PHASES),
    version: {
      no: 1,
      summary: 'Se aislarán y caracterizarán cepas de microalgas nativas de lagunas altoandinas con capacidad de biorremediación de metales pesados (Cu, Zn, Pb, As) presentes en efluentes mineros. Se evaluará su eficiencia en fotobiorreactores piloto a escala de laboratorio y campo.',
      general_objective: 'Determinar la capacidad de biorremediación de microalgas nativas sobre efluentes mineros de lagunas altoandinas.',
      specific: [
        'Aislar y caracterizar molecularmente al menos 10 cepas de microalgas nativas.',
        'Medir la tasa de remoción de cobre, zinc, plomo y arsénico en condiciones controladas.',
        'Escalar el tratamiento a un fotobiorreactor piloto de 500 litros en la zona de estudio.',
      ],
      justification: 'Los efluentes de la pequeña minería afectan la calidad del agua de comunidades que dependen de las lagunas para riego y consumo animal.',
      methodology: 'Muestreo estratificado en 6 lagunas, cultivo en medios selectivos, secuenciación 18S rRNA, espectrometría de absorción atómica y diseño factorial 2^3.',
      funding_source: 'Convenio de Canon Minero 2026 - Gobierno Regional',
      created: '2026-09-28T15:20:00Z',
    },
    members: [],
    history: [
      [null, 'Draft', 'Registro inicial de la propuesta.', '2026-09-20T10:00:00Z', 'u-pi-001'],
      ['Draft', 'Submitted', 'Envío formal a la convocatoria con financiamiento externo 2026.', '2026-09-28T15:20:00Z', 'u-pi-001'],
    ],
  },
  {
    id: 'proj-2024-009-conf', code: 'PID-2024-PAT-009', anonymous_code: '#PROP-2026-009-CONF',
    title: 'Dispositivo Portátil de Detección Rápida de Patógenos Hídricos mediante Espectrometría Óptica (Confidencial)',
    pi: 'u-pi-001', dept: 'dept-ingenieria', area: 'area-iot', line: 'line-telemetria', type: 'type-institucional',
    status: 'Under review', confidential: true, start: '2026-08-01', end: '2027-08-01', funding: 135000, row_version: 2, created: '2026-07-02T09:10:00Z',
    budget: budget(135000, STD_PHASES),
    version: {
      no: 1,
      summary: 'Desarrollo de un prototipo portátil que identifica coliformes y E. coli en agua de consumo en menos de 30 minutos mediante espectrometría de fluorescencia de bajo costo. El proyecto es confidencial por su potencial de patentamiento.',
      general_objective: 'Desarrollar un prototipo portátil de detección rápida de patógenos hídricos con tecnología óptica de bajo costo.',
      specific: [
        'Diseñar el módulo óptico de excitación y lectura de fluorescencia.',
        'Calibrar el dispositivo frente al método estándar de filtración por membrana.',
        'Elaborar el expediente técnico para la solicitud de patente ante INDECOPI.',
      ],
      justification: 'El análisis microbiológico de agua en zonas rurales demora más de 48 horas y requiere laboratorios acreditados lejanos.',
      methodology: 'Prototipado iterativo, validación cruzada con laboratorio acreditado y análisis de sensibilidad/especificidad con curvas ROC.',
      funding_source: 'Fondo de Innovación Institucional Estratégica 2026',
      created: '2026-07-02T09:10:00Z',
    },
    members: [['u-student-002', 'student_researcher', '2026-08-01T09:00:00Z']],
    history: [
      [null, 'Draft', 'Registro inicial de la propuesta.', '2026-06-25T10:00:00Z', 'u-pi-001'],
      ['Draft', 'Submitted', 'Envío formal con cláusula de confidencialidad.', '2026-07-02T09:10:00Z', 'u-pi-001'],
      ['Submitted', 'Under review', 'Asignación de revisor par con acuerdo de confidencialidad.', '2026-07-10T11:00:00Z', 'u-coord-003'],
    ],
  },
  {
    id: 'proj-2024-031', code: 'PID-2024-SAL-031', anonymous_code: '#PROP-2024-031-ANON',
    title: 'Prevalencia de Anemia Ferropénica y Factores Asociados en Niños Menores de 5 Años de Comunidades Altoandinas',
    pi: 'u-pi-008', dept: 'dept-salud', area: 'area-salud', line: 'line-nutricion', type: 'type-fondos-internos',
    status: 'In progress', confidential: false, start: '2025-02-01', end: '2027-01-31', funding: 86400, row_version: 3,
    resolution: 'R.R. Nº 0217-2025-R-URPMP', cvd: 'URP-3317-SL-2025', created: '2024-11-05T08:30:00Z',
    budget: budget(86400, STD_PHASES),
    version: {
      no: 1,
      summary: 'Estudio transversal analítico en 420 niños de 6 a 59 meses de 12 comunidades campesinas, con dosaje de hemoglobina ajustado por altitud, encuesta de consumo alimentario y evaluación de factores socioeconómicos asociados.',
      general_objective: 'Determinar la prevalencia de anemia ferropénica y sus factores asociados en niños menores de 5 años de comunidades altoandinas.',
      specific: [
        'Estimar la prevalencia de anemia con corrección de hemoglobina por altitud según la norma técnica del MINSA.',
        'Identificar factores dietarios y socioeconómicos asociados mediante regresión de Poisson.',
        'Proponer una estrategia comunitaria de suplementación y educación nutricional.',
      ],
      justification: 'La anemia infantil en zonas altoandinas supera el 50% y compromete el desarrollo cognitivo de forma irreversible.',
      methodology: 'Diseño transversal analítico, muestreo por conglomerados bietápico, hemoglobinómetro portátil HemoCue y análisis con Stata 18.',
      funding_source: 'Fondos Concursables Internos 2025 - URPMP',
      created: '2024-11-05T08:30:00Z',
    },
    members: [['u-student-013', 'student_researcher', '2025-02-01T09:00:00Z']],
    history: [
      [null, 'Draft', 'Registro inicial de la propuesta.', '2024-10-28T10:00:00Z', 'u-pi-008'],
      ['Draft', 'Submitted', 'Envío formal a la convocatoria interna 2025.', '2024-11-05T08:30:00Z', 'u-pi-008'],
      ['Submitted', 'Under review', 'Asignación de revisores.', '2024-11-12T10:00:00Z', 'u-coord-003'],
      ['Under review', 'Approved', 'Dictamen favorable. Puntaje 87/100.', '2025-01-10T15:00:00Z', 'u-coord-003'],
      ['Approved', 'In progress', 'Inicio de ejecución.', '2025-02-01T08:00:00Z', 'u-coord-003'],
    ],
  },
  {
    id: 'proj-2025-007', code: 'PID-2025-ECO-007', anonymous_code: '#PROP-2025-007-ANON',
    title: 'Modelo de Economía Circular para MYPEs Agroexportadoras de Quinua y Kiwicha en la Región Sur',
    pi: 'u-pi-009', dept: 'dept-empresas', area: 'area-economia', line: 'line-mypes', type: 'type-fondos-externos',
    status: 'Approved', confidential: false, start: '2026-12-01', end: '2028-05-31', funding: 112000, row_version: 3,
    resolution: 'R.R. Nº 1388-2026-R-URPMP', cvd: 'URP-7731-EC-2026', created: '2026-05-19T17:45:00Z',
    budget: budget(112000, STD_PHASES),
    version: {
      no: 2,
      summary: 'Se diseñará y validará un modelo de economía circular para 30 MYPEs agroexportadoras que aproveche los subproductos de la quinua (saponina, tallos, cáscara) y reduzca la huella hídrica de la cadena productiva.',
      general_objective: 'Diseñar y validar un modelo de economía circular aplicable a MYPEs agroexportadoras de granos andinos.',
      specific: [
        'Diagnosticar los flujos de materiales y residuos de 30 MYPEs mediante análisis de ciclo de vida.',
        'Diseñar tres modelos de negocio para la valorización de subproductos.',
        'Validar el modelo con un piloto en 5 empresas y medir indicadores económicos y ambientales.',
      ],
      justification: 'Las MYPEs exportadoras descartan hasta el 30% de la biomasa cosechada y enfrentan nuevas exigencias de sostenibilidad en mercados europeos.',
      methodology: 'Investigación aplicada con enfoque mixto: análisis de ciclo de vida (ISO 14040), entrevistas en profundidad y piloto cuasi-experimental.',
      funding_source: 'PROCIENCIA - Proyectos de Investigación Aplicada 2026',
      created: '2026-07-14T10:00:00Z',
    },
    members: [],
    history: [
      [null, 'Draft', 'Registro inicial de la propuesta.', '2026-05-10T10:00:00Z', 'u-pi-009'],
      ['Draft', 'Submitted', 'Envío formal a la convocatoria PROCIENCIA.', '2026-05-19T17:45:00Z', 'u-pi-009'],
      ['Submitted', 'Under review', 'Asignación de revisores.', '2026-05-26T09:00:00Z', 'u-coord-003'],
      ['Under review', 'Changes requested', 'Precisar indicadores ambientales del piloto.', '2026-06-30T12:00:00Z', 'u-coord-003'],
      ['Changes requested', 'Under review', 'Subsanación v2 presentada.', '2026-07-14T10:00:00Z', 'u-pi-009'],
      ['Under review', 'Approved', 'Dictamen favorable. Puntaje 84/100.', '2026-10-30T16:00:00Z', 'u-coord-003'],
    ],
  },
  {
    id: 'proj-2025-015', code: 'PID-2025-EDU-015', anonymous_code: '#PROP-2026-131-ANON',
    title: 'Revitalización de la Lengua Quechua mediante Recursos Educativos Digitales en Escuelas Rurales de Educación Básica',
    pi: 'u-pi-010', dept: 'dept-humanidades', area: 'area-educacion', line: 'line-quechua', type: 'type-fondos-internos',
    status: 'Under review', confidential: false, start: '2027-03-01', end: '2028-02-28', funding: 64500, row_version: 2, created: '2026-10-02T11:15:00Z',
    budget: budget(64500, STD_PHASES),
    version: {
      no: 1,
      summary: 'Desarrollo y evaluación de una aplicación móvil offline con 40 unidades didácticas en quechua chanka para estudiantes de 3.º a 6.º grado de primaria en 8 escuelas rurales bilingües.',
      general_objective: 'Evaluar el efecto de recursos educativos digitales en la competencia comunicativa en quechua de estudiantes de primaria rural.',
      specific: [
        'Diseñar 40 unidades didácticas digitales validadas por docentes bilingües y sabios comunales.',
        'Implementar la aplicación offline en 8 instituciones educativas rurales.',
        'Medir el efecto en la competencia oral y escrita mediante un diseño pretest-postest con grupo control.',
      ],
      justification: 'La transmisión intergeneracional del quechua disminuye en las zonas periurbanas y rurales con acceso creciente a dispositivos móviles.',
      methodology: 'Diseño cuasi-experimental con grupo control, investigación-acción participativa con docentes y análisis de covarianza (ANCOVA).',
      funding_source: 'Fondos Concursables Internos 2027 - URPMP',
      created: '2026-10-02T11:15:00Z',
    },
    members: [],
    history: [
      [null, 'Draft', 'Registro inicial de la propuesta.', '2026-09-25T10:00:00Z', 'u-pi-010'],
      ['Draft', 'Submitted', 'Envío formal a la convocatoria interna 2027.', '2026-10-02T11:15:00Z', 'u-pi-010'],
      ['Submitted', 'Under review', 'Asignación de revisor par ciego.', '2026-10-09T10:00:00Z', 'u-coord-003'],
    ],
  },
  {
    id: 'proj-2022-004', code: 'PID-2022-SAL-004', anonymous_code: '#PROP-2022-004-ANON',
    title: 'Vigilancia Epidemiológica Comunitaria de Infecciones Respiratorias Agudas en Zonas de Heladas',
    pi: 'u-pi-008', dept: 'dept-salud', area: 'area-salud', line: 'line-nutricion', type: 'type-fondos-internos',
    status: 'Closed', confidential: false, start: '2022-04-01', end: '2024-03-31', funding: 54000, row_version: 6,
    resolution: 'R.R. Nº 0388-2022-R-URPMP', cvd: 'URP-1204-SL-2022', created: '2022-01-20T09:00:00Z',
    budget: budget(54000, STD_PHASES),
    version: {
      no: 1,
      summary: 'Implementación de un sistema de vigilancia comunitaria de infecciones respiratorias agudas con agentes comunitarios de salud capacitados en 6 distritos afectados por heladas.',
      general_objective: 'Implementar un sistema de vigilancia epidemiológica comunitaria de IRA en zonas de heladas.',
      specific: [
        'Capacitar a 60 agentes comunitarios en detección temprana de signos de alarma.',
        'Implementar un registro digital de casos con reporte semanal a los establecimientos de salud.',
        'Evaluar la oportunidad de referencia de casos graves antes y después de la intervención.',
      ],
      justification: 'Las IRA son la primera causa de mortalidad infantil en temporadas de heladas.',
      methodology: 'Estudio de intervención antes-después con series de tiempo interrumpidas.',
      funding_source: 'Fondos Concursables Internos 2022 - URPMP',
      created: '2022-01-20T09:00:00Z',
    },
    members: [],
    history: [
      [null, 'Draft', 'Registro inicial.', '2022-01-15T10:00:00Z', 'u-pi-008'],
      ['Draft', 'Submitted', 'Envío formal.', '2022-01-20T09:00:00Z', 'u-pi-008'],
      ['Submitted', 'Approved', 'Dictamen favorable.', '2022-03-10T10:00:00Z', 'u-coord-003'],
      ['Approved', 'In progress', 'Inicio de ejecución.', '2022-04-01T08:00:00Z', 'u-coord-003'],
      ['In progress', 'Closure requested', 'Informe final cargado.', '2024-03-20T10:00:00Z', 'u-pi-008'],
      ['Closure requested', 'Closed', 'Cierre aprobado: checklist BR-006 completo.', '2024-04-15T12:00:00Z', 'u-coord-003'],
    ],
  },
  {
    id: 'proj-2025-022', code: 'PID-2025-AMB-022', anonymous_code: '#PROP-2026-140-ANON',
    title: 'Inventario de Glaciares Tropicales y Proyección de Disponibilidad Hídrica al 2050 mediante Teledetección',
    pi: 'u-pi-001', dept: 'dept-ingenieria', area: 'area-ambiente', line: 'line-cuencas', type: 'type-fondos-externos',
    status: 'Changes requested', confidential: false, start: '2027-01-15', end: '2028-12-15', funding: 143000, row_version: 3, created: '2026-08-30T10:00:00Z',
    budget: budget(143000, STD_PHASES),
    version: {
      no: 1,
      summary: 'Se actualizará el inventario de glaciares de la Cordillera del Huaytapallana con imágenes Sentinel-2 y Landsat 8/9 y se proyectará la disponibilidad hídrica al 2050 con modelos hidrológicos semidistribuidos.',
      general_objective: 'Cuantificar el retroceso glaciar y proyectar la disponibilidad hídrica de la subcuenca al año 2050.',
      specific: [
        'Actualizar el inventario de cobertura glaciar 1990-2026 con teledetección multitemporal.',
        'Calibrar un modelo hidrológico semidistribuido con datos de caudal observados.',
        'Proyectar escenarios de disponibilidad hídrica bajo SSP2-4.5 y SSP5-8.5.',
      ],
      justification: 'La ciudad depende en un 40% del aporte glaciar en época seca.',
      methodology: 'Clasificación supervisada con índice NDSI, modelo hidrológico GR4J y downscaling estadístico de CMIP6.',
      funding_source: 'Convenio de Canon Minero 2026 - Gobierno Regional',
      created: '2026-08-30T10:00:00Z',
    },
    members: [['u-student-002', 'collaborator', '2026-09-01T09:00:00Z']],
    history: [
      [null, 'Draft', 'Registro inicial.', '2026-08-22T10:00:00Z', 'u-pi-001'],
      ['Draft', 'Submitted', 'Envío formal.', '2026-08-30T10:00:00Z', 'u-pi-001'],
      ['Submitted', 'Under review', 'Asignación de revisores.', '2026-09-05T09:00:00Z', 'u-coord-003'],
      ['Under review', 'Changes requested', 'El CIE solicita precisar el plan de gestión de datos y el consentimiento de comunidades usuarias del agua.', '2026-10-21T15:30:00Z', 'u-coord-003'],
    ],
  },
  {
    id: 'proj-2025-028', code: 'PID-2025-ECO-028', anonymous_code: '#PROP-2026-152-ANON',
    title: 'Trazabilidad Blockchain para la Cadena de Valor del Café de Especialidad en la Selva Central',
    pi: 'u-pi-009', dept: 'dept-empresas', area: 'area-economia', line: 'line-mypes', type: 'type-fondos-internos',
    status: 'Draft', confidential: false, start: '2027-04-01', end: '2028-03-31', funding: 72000, row_version: 1, created: '2026-11-08T19:05:00Z',
    budget: budget(72000, STD_PHASES),
    version: {
      no: 1,
      summary: 'Borrador: prototipo de trazabilidad de lotes de café de especialidad desde la finca hasta el exportador.',
      general_objective: 'Desarrollar un prototipo de trazabilidad para lotes de café de especialidad.',
      specific: [
        'Mapear los puntos críticos de la cadena de valor del café.',
        'Desarrollar el prototipo de registro inmutable de lotes.',
        'Evaluar la disposición a pagar de compradores internacionales.',
      ],
      justification: 'Los compradores exigen trazabilidad verificable de origen.',
      methodology: 'Investigación aplicada con prototipado ágil.',
      funding_source: null,
      created: '2026-11-08T19:05:00Z',
    },
    members: [],
    history: [[null, 'Draft', 'Registro inicial de la propuesta.', '2026-11-08T19:05:00Z', 'u-pi-009']],
  },
  {
    id: 'proj-2023-011', code: 'PID-2023-EDU-011', anonymous_code: '#PROP-2023-011-ANON',
    title: 'Gamificación del Aprendizaje de Matemáticas en Educación Secundaria Rural sin Conectividad',
    pi: 'u-pi-010', dept: 'dept-humanidades', area: 'area-educacion', line: 'line-quechua', type: 'type-fondos-internos',
    status: 'Rejected', confidential: false, start: '2024-03-01', end: '2025-02-28', funding: 48000, row_version: 3, created: '2023-10-12T10:00:00Z',
    budget: budget(48000, STD_PHASES),
    version: {
      no: 1,
      summary: 'Propuesta de juegos educativos offline para matemáticas en secundaria rural.',
      general_objective: 'Evaluar el efecto de la gamificación en el rendimiento en matemáticas.',
      specific: ['Diseñar 10 juegos educativos.', 'Aplicarlos en 4 colegios.', 'Medir el rendimiento académico.'],
      justification: 'Bajo rendimiento en matemáticas en evaluaciones censales.',
      methodology: 'Diseño preexperimental con un solo grupo.',
      funding_source: 'Fondos Concursables Internos 2024 - URPMP',
      created: '2023-10-12T10:00:00Z',
    },
    members: [],
    history: [
      [null, 'Draft', 'Registro inicial.', '2023-10-05T10:00:00Z', 'u-pi-010'],
      ['Draft', 'Submitted', 'Envío formal.', '2023-10-12T10:00:00Z', 'u-pi-010'],
      ['Submitted', 'Under review', 'Asignación de revisores.', '2023-10-20T10:00:00Z', 'u-coord-003'],
      ['Under review', 'Rejected', 'Diseño preexperimental sin grupo control insuficiente para la pregunta causal planteada. Puntaje 52/100.', '2023-12-01T10:00:00Z', 'u-coord-003'],
    ],
  },
];

// [id, project, name, description, responsible, weight, progress, start, due, deliverables[]]
const ACTIVITIES = [
  ['act-01', 'proj-2023-019', 'Calibración y banco de pruebas de sensores atmosféricos', 'Verificación metrológica en cámara climática de los transductores de humedad y temperatura.', 'u-pi-001', 0.3, 100, '2024-03-01', '2024-06-30',
    [['del-01', 'H1.1', 'Reporte de Curvas de Calibración e Incertidumbre', null, '2024-06-25', 'Approved', ['doc-ev-001']]]],
  ['act-02', 'proj-2023-019', 'Despliegue e instalación de nodos LoRaWAN en cuenca alta', 'Instalación física de mástiles de 3 metros y paneles solares con pasarela de enlace en puna.', 'u-student-002', 0.4, 75, '2024-07-01', '2026-10-20',
    [['del-02', 'H2.2', 'Protocolo de Enlace y Telemetría de 12 Estaciones', 'Acta técnica firmada de recepción de señales en la nube con prueba de paquetes recibidos.', '2026-10-20', 'Pending', []]]],
  ['act-03', 'proj-2023-019', 'Análisis de correlación y modelo predictivo bioclimático', 'Procesamiento de series de tiempo y entrenamiento de algoritmos de pronóstico de heladas.', 'u-pi-001', 0.3, 30, '2025-01-10', '2026-11-25',
    [['del-03', 'H3.1', 'Borrador de Artículo para Revista Indexada Scopus Q1', null, '2026-11-24', 'Pending', []]]],
  ['act-11', 'proj-2024-031', 'Trabajo de campo: tamizaje de hemoglobina', 'Dosaje de hemoglobina con HemoCue en 12 comunidades y aplicación de encuesta alimentaria.', 'u-student-013', 0.5, 80, '2025-03-01', '2026-12-15',
    [['del-11', 'H1.1', 'Base de datos depurada de 420 participantes', null, '2026-12-15', 'Pending', []]]],
  ['act-12', 'proj-2024-031', 'Análisis estadístico multivariado', 'Regresión de Poisson con varianza robusta y análisis de factores asociados.', 'u-pi-008', 0.3, 20, '2026-09-01', '2027-01-10',
    [['del-12', 'H2.1', 'Informe estadístico de factores asociados', null, '2027-01-10', 'Pending', []]]],
  ['act-13', 'proj-2024-031', 'Diseño de la estrategia comunitaria', 'Talleres participativos con agentes comunitarios y madres de familia.', 'u-pi-008', 0.2, 0, '2026-11-01', '2027-01-31',
    [['del-13', 'H3.1', 'Guía de intervención comunitaria', null, '2027-01-31', 'Pending', []]]],
  ['act-21', 'proj-2022-004', 'Capacitación de agentes comunitarios', 'Formación de 60 agentes en signos de alarma de IRA.', 'u-pi-008', 0.4, 100, '2022-04-01', '2022-09-30',
    [['del-21', 'H1.1', 'Informe de capacitación', null, '2022-09-30', 'Approved', ['doc-022-final']]]],
  ['act-22', 'proj-2022-004', 'Vigilancia y evaluación', 'Registro semanal de casos y evaluación de oportunidad de referencia.', 'u-pi-008', 0.6, 100, '2022-10-01', '2024-03-15',
    [['del-22', 'H2.1', 'Informe final de evaluación', null, '2024-03-15', 'Approved', ['doc-022-final']]]],
];

// [id, project, name, type, versions[[note, author, created_at, size_hint]]]
const DOCUMENTS = [
  ['doc-001', 'proj-2023-019', 'Propuesta_Tecnica_Consolidada.pdf', 'proposal', [
    ['Carga inicial de la propuesta para evaluación del comité.', 'u-pi-001', '2024-01-15T10:00:00Z'],
    ['Subsanación de observaciones del Comité de Ética v1.1.', 'u-pi-001', '2024-02-15T12:00:00Z'],
  ]],
  ['doc-ev-001', 'proj-2023-019', 'Informe_Metrologico_Calibracion_H1.1.pdf', 'evidence', [
    ['Evidencia técnica de calibración de sensores en cámara climática.', 'u-pi-001', '2024-06-20T16:30:00Z'],
  ]],
  ['doc-002', 'proj-2023-019', 'Informe_Tecnico_Semestral_2025-II.pdf', 'technical_report', [
    ['Informe técnico semestral de avance físico-financiero.', 'u-pi-001', '2026-01-12T09:40:00Z'],
  ]],
  ['doc-003', 'proj-2023-019', 'Convenio_Comunidad_San_Juan_de_Lucanas.pdf', 'agreement', [
    ['Acta de Consentimiento Libre, Previo e Informado firmada por la asamblea comunal.', 'u-pi-001', '2024-02-10T15:00:00Z'],
  ]],
  ['doc-031-prop', 'proj-2024-031', 'Propuesta_Anemia_Infantil.pdf', 'proposal', [
    ['Carga inicial de la propuesta.', 'u-pi-008', '2024-11-05T08:30:00Z'],
  ]],
  ['doc-042-prop', 'proj-2024-042', 'Propuesta_Microalgas_Efluentes.pdf', 'proposal', [
    ['Carga inicial de la propuesta.', 'u-pi-001', '2026-09-28T15:20:00Z'],
  ]],
  ['doc-022-final', 'proj-2022-004', 'Informe_Final_Vigilancia_IRA.pdf', 'final_report', [
    ['Informe final de liquidación científica.', 'u-pi-008', '2024-03-20T10:00:00Z'],
  ]],
];

const PRODUCTS = [
  ['prod-001', 'proj-2023-019', 'journal_article', 'Autonomous Low-Cost LoRaWAN Sensor Nodes for Extreme Alpine Microclimate Observation', 'Mendoza-Vargas, R., Alva-Paredes, C., Morales, E.', '2025-08-14', 'IEEE Internet of Things Journal (Q1)', 'https://doi.org/10.1109/JIOT.2025.318942', 'published', 'Carta_Aceptacion_IEEE_JIOT.pdf', '2025-08-20T09:15:00Z'],
  ['prod-002', 'proj-2023-019', 'conference_paper', 'Evaluación de Rendimiento de Baterías LiFePO4 con Carga Solar en Heladas Altoandinas a 4200 msnm', 'Alva-Paredes, C., Mendoza-Vargas, R.', '2025-10-05', 'Congreso Latinoamericano de Telecomunicaciones e IoT (CLT 2025)', 'https://clt-2025.org/proceedings/art-84', 'accepted', 'Certificado_Ponencia_CLT2025.pdf', '2025-10-12T11:45:00Z'],
  ['prod-003', 'proj-2023-019', 'patent', 'Módulo de Protección Estanca Térmica con Disipación Pasiva para Sensores Meteorológicos de Altura', 'Mendoza-Vargas, R., Alva-Paredes, C.', '2026-02-18', 'INDECOPI - Dirección de Invenciones y Nuevas Tecnologías', 'Expediente Nº 001942-2026/DIN', 'submitted', null, null],
  ['prod-004', 'proj-2022-004', 'journal_article', 'Vigilancia comunitaria de infecciones respiratorias agudas en zonas de heladas: estudio de series de tiempo interrumpidas', 'Paredes-Huamán, L., Quispe-Mamani, D.', '2024-09-02', 'Revista Peruana de Medicina Experimental y Salud Pública (Q3)', 'https://doi.org/10.17843/rpmesp.2024.413.13021', 'published', 'Constancia_Publicacion_RPMESP.pdf', '2024-09-10T10:00:00Z'],
  ['prod-005', 'proj-2022-004', 'thesis', 'Oportunidad de referencia de casos graves de IRA tras la implementación de vigilancia comunitaria', 'Quispe-Mamani, D.', '2024-07-15', 'Repositorio Institucional URPMP', 'https://repositorio.urpmp.edu.pe/handle/20.500.14021/8812', 'published', 'Acta_Sustentacion.pdf', '2024-07-22T12:00:00Z'],
  ['prod-006', 'proj-2024-031', 'conference_paper', 'Corrección de hemoglobina por altitud: comparación de fórmulas en población infantil altoandina', 'Paredes-Huamán, L.', '2026-09-18', 'XIV Congreso Nacional de Salud Pública', null, 'accepted', null, null],
  ['prod-007', 'proj-2023-019', 'software', 'Firmware abierto LoRaNode-Andes v1.2 para nodos meteorológicos de bajo consumo', 'Alva-Paredes, C., Mendoza-Vargas, R.', '2026-05-30', 'GitHub / Zenodo', 'https://doi.org/10.5281/zenodo.11873301', 'published', null, null],
];

const NOTIFICATIONS = [
  ['u-pi-001', 'due_in_7_days', 'Entregable próximo a vencer (7 días)', 'El entregable H3.1 "Borrador de Artículo para Revista Indexada Scopus Q1" del proyecto PID-2023-CRH-019 vence el 24/11/2026.', 'proj-2023-019', '2026-11-17T08:00:00Z', null, 'del-03-due-7'],
  ['u-pi-001', 'overdue_today', 'Entregable vencido', 'El entregable H2.2 "Protocolo de Enlace y Telemetría de 12 Estaciones" venció el 20/10/2026 sin evidencia cargada.', 'proj-2023-019', '2026-10-21T08:00:00Z', null, 'del-02-overdue'],
  ['u-pi-001', 'status_changed', 'Producto de investigación validado', 'La Coordinación ha validado su ponencia en el congreso CLT 2025.', 'proj-2023-019', '2025-10-12T12:00:00Z', '2025-10-12T15:00:00Z', 'prod-002-validated'],
  ['u-pi-001', 'reviewer_comment', 'Observaciones del Comité de Ética recibidas', 'El CIE solicita precisar el plan de gestión de datos del proyecto PID-2025-AMB-022.', 'proj-2025-022', '2026-10-21T15:30:00Z', null, 'proj-2025-022-changes'],
  ['u-coord-003', 'proposal_submitted', 'Nueva propuesta enviada', 'El Dr. Roberto Mendoza Vargas envió la propuesta PID-2024-BTH-042 a la convocatoria con financiamiento externo.', 'proj-2024-042', '2026-09-28T15:20:00Z', null, 'proj-2024-042-submitted'],
  ['u-coord-003', 'evaluation_overdue', 'Producto pendiente de validación', 'La patente "Módulo de Protección Estanca Térmica..." está pendiente de validación desde el 18/02/2026.', 'proj-2023-019', '2026-11-10T09:00:00Z', null, 'prod-003-pending'],
  ['u-committee-004', 'proposal_submitted', 'Expediente asignado para evaluación', 'Se le asignó el expediente #PROP-2026-131-ANON. Fecha límite: 30/11/2026.', 'proj-2025-015', '2026-10-09T10:00:00Z', null, 'rev-015-assigned'],
  ['u-pi-008', 'due_in_7_days', 'Entregable próximo a vencer', 'El entregable H1.1 "Base de datos depurada de 420 participantes" vence el 15/12/2026.', 'proj-2024-031', '2026-11-15T08:00:00Z', null, 'del-11-due'],
  ['u-pi-009', 'status_changed', 'Proyecto aprobado', 'Su proyecto PID-2025-ECO-007 fue aprobado con R.R. Nº 1388-2026-R-URPMP.', 'proj-2025-007', '2026-10-30T16:00:00Z', null, 'proj-2025-007-approved'],
];

// Corpus normativo: cada sección es un fragmento recuperable por el asistente RAG.
const REGULATIONS = [
  {
    id: 'reg-001', title: 'Reglamento General de Investigación Científica, Tecnológica e Innovación URPMP', version: 'v3.2-2024', status: 'active', effective: '2024-01-01',
    sections: [
      ['Artículo 12 (Investigador Principal)', '6', 'equipo', 'Todo proyecto de investigación tiene un único Investigador Principal, docente ordinario o contratado con grado de doctor o maestro, responsable técnico y administrativo del proyecto. Los estudiantes de pregrado y posgrado pueden integrarse como estudiantes investigadores, pero no pueden ser Investigador Principal.'],
      ['Artículo 15 (Registro de propuestas)', '8', 'propuesta', 'Las propuestas se registran exclusivamente en la plataforma institucional dentro del plazo de la convocatoria. La propuesta debe contener resumen de hasta 500 palabras, objetivo general, al menos tres objetivos específicos medibles, justificación, metodología, cronograma y presupuesto detallado por fases.'],
      ['Artículo 18 (Evaluación por pares ciegos)', '11', 'evaluacion', 'Toda propuesta es evaluada por al menos un revisor par ciego y por el Comité Institucional de Ética cuando involucre seres humanos, comunidades o recursos genéticos. Los evaluadores que tengan conflicto de interés con la propuesta, incluida la coautoría o relación laboral directa, deben inhibirse por escrito.'],
      ['Artículo 20 (Rúbrica de evaluación)', '12', 'evaluacion', 'La rúbrica de evaluación otorga hasta 35 puntos al rigor metodológico y viabilidad, hasta 35 puntos al impacto social y transferencia tecnológica y hasta 30 puntos a la coherencia presupuestal y del cronograma. El puntaje mínimo aprobatorio es de 70 puntos sobre 100.'],
      ['Artículo 24.3 (Modificaciones de partidas)', '18', 'presupuesto', 'Toda redistribución presupuestal superior al 10% de una partida requiere informe técnico sustentatorio del Investigador Principal y aprobación previa de la Coordinación de Investigación. No se aprueban modificaciones solicitadas después de transcurrido el 70% del plazo de ejecución.'],
      ['Artículo 27 (Ampliación de plazo)', '20', 'plazos', 'El Investigador Principal puede solicitar por única vez una ampliación de plazo de hasta seis meses, debidamente justificada, con una anticipación mínima de 30 días calendario a la fecha de término del proyecto.'],
      ['Artículo 31 (Entregables y evidencias)', '23', 'entregables', 'Ningún entregable se considera presentado sin al menos un documento probatorio adjunto en la plataforma. Los entregables vencidos sin evidencia generan una alerta automática a la Coordinación y al Investigador Principal.'],
      ['Artículo 35 (Productos de investigación)', '26', 'productos', 'Los productos de investigación (artículos, ponencias, libros, capítulos, tesis, patentes y software) se registran con su evidencia y solo se computan en los indicadores institucionales después de ser validados por la Coordinación de Investigación.'],
      ['Artículo 40 (Cierre del proyecto)', '30', 'cierre', 'El cierre del proyecto requiere el informe final cargado, todos los entregables obligatorios presentados o cancelados formalmente por la Coordinación y al menos un producto de investigación registrado. La Coordinación aprueba el cierre en un plazo máximo de 30 días.'],
    ],
  },
  {
    id: 'reg-002', title: 'Directiva de Fondos Concursables para Proyectos de Canon y Regalías Mineras', version: 'v1.1-2025', status: 'active', effective: '2025-03-15',
    sections: [
      ['Artículo 5 (Montos máximos)', '3', 'presupuesto', 'El monto máximo financiable por proyecto es de S/ 160,000.00 para proyectos de investigación aplicada y de S/ 90,000.00 para proyectos de investigación básica, con una duración máxima de 36 meses.'],
      ['Artículo 8 (Objetivos y metas)', '5', 'propuesta', 'Los objetivos específicos deben redactarse con verbos en infinitivo e incluir indicadores cuantitativos de logro verificables. Se exige un mínimo de tres objetivos específicos por proyecto.'],
      ['Artículo 11 (Desembolsos por fases)', '7', 'presupuesto', 'Los desembolsos se realizan en tres fases: 40% como anticipo a la firma del convenio, 40% contra la aprobación del informe técnico intermedio y 20% contra la aprobación del informe final. La suma de las fases debe ser exactamente igual al monto adjudicado.'],
      ['Artículo 14 (Gastos elegibles)', '9', 'presupuesto', 'Son elegibles los gastos en equipos, materiales e insumos, servicios de terceros, viajes de campo, publicación en acceso abierto y subvenciones a tesistas. No son elegibles los gastos de personal administrativo permanente ni la adquisición de vehículos.'],
      ['Artículo 19 (Informes técnicos)', '12', 'entregables', 'El Investigador Principal presenta informes técnicos semestrales de avance físico y financiero dentro de los 15 días calendario siguientes al cierre de cada semestre.'],
    ],
  },
  {
    id: 'reg-003', title: 'Código de Ética y Buenas Prácticas en Publicación Científica', version: 'v2.0-2023', status: 'active', effective: '2023-06-01',
    sections: [
      ['Artículo 6 (Consentimiento informado)', '4', 'etica', 'Toda investigación con seres humanos requiere consentimiento informado por escrito. Cuando participen comunidades campesinas o nativas se requiere además el Acta de Consentimiento Libre, Previo e Informado aprobada en asamblea comunal.'],
      ['Artículo 9 (Autoría)', '6', 'productos', 'Solo se reconoce como autor a quien haya contribuido sustancialmente a la concepción, ejecución o análisis del trabajo y haya aprobado la versión final. Se prohíbe la autoría honoraria o fantasma.'],
      ['Artículo 13 (Plagio y conducta indebida)', '9', 'etica', 'Constituyen conducta indebida la fabricación o falsificación de datos, el plagio y la publicación duplicada. Todo manuscrito se somete a revisión con software de similitud antes de su envío; el índice máximo aceptado es de 20% excluyendo bibliografía.'],
      ['Artículo 16 (Conflicto de interés)', '11', 'evaluacion', 'Los investigadores y evaluadores declaran sus conflictos de interés financieros, académicos o personales. El evaluador que omita declarar un conflicto es separado del registro de evaluadores por dos años.'],
      ['Artículo 20 (Datos abiertos)', '13', 'datos', 'Los datos que sustentan las publicaciones financiadas con fondos públicos se depositan en el repositorio institucional en un plazo máximo de 12 meses desde la publicación, salvo restricciones de confidencialidad o propiedad intelectual.'],
    ],
  },
  {
    id: 'reg-005', title: 'Reglamento de Propiedad Intelectual y Transferencia Tecnológica', version: 'v2.1-2025', status: 'active', effective: '2025-08-01',
    sections: [
      ['Artículo 7 (Titularidad)', '4', 'propiedad', 'La titularidad de las invenciones generadas con recursos de la universidad corresponde a la universidad. Los inventores tienen derecho a ser reconocidos como tales y a participar en los beneficios económicos de su explotación.'],
      ['Artículo 10 (Confidencialidad)', '6', 'propiedad', 'Los proyectos con potencial de patentamiento se registran como confidenciales. Su contenido solo es accesible para los miembros del proyecto, los evaluadores asignados y la Coordinación, y queda excluido de cualquier procesamiento por herramientas de inteligencia artificial.'],
      ['Artículo 15 (Distribución de regalías)', '9', 'propiedad', 'Los beneficios netos por licenciamiento se distribuyen en 40% para los inventores, 30% para la unidad académica de origen y 30% para el fondo institucional de investigación.'],
    ],
  },
  {
    id: 'reg-004', title: 'Reglamento de Propiedad Intelectual y Patentes Universitarias (Derogado)', version: 'v1.0-2019', status: 'retired', effective: '2019-01-01',
    sections: [
      ['Artículo 9 (Regalías)', '7', 'propiedad', 'Los beneficios por licenciamiento se distribuyen en partes iguales entre inventores y universidad.'],
    ],
  },
];

const SETTINGS = [
  ['notification.lead_days_warning', 7, 3, 15],
  ['notification.lead_days_critical', 1, 1, 3],
  ['ai.rag_relevance_threshold', 0.2, 0.05, 0.95],
  ['ai.max_answer_length_chars', 1000, 300, 2500],
];

const OBSERVATIONS = [
  ['obs-01', 'proj-2023-019', 'Metodología y Consentimiento Comunitario', 'Se instalarán 12 estaciones de telemetría en terrenos comunales de la microcuenca alta.', 'Se instalarán 12 estaciones de telemetría previa firma del Acta de Consentimiento Libre, Previo e Informado con la Comunidad Campesina San Juan de Lucanas, adjuntando el modelo de anexo ético institucional.', 'Se incorporó la consulta previa y el modelo de acta según recomendación de la Dra. Carmen Valdivia Prado.', 'doc-003', 1],
  ['obs-02', 'proj-2023-019', 'Presupuesto y Sostenibilidad de Equipos', 'Los equipos no requieren mantenimiento durante los primeros 24 meses.', 'Se incluye un fondo de contingencia del 5% del presupuesto para reposición de baterías y calibración anual in-situ.', 'Se reasignó la partida dentro del 40% del hito intermedio sin modificar el total adjudicado.', null, 1],
  ['obs-03', 'proj-2023-019', 'Gestión y Apertura de Datos', 'Los datos se almacenarán en el servidor del laboratorio.', 'Los datos crudos y procesados se depositarán en el repositorio institucional bajo licencia CC BY 4.0 a los 12 meses de su publicación.', 'Se alinea el plan de datos con el Art. 20 del Código de Ética.', null, 1],
  ['obs-04', 'proj-2023-019', 'Cronograma de Despliegue', 'El despliegue se realizará en cualquier época del año.', 'El despliegue de campo se programa entre mayo y setiembre para evitar la temporada de lluvias y riesgo de descargas eléctricas.', 'Ajuste de cronograma sugerido por el revisor par.', null, 1],
  ['obs-22-1', 'proj-2025-022', 'Plan de Gestión de Datos', 'Las imágenes satelitales se procesarán localmente.', '', '', null, 0],
  ['obs-22-2', 'proj-2025-022', 'Consentimiento de Comunidades Usuarias del Agua', 'Se realizarán aforos en canales de riego comunales.', '', '', null, 0],
];

const RUBRIC = [
  ['crit-01', 'Rigor Metodológico y Viabilidad Experimental', 35],
  ['crit-02', 'Impacto Social y Transferencia Tecnológica', 35],
  ['crit-03', 'Coherencia Presupuestal y Cronograma Físico', 30],
];

function docBody(projectTitle, code, docName, note) {
  return [
    `Proyecto: ${projectTitle}`,
    `Codigo: ${code}`,
    `Documento: ${docName}`,
    '',
    note,
    '',
    'Este documento forma parte del expediente digital del proyecto en la Plataforma Universitaria de Gestion de Proyectos de Investigacion (URPMP). Su integridad se verifica mediante el hash SHA-256 registrado en la plataforma al momento de su carga.',
  ];
}

export function seedDatabase() {
  const uploads = config.uploadsDir;
  fs.mkdirSync(uploads, { recursive: true });

  transaction(() => {
    for (const [id, email, name, dept, roles, title, dni, privacy] of USERS) {
      run(
        `INSERT INTO users (id, institutional_subject, email, full_name, department_id, roles, title, active, national_id, privacy_accepted_at, created_at)
         VALUES (?,?,?,?,?,?,?,1,?,?,?)`,
        [id, email, email, name, dept, toJson(roles), title, dni, privacy, '2026-01-02T08:00:00Z']
      );
    }

    for (const [type, items] of Object.entries(CATALOGS)) {
      for (const [id, name, parent] of items) {
        run('INSERT INTO catalog_items (id, catalog_type, name, active, parent_id) VALUES (?,?,?,1,?)', [id, type, name, parent ?? null]);
      }
    }

    const userName = id => USERS.find(u => u[0] === id)?.[2];
    const userRole = id => USERS.find(u => u[0] === id)?.[4][0];

    for (const p of PROJECTS) {
      run(
        `INSERT INTO projects (id, code, anonymous_code, title, pi_user_id, department_id, area_id, line_id, type_id, status, confidential,
          start_date, end_date, requested_funding, overall_progress, row_version, budget_breakdown, resolution_number, cvd_code, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`,
        [p.id, p.code, p.anonymous_code, p.title, p.pi, p.dept, p.area, p.line, p.type, p.status, p.confidential, p.start, p.end, p.funding,
          p.row_version, toJson(p.budget), p.resolution ?? null, p.cvd ?? null, p.created, p.history.at(-1)[3]]
      );
      const v = p.version;
      run(
        `INSERT INTO project_versions (id, project_id, version_no, summary, general_objective, specific_objectives, objectives, justification, methodology, funding_source, created_at, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [`v-${p.id}-${v.no}`, p.id, v.no, v.summary, v.general_objective,
          toJson(v.specific.map((d, i) => ({ id: `OE${i + 1}`, order: i + 1, description: d }))),
          v.general_objective, v.justification, v.methodology, v.funding_source, v.created, p.pi]
      );
      for (const [uid, role, joined] of p.members) {
        run('INSERT INTO project_members (id, project_id, user_id, project_role, joined_at, left_at) VALUES (?,?,?,?,?,NULL)', [`mem-${p.id}-${uid}`, p.id, uid, role, joined]);
      }
      p.history.forEach(([from, to, just, at, actor], i) => {
        run('INSERT INTO status_history (id, project_id, actor_id, from_status, to_status, justification, evaluation_id, created_at) VALUES (?,?,?,?,?,?,NULL,?)',
          [`hist-${p.id}-${i + 1}`, p.id, actor, from, to, just, at]);
      });
    }

    ACTIVITIES.forEach(([id, project, name, desc, resp, weight, progress, start, due, delivs], i) => {
      run(
        `INSERT INTO activities (id, project_id, name, description, responsible_user_id, weight, weighting_rule_version, progress, start_date, due_date, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [id, project, name, desc, resp, weight, 'v1.0-OI007', progress, start, due, i]
      );
      for (const [did, code, dname, ddesc, ddue, status, evidence] of delivs) {
        run('INSERT INTO deliverables (id, activity_id, code, name, description, due_date, status, evidence_document_ids) VALUES (?,?,?,?,?,?,?,?)',
          [did, id, code, dname, ddesc, ddue, status, toJson(evidence)]);
      }
    });

    // Avance ponderado real de cada proyecto a partir de sus actividades (FR-023)
    run(`UPDATE projects SET overall_progress = COALESCE((
           SELECT ROUND(SUM(a.progress * a.weight) / SUM(a.weight), 2) FROM activities a WHERE a.project_id = projects.id
         ), 0)`);

    for (const [id, projectId, name, type, versions] of DOCUMENTS) {
      const project = PROJECTS.find(p => p.id === projectId);
      run('INSERT INTO documents (id, project_id, name, type, obsolete_reason) VALUES (?,?,?,?,NULL)', [id, projectId, name, type]);
      versions.forEach(([note, author, createdAt], i) => {
        const versionNo = i + 1;
        const content = buildPdf(name.replace(/_/g, ' ').replace(/\.pdf$/i, '') + ` (v${versionNo})`, docBody(project.title, project.code, name, note));
        const rel = path.join(projectId, `${id}-v${versionNo}.pdf`);
        fs.mkdirSync(path.join(uploads, projectId), { recursive: true });
        fs.writeFileSync(path.join(uploads, rel), content);
        run(
          `INSERT INTO document_versions (id, document_id, version_no, sha256, mime, size_bytes, author_id, change_note, storage_path, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [`ver-${id}-${versionNo}`, id, versionNo, sha256(content), 'application/pdf', content.length, author, note, rel, createdAt]
        );
      });
    }

    for (const [id, project, type, title, authors, date, venue, link, status, evidenceName, validatedAt] of PRODUCTS) {
      run(
        `INSERT INTO products (id, project_id, type, title, authors, product_date, venue, doi_or_url, status, evidence_document_id, evidence_filename, validated_at, validator_id, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?,?,?,?)`,
        [id, project, type, title, authors, date, venue, link, status, evidenceName, validatedAt, validatedAt ? 'u-coord-003' : null,
          PROJECTS.find(p => p.id === project).pi, `${date}T12:00:00Z`]
      );
    }

    for (const [user, kind, title, message, project, created, read, dedupe] of NOTIFICATIONS) {
      run('INSERT INTO notifications (id, user_id, kind, title, message, project_id, created_at, read_at, dedupe_key) VALUES (?,?,?,?,?,?,?,?,?)',
        [`notif-${dedupe}`, user, kind, title, message, project, created, read, dedupe]);
    }

    for (const r of REGULATIONS) {
      run('INSERT INTO regulations (id, version_id, title, version, status, effective_date, indexed_at) VALUES (?,?,?,?,?,?,?)',
        [r.id, `v-${r.id}`, r.title, r.version, r.status, r.effective, `${r.effective}T04:00:00Z`]);
      r.sections.forEach(([section, page, topic, text], i) => {
        run('INSERT INTO regulation_sections (id, regulation_id, section, page, topic, text) VALUES (?,?,?,?,?,?)', [`${r.id}-s${i + 1}`, r.id, section, page, topic, text]);
      });
    }

    for (const [key, value, min, max] of SETTINGS) {
      run('INSERT INTO settings (key, value, min_allowed, max_allowed, approved_by, updated_at, version) VALUES (?,?,?,?,?,?,1)',
        [key, toJson(value), min, max, 'u-admin-007', '2026-01-02T10:00:00Z']);
    }

    OBSERVATIONS.forEach(([id, project, section, original, corrected, just, evidence, resolved], i) => {
      run(
        `INSERT INTO observations (id, project_id, section_name, original_text_v1, corrected_text_v2, researcher_justification, evidence_document_id, resolved, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, project, section, original, corrected, just, evidence, resolved, i]
      );
    });

    // Asignaciones de revisión y evaluaciones
    const assignments = [
      ['rev-001', 'proj-2023-019', 'u-committee-004', 'Revisor Par #REV-7734', '2024-02-10T23:59:59Z', '2024-01-20T14:30:00Z',
        ['approve', 'Propuesta metodológicamente sólida, con alto impacto potencial en la gestión hídrica comunal y cumplimiento de la política de ciencia abierta.',
          [[33, 'Diseño experimental detallado y replicable.'], [32, 'Beneficio directo para 4 comunidades andinas.'], [26, 'Presupuesto ajustado y distribuido en 3 fases equilibradas.']], '2024-02-08T17:30:00Z']],
      ['rev-002', 'proj-2025-015', 'u-committee-004', 'Revisor Par #REV-8120', '2026-11-30T23:59:59Z', '2026-10-09T10:00:00Z', null],
      ['rev-003', 'proj-2024-009-conf', 'u-committee-011', 'Revisor Par #REV-9051', '2026-11-28T23:59:59Z', '2026-07-10T11:00:00Z', null],
      ['rev-004', 'proj-2024-042', 'u-committee-004', 'Revisor Par #REV-8233', '2026-12-12T23:59:59Z', '2026-10-05T10:00:00Z', null],
      ['rev-005', 'proj-2025-022', 'u-committee-012', 'Revisor Par #REV-8402', '2026-10-15T23:59:59Z', '2026-09-05T09:00:00Z',
        ['request_changes', 'Propuesta pertinente; se requiere precisar el plan de gestión de datos y el consentimiento de las comunidades usuarias del agua antes de su aprobación.',
          [[27, 'Metodología adecuada, falta plan de datos.'], [28, 'Alto impacto en gestión hídrica urbana.'], [22, 'Cronograma ajustado en la fase de campo.']], '2026-10-14T18:00:00Z']],
    ];
    for (const [id, project, reviewer, alias, due, created, evaluation] of assignments) {
      run('INSERT INTO review_assignments (id, project_id, reviewer_id, reviewer_alias, due_at, has_conflict_of_interest, conflict_reason, created_at) VALUES (?,?,?,?,?,0,NULL,?)',
        [id, project, reviewer, alias, due, created]);
      if (evaluation) {
        const [rec, comments, scores, at] = evaluation;
        const rubric = RUBRIC.map(([cid, cname, max], i) => ({ criterion_id: cid, criterion_name: cname, max_score: max, score: scores[i][0], qualitative_justification: scores[i][1] }));
        run('INSERT INTO evaluations (id, assignment_id, recommendation, comments, total_score, rubric_scores, submitted_at) VALUES (?,?,?,?,?,?,?)',
          [`eval-${id}`, id, rec, comments, rubric.reduce((s, r) => s + r.score, 0), toJson(rubric), at]);
      }
    }

    // Sesión colegiada del CIE para el proyecto eje (V08)
    run('INSERT INTO committee_sessions (id, project_id, session_number, required_quorum, resolution_number, resolution_issued_at, resolution_hash, created_at) VALUES (?,?,?,3,NULL,NULL,NULL,?)',
      ['cs-014-2025', 'proj-2023-019', 'Sesión Extraordinaria CIE Nº 014-2025', '2026-10-15T14:00:00Z']);
    const votes = [
      ['u-committee-004', 'Dra. Carmen Valdivia Prado', 'Presidenta del Comité Institucional de Ética (CIE)', 'favor', '2026-10-15T14:30:00Z'],
      ['u-committee-011', 'Dr. Fernando Cárdenas Rojas', 'Vocal de Metodología y Bioética', 'favor', '2026-10-15T15:10:00Z'],
      ['u-committee-012', 'Mg. Teresa Palomino Hurtado', 'Secretaria Técnica del CIE', null, null],
    ];
    votes.forEach(([uid, name, role, vote, at], i) => {
      const sig = vote ? sha256(`cs-014-2025|${uid}|${vote}|${at}`) : null;
      run('INSERT INTO committee_votes (id, session_id, member_name, member_role, user_id, vote, signature_hash, voted_at, sort_order) VALUES (?,?,?,?,?,?,?,?,?)',
        [`vote-${i + 1}`, 'cs-014-2025', name, role, uid, vote, sig, at, i]);
    });

    // Bitácora: eventos históricos encadenados con hash real (orden cronológico)
    const actor = id => ({ userId: id, fullName: userName(id), role: userRole(id) });
    const events = [];
    for (const p of PROJECTS) {
      p.history.forEach(([from, to, just, at, by]) => {
        events.push([at, actor(by), from ? 'PROJECT_STATUS_CHANGED' : 'PROJECT_CREATED', 'project', p.id, { code: p.code, from_status: from, to_status: to, justification: just }]);
      });
    }
    events.push(['2024-01-20T14:31:00Z', actor('u-coord-003'), 'REVIEWERS_ASSIGNED', 'project', 'proj-2023-019', { reviewer_alias: 'Revisor Par #REV-7734', due_at: '2024-02-10' }]);
    events.push(['2024-02-28T16:00:00Z', actor('u-authority-006'), 'RECTORAL_RESOLUTION_PROMULGATED', 'project', 'proj-2023-019', { resolution: 'R.R. Nº 1042-2024-R-URPMP', cvd: 'URP-9482-TX-2024' }]);
    events.push(['2025-08-20T09:15:00Z', actor('u-coord-003'), 'PRODUCT_VALIDATED', 'research_product', 'prod-001', { title: 'Autonomous Low-Cost LoRaWAN Sensor Nodes...' }]);
    events.push(['2025-10-12T11:45:00Z', actor('u-coord-003'), 'PRODUCT_VALIDATED', 'research_product', 'prod-002', { title: 'Evaluación de Rendimiento de Baterías LiFePO4...' }]);
    events.push(['2026-01-02T10:00:00Z', actor('u-admin-007'), 'SETTINGS_INITIALIZED', 'system_setting', 'all', { count: SETTINGS.length }]);
    events.sort((a, b) => a[0].localeCompare(b[0]));
    for (const [at, who, action, type, id, meta] of events) audit(who, action, type, id, meta, at);
  });
}

/** Siembra la base si está vacía. Devuelve true si se sembró. */
export function seedIfEmpty() {
  const row = get('SELECT COUNT(*) AS n FROM users');
  if (row && row.n > 0) return false;
  seedDatabase();
  saveNow();
  return true;
}

// Ejecución directa: `node src/seed.js --reset`
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const reset = process.argv.includes('--reset');
  if (reset) {
    fs.rmSync(config.uploadsDir, { recursive: true, force: true });
  }
  await openDatabase({ reset });
  const seeded = seedIfEmpty();
  closeDatabase();
  console.log(seeded ? `✔ Base de datos creada y poblada en ${config.dbFile}` : 'La base de datos ya contiene datos (use --reset para recrearla).');
}
