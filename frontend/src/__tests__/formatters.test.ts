import { describe, it, expect } from 'vitest';
import {
  formatCurrencyPEN,
  formatCurrencyUSD,
  formatDate,
  maskNationalId,
  formatFileSize,
  countWords
} from '../utils/formatters';

describe('Utilidades de Formateo y Privacidad (NFR-009, NFR-015)', () => {
  it('Formatea montos en Soles (PEN) con separador de miles y decimales', () => {
    const formatted = formatCurrencyPEN(157500.0);
    expect(formatted).toContain('157');
    expect(formatted).toContain('500');
  });

  it('Formatea montos en Dólares (USD)', () => {
    const formatted = formatCurrencyUSD(42000.0);
    expect(formatted).toContain('42,000');
  });

  it('NFR-009 / Fase 0: Enmascara el DNI en vistas públicas mostrando únicamente los 3 últimos dígitos (***.***.342)', () => {
    const masked = maskNationalId('41890342');
    expect(masked).toBe('***.***.342');

    const empty = maskNationalId(null);
    expect(empty).toBe('***.***.***');
  });

  it('Formatea fechas ISO a formato institucional DD/MM/AAAA', () => {
    expect(formatDate('2026-10-06')).toBe('06/10/2026');
    expect(formatDate(null)).toBe('—');
  });

  it('Calcula tamaño de archivo en KB o MB legibles', () => {
    expect(formatFileSize(4200150)).toContain('MB');
    expect(formatFileSize(1024)).toContain('KB');
  });

  it('Cuenta palabras con precisión para el límite de 500 palabras del resumen', () => {
    const text = 'Este es un resumen de investigación científica.';
    expect(countWords(text)).toBe(7);
    expect(countWords('')).toBe(0);
  });
});
