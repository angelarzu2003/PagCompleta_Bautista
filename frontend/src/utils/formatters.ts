/**
 * Utilidades de formateo para el frontend de URPMP.
 * Cumplen con NFR-015 (Idioma español) y formatos numéricos tabulares.
 */

/** Formatea montos a Soles peruanos (PEN) con alineación y separadores de miles */
export function formatCurrencyPEN(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Formatea montos a Dólares estadounidenses (USD) */
export function formatCurrencyUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Formatea fecha ISO (ej. 2026-10-06) a formato institucional latinoamericano (06/10/2026) */
export function formatDate(isoDate: string | undefined | null): string {
  if (!isoDate) return '—';
  try {
    const [year, month, day] = isoDate.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return isoDate;
  }
}

/** Formatea fecha y hora ISO UTC a zona horaria local legible */
export function formatDateTime(isoDateTime: string | undefined | null): string {
  if (!isoDateTime) return '—';
  try {
    const date = new Date(isoDateTime);
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return isoDateTime;
  }
}

/** Enmascara DNI para vistas públicas (NFR-009, Fase 0) ej: 41890342 -> ***.***.342 */
export function maskNationalId(dni: string | undefined | null): string {
  if (!dni) return '***.***.***';
  const clean = dni.replace(/\D/g, '');
  if (clean.length < 3) return '***.***.***';
  const last3 = clean.slice(-3);
  return `***.***.${last3}`;
}

/** Formatea tamaño de bytes a MB o KB legibles */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Contador de palabras para el resumen de propuesta (máximo 500 palabras) */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
