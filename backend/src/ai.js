/**
 * Asistencia IA de URPMP (AIR-001..014) implementada de forma local y verificable:
 *  - Asistente normativo RAG: recuperación léxica BM25 sobre los fragmentos del corpus
 *    normativo VIGENTE guardado en la base de datos. La respuesta se compone solo con
 *    texto literal de las normas recuperadas y siempre cita fuente, versión, artículo y página.
 *  - Pre-chequeo de completitud: reglas verificables de las bases y reglamentos.
 *  - Resumen ejecutivo extractivo (<= 250 palabras) para evaluadores.
 * Ningún dato sale del servidor y los proyectos confidenciales quedan excluidos (AIR-011).
 */
import { all, get, fromJson } from './db.js';

const STOPWORDS = new Set(
  'a al algo algun alguna algunas alguno algunos ante antes como con contra cual cuales cuando de del desde donde dos e el ella ellas ellos en entre era es esa esas ese eso esos esta estan estas este esto estos fue ha hace hacer hay la las le les lo los mas me mi mis mucho muy ni no nos o otra otro para pero por porque puede pueden puedo que quien se sea segun ser si sin sobre son su sus tambien tiene tienen todo todos tu un una uno unos y ya cual debo debe deben mi necesito quiero saber cuanto cuantos cuantas cual hay tengo'.split(
    ' '
  )
);

const normalize = s =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Stemming ligero para español (suficiente para emparejar plural/singular y derivaciones). */
function stem(w) {
  for (const suf of ['aciones', 'iciones', 'amiento', 'imiento', 'ciones', 'cion', 'mente', 'idades', 'idad', 'ables', 'ibles', 'able', 'ible', 'istas', 'ista', 'ales', 'es', 'os', 'as', 's', 'a', 'o', 'e']) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, -suf.length);
  }
  return w;
}

export function tokenize(text) {
  return normalize(text)
    .split(/[^a-z0-9ñ%]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** Vocabulario del dominio aprobado (AIR-013): si la pregunta no toca ninguno, se declina. */
const DOMAIN_TERMS = new Set(
  tokenize(
    'investigacion proyecto propuesta presupuesto partida fondo fondos concursables canon financiamiento desembolso fase fases evaluacion evaluador revisor comite etica dictamen rubrica puntaje plazo ampliacion entregable entregables evidencia informe informes producto productos articulo publicacion patente tesis software autoria plagio consentimiento comunidad datos repositorio cierre investigador principal estudiante equipo miembro propiedad intelectual regalias confidencial confidencialidad objetivo objetivos metodologia cronograma convocatoria gasto gastos elegibles monto maximo reglamento directiva norma modificacion redistribucion conflicto interes inhibicion validacion coordinacion'
  )
);

export function retrieve(question, { limit = 3 } = {}) {
  const q = tokenize(question);
  const sections = all(
    `SELECT s.*, r.title AS document_title, r.version AS reg_version FROM regulation_sections s
     JOIN regulations r ON r.id = s.regulation_id WHERE r.status = 'active'`
  );
  if (!q.length || !sections.length) return { query: q, results: [] };

  const docs = sections.map(s => ({ s, toks: tokenize(`${s.section} ${s.topic ?? ''} ${s.text}`) }));
  const N = docs.length;
  const avgdl = docs.reduce((a, d) => a + d.toks.length, 0) / N;
  const df = new Map();
  for (const d of docs) for (const t of new Set(d.toks)) df.set(t, (df.get(t) || 0) + 1);
  const k1 = 1.4;
  const b = 0.75;
  const qset = [...new Set(q)];

  const scored = docs
    .map(d => {
      const tf = new Map();
      for (const t of d.toks) tf.set(t, (tf.get(t) || 0) + 1);
      let score = 0;
      let matched = 0;
      for (const t of qset) {
        const f = tf.get(t);
        if (!f) continue;
        matched++;
        const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.toks.length) / avgdl)));
      }
      // Relevancia normalizada 0..1: proporción de términos de la pregunta cubiertos, ponderada por BM25
      const coverage = matched / qset.length;
      return { section: d.s, score, relevance: Number((coverage * Math.min(1, score / 4)).toFixed(3)) };
    })
    .filter(r => r.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, limit);

  return { query: q, results: scored };
}

export function isInScope(question) {
  return tokenize(question).some(t => DOMAIN_TERMS.has(t));
}

const DISCLAIMER =
  'Aviso Importante: Esta respuesta es generada automáticamente con fines orientativos (no vinculantes) a partir del corpus normativo vigente. Las decisiones institucionales oficiales corresponden exclusivamente a la Coordinación de Investigación y al Comité de Ética.';

export function answerQuestion(question, { threshold = 0.2, maxChars = 1000 } = {}) {
  if (!isInScope(question)) {
    return {
      answer:
        'La consulta está fuera del alcance del asistente normativo, que solo responde preguntas sobre la normativa de investigación vigente de la universidad (proyectos, fondos, evaluación, ética, productos y propiedad intelectual).',
      is_not_found_fallback: false,
      is_out_of_scope_declined: true,
      source_refs: [],
      advisory_disclaimer: DISCLAIMER,
    };
  }
  const { results } = retrieve(question, { limit: 3 });
  const relevant = results.filter(r => r.relevance >= threshold);
  if (!relevant.length) {
    return {
      answer:
        'No se encontró un pasaje normativo suficientemente relevante en el corpus vigente para responder con seguridad. Se recomienda reformular la pregunta o consultar directamente a la Coordinación de Investigación.',
      is_not_found_fallback: true,
      is_out_of_scope_declined: false,
      source_refs: [],
      advisory_disclaimer: DISCLAIMER,
    };
  }
  const [top, ...rest] = relevant;
  let answer = `De acuerdo con el ${top.section.document_title} (${top.section.section}): ${top.section.text}`;
  for (const r of rest) {
    if (r.relevance < top.relevance * 0.6) continue;
    const extra = ` Adicionalmente, el ${r.section.document_title} (${r.section.section}) establece: ${r.section.text}`;
    if ((answer + extra).length <= maxChars) answer += extra;
  }
  if (answer.length > maxChars) answer = answer.slice(0, maxChars - 1).replace(/\s+\S*$/, '') + '…';

  return {
    answer,
    is_not_found_fallback: false,
    is_out_of_scope_declined: false,
    source_refs: relevant.map(r => ({
      regulation_id: r.section.regulation_id,
      document_title: r.section.document_title,
      version: r.section.reg_version,
      section: r.section.section,
      page: r.section.page,
      excerpt: r.section.text.length > 220 ? r.section.text.slice(0, 217) + '…' : r.section.text,
    })),
    advisory_disclaimer: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// Pre-chequeo de completitud (AIR-008, AIR-009)
// ---------------------------------------------------------------------------
const words = s => (String(s || '').trim() ? String(s).trim().split(/\s+/).length : 0);

function monthsBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + (d2.getDate() >= d1.getDate() ? 0 : -1);
}

/**
 * @param {object} draft { title, summary, general_objective, specific_objectives[], justification,
 *                         methodology, start_date, end_date, requested_funding, budget_breakdown[] }
 */
export function precheck(draft) {
  const obs = [];
  const add = (section_affected, issue_detected, suggestion, guideline_reference) =>
    obs.push({ section_affected, issue_detected, suggestion, guideline_reference });

  const title = String(draft.title || '').trim();
  if (words(title) < 8) add('Título', 'Título poco descriptivo', 'Se recomienda un título de al menos 8 palabras que indique objeto, población y ámbito del estudio.', 'Reglamento General Art. 15');

  const sw = words(draft.summary);
  if (sw === 0) add('Resumen', 'Resumen ausente', 'Incluya un resumen de 150 a 500 palabras con problema, objetivo, metodología y resultados esperados.', 'Reglamento General Art. 15');
  else if (sw > 500) add('Resumen', `Resumen excede el límite (${sw} palabras)`, 'Reduzca el resumen a un máximo de 500 palabras.', 'Reglamento General Art. 15');
  else if (sw < 60) add('Resumen', `Resumen breve (${sw} palabras)`, 'Amplíe el resumen para describir metodología y resultados esperados (recomendado: 150 o más palabras).', 'Reglamento General Art. 15');

  const objectives = (draft.specific_objectives || []).map(o => (typeof o === 'string' ? o : o.description)).filter(o => String(o || '').trim());
  if (objectives.length < 3) {
    add('Objetivos Específicos', `Solo ${objectives.length} objetivo(s) específico(s)`, 'Se exige un mínimo de tres objetivos específicos.', 'Directiva de Fondos Concursables Art. 8');
  }
  const notInfinitive = objectives.filter(o => !/^\s*\p{L}+(ar|er|ir)\b/iu.test(o));
  if (notInfinitive.length) {
    add('Objetivos Específicos', 'Verbos no están en infinitivo', `Redacte en infinitivo (p. ej. "Diseñar", "Medir", "Evaluar"): ${notInfinitive.map(o => `"${o.slice(0, 40)}…"`).join(', ')}.`, 'Directiva de Fondos Concursables Art. 8');
  }
  const notMeasurable = objectives.filter(o => !/\d/.test(o));
  if (objectives.length && notMeasurable.length) {
    add('Objetivos Específicos', `${notMeasurable.length} objetivo(s) sin indicador cuantitativo`, 'Incluya metas cuantificables (cantidades, porcentajes o plazos) para que el logro sea verificable.', 'Directiva de Fondos Concursables Art. 8');
  }

  if (words(draft.methodology) < 25) add('Metodología', 'Metodología insuficientemente descrita', 'Detalle diseño, población/muestra, instrumentos y plan de análisis (mínimo recomendado: 25 palabras).', 'Reglamento General Art. 15');
  if (draft.justification !== undefined && words(draft.justification) < 15) add('Justificación', 'Justificación breve', 'Sustente la relevancia del problema con datos o antecedentes.', 'Reglamento General Art. 15');

  const funding = Number(draft.requested_funding) || 0;
  if (funding <= 0) add('Presupuesto', 'Monto solicitado no válido', 'Indique el monto total solicitado en soles.', 'Directiva de Fondos Concursables Art. 5');
  else if (funding > 160000) add('Presupuesto', `Monto supera el tope (S/ ${funding.toLocaleString('es-PE')})`, 'El monto máximo financiable es S/ 160,000.00 para investigación aplicada.', 'Directiva de Fondos Concursables Art. 5');

  const phases = draft.budget_breakdown || [];
  if (phases.length) {
    const pct = phases.reduce((a, p) => a + Number(p.percentage || 0), 0);
    const amt = phases.reduce((a, p) => a + Number(p.amount_pen || 0), 0);
    const is404020 = phases.length === 3 && [40, 40, 20].every((v, i) => Number(phases[i].percentage) === v);
    if (pct !== 100 || Math.abs(amt - funding) > 0.01) {
      add('Presupuesto', 'Fases no cuadran con el total', `Las fases suman ${pct}% y S/ ${amt.toFixed(2)}; deben sumar 100% y exactamente el monto solicitado.`, 'Directiva de Fondos Concursables Art. 11');
    } else if (!is404020) {
      add('Presupuesto', 'Distribución de desembolsos no estándar', 'La directiva establece desembolsos 40% - 40% - 20%.', 'Directiva de Fondos Concursables Art. 11');
    }
  }

  if (draft.start_date && draft.end_date) {
    if (draft.end_date < draft.start_date) add('Cronograma', 'Fecha de término anterior a la de inicio', 'Corrija las fechas del proyecto.', 'Reglamento General Art. 15');
    else if (monthsBetween(draft.start_date, draft.end_date) > 36) add('Cronograma', 'Duración mayor a 36 meses', 'La duración máxima financiable es de 36 meses.', 'Directiva de Fondos Concursables Art. 5');
  }

  const text = `${draft.summary || ''} ${draft.methodology || ''}`.toLowerCase();
  if (/(comunidad|comunal|niñ|pacient|participant|encuest|entrevist|human)/.test(text) && !/consentimiento/.test(text)) {
    add('Ética', 'Participación de personas o comunidades sin consentimiento explícito', 'Mencione el consentimiento informado y, si hay comunidades campesinas o nativas, el Acta de Consentimiento Libre, Previo e Informado.', 'Código de Ética Art. 6');
  }

  return {
    generated_at: new Date().toISOString(),
    advisory_notice:
      obs.length === 0
        ? 'No se detectaron observaciones preventivas. Este pre-chequeo es orientativo y no bloquea ni garantiza la aprobación.'
        : `Se detectaron ${obs.length} observación(es) preventiva(s). Son sugerencias orientativas y no bloquean el envío de la propuesta.`,
    observations: obs,
  };
}

// ---------------------------------------------------------------------------
// Resumen ejecutivo para evaluadores (AIR-010)
// ---------------------------------------------------------------------------
export function summarizeProject(project, version) {
  const objs = (version?.specific_objectives || []).map(o => o.description.replace(/\.$/, '').toLowerCase());
  const phases = fromJson(project.budget_breakdown, []) || [];
  const parts = [
    version?.general_objective ? `Objetivo: ${version.general_objective}` : null,
    objs.length ? `Se propone ${objs.join('; ')}.` : null,
    version?.methodology ? `Metodología: ${version.methodology}` : null,
    `Cronograma: del ${project.start_date} al ${project.end_date} (${Math.max(1, monthsBetween(project.start_date, project.end_date))} meses).`,
    `Presupuesto solicitado: S/ ${Number(project.requested_funding).toLocaleString('es-PE', { minimumFractionDigits: 2 })}${phases.length ? ` distribuido en ${phases.length} fases (${phases.map(p => `${p.percentage}%`).join(' - ')})` : ''}.`,
  ].filter(Boolean);
  let text = parts.join(' ');
  const w = text.split(/\s+/);
  if (w.length > 250) text = w.slice(0, 250).join(' ') + '…';
  return { summary_text: text, word_count: Math.min(250, w.length) };
}

export function getSettingValue(key, fallback) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? fromJson(row.value, fallback) : fallback;
}
