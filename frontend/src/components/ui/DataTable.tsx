import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  mobileLabel?: string; // Etiqueta visible en el modo tarjeta móvil
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

/**
 * Tabla accesible con transformación responsiva automática (< 768px):
 * En Desktop (>= 768px) renderiza una <table> semántica limpia con tabular-nums.
 * En Mobile (< 768px) renderiza tarjetas apiladas (Stacked Responsive Cards)
 * eliminando por completo el scroll horizontal (A5 / BASE.md 3.2).
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No se encontraron registros.',
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="w-full py-12 px-4 text-center bg-white rounded-card border border-slate-200">
        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* 1. MODO DESKTOP: Tabla semántica (>= 768px) */}
      <div className="hidden md:block w-full overflow-hidden rounded-card border border-slate-200 bg-white shadow-soft">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken/80 border-b border-slate-200 text-xs font-semibold text-slate-700 tracking-tight">
              {columns.map(col => (
                <th key={col.key} className={`py-3.5 px-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map(item => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50/40'
                }`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`py-3 px-4 text-primary ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. MODO MOBILE: Tarjetas Apiladas (< 768px) sin scroll horizontal */}
      <div className="md:hidden flex flex-col gap-3">
        {data.map(item => (
          <div
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={`bg-white rounded-card border border-slate-200 p-4 shadow-soft flex flex-col gap-2.5 transition-all ${
              onRowClick ? 'active:bg-slate-50 cursor-pointer' : ''
            }`}
          >
            {columns.map(col => (
              <div key={col.key} className="flex items-start justify-between gap-2 text-xs py-1 border-b border-slate-100 last:border-b-0">
                <span className="font-semibold text-slate-500 shrink-0">
                  {col.mobileLabel || col.header}:
                </span>
                <div className="text-right text-primary font-medium">
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
