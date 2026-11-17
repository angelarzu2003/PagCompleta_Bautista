import { useState } from 'react';

/**
 * Hook para control de concurrencia optimista (row_version).
 * Previene sobrescrituras accidentales si el registro fue actualizado por otro usuario (409 Conflict).
 */
export function useOptimisticVersion(initialVersion: number = 1) {
  const [version, setVersion] = useState<number>(initialVersion);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const updateVersion = (newVersion: number) => {
    setVersion(newVersion);
    setConflictError(null);
  };

  const handleConflict = (message?: string) => {
    setConflictError(
      message || 'Conflicto de versión concurrente: Este registro fue modificado en el servidor. Debe recargar para ver los cambios.'
    );
  };

  const resetConflict = () => {
    setConflictError(null);
  };

  return {
    version,
    updateVersion,
    conflictError,
    handleConflict,
    resetConflict,
  };
}
