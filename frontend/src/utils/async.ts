import { Activity, BudgetPhaseBreakdown } from '../types/domain';

/**
 * Utilidades para manejo de Asincronía, Concurrencia y Sincronía en el Frontend.
 */

/**
 * Simula latencia de red asíncrona realista (< 3 segundos según NFR-001).
 */
export async function simulateNetworkDelay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cálculo sincrónico en tiempo real del promedio ponderado general del proyecto (FR-023).
 * Fórmula: sum(progress * weight) / sum(weight)
 */
export function calculateWeightedProgress(activities: Activity[]): number {
  if (!activities || activities.length === 0) return 0;
  const totalWeight = activities.reduce((sum, a) => sum + (Number(a.weight) || 0), 0);
  if (totalWeight <= 0) return 0;
  const weightedSum = activities.reduce((sum, a) => sum + (Number(a.progress || 0) * (Number(a.weight) || 0)), 0);
  return Number((weightedSum / totalWeight).toFixed(2));
}

/**
 * Validación sincrónica de balance presupuestal (Fases 40% + 40% + 20% = 100%).
 */
export function validateBudgetBreakdown(totalAmount: number, phases: BudgetPhaseBreakdown[]): {
  isValid: boolean;
  totalPercentage: number;
  calculatedAmount: number;
  discrepancy: number;
} {
  const totalPercentage = phases.reduce((acc, p) => acc + p.percentage, 0);
  const calculatedAmount = phases.reduce((acc, p) => acc + p.amount_pen, 0);
  const discrepancy = Math.abs(totalAmount - calculatedAmount);

  return {
    isValid: totalPercentage === 100 && discrepancy < 0.01,
    totalPercentage,
    calculatedAmount,
    discrepancy,
  };
}

/**
 * Función debounce para búsquedas sincrónicas fluidas sin saturar renderizados.
 */
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: any;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
