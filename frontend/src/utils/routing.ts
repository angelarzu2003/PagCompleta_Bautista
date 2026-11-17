/**
 * Utilidades de enrutamiento por hash (#/...).
 * Recuerda el último expediente abierto para que los accesos directos del menú lleven a él.
 */
const KEY = 'urpmp.lastProjectId';

export function getProjectIdFromHash(hash: string = window.location.hash): string | null {
  const m = hash.match(/^#\/proyectos\/([^/?#]+)/);
  if (!m || m[1] === 'nuevo' || m[1] === 'actual') return null;
  return decodeURIComponent(m[1]);
}

export function getHashQueryParam(name: string, hash: string = window.location.hash): string | null {
  const q = hash.split('?')[1];
  if (!q) return null;
  return new URLSearchParams(q).get(name);
}

export function rememberProject(id: string): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function lastProjectId(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
