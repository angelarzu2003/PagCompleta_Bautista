# Auditoría de seguridad — URPMP Frontend

Fecha: 2026-11-05 · Rama: `security/auditoria-qa`

Alcance: código del frontend (React + Vite + TypeScript), su capa API simulada (`src/api/client.ts`) y sus dependencias.
El backend real no estaba disponible, así que los controles de servidor se reprodujeron en el mock. **El backend
tiene que implementar los mismos controles**, porque todo lo que corre en el navegador lo puede modificar el usuario.

## Hallazgos y parches

| # | Severidad | Vulnerabilidad | Dónde | Parche |
|---|-----------|----------------|-------|--------|
| 1 | Crítica | **Bypass de autenticación**: la app arrancaba ya logueada como el Investigador Principal (`useState(MOCK_USERS[0])`) y cualquiera entraba sin pasar por el login. | `src/context/AuthContext.tsx` | La sesión empieza en `null`. Solo `login()` la crea y `logout()` limpia el rol. |
| 2 | Alta | **Escalada de privilegios**: `switchRole()` cambiaba a cualquier rol (incluido administrador) en cualquier entorno. El botón solo se ocultaba en producción. Además, la variable `VITE_ENABLE_DEV_ROLE_SWITCHER` no se usaba. | `AuthContext.tsx`, `Header.tsx` | `switchRole()` no hace nada salvo que se cumplan `import.meta.env.DEV` y `VITE_ENABLE_DEV_ROLE_SWITCHER=true`. |
| 3 | Alta | **XSS almacenado** vía enlace `javascript:` en el DOI/URL de productos científicos: `<a href={prod.doi_or_url}>` ejecutaba el código al hacer clic. | `ScientificProductsView.tsx`, `ProjectDetailView.tsx`, `client.ts` | Nuevo `safeExternalUrl()`: solo deja enlazar `http`/`https` o un DOI y lo demás se muestra como texto. La API rechaza esquemas peligrosos (422). Se usa `rel="noopener noreferrer"`. |
| 4 | Alta | **CSRF inefectivo**: el token estaba escrito en el código y la validación solo revisaba el prefijo `csrf-tok-`, así que un token inventado pasaba. | `security.ts`, `client.ts`, `AuthContext.tsx` | El token sale de `crypto.getRandomValues` (128 bits), se compara exacto y en tiempo constante con el emitido, y rota en cada login o cambio de rol. |
| 5 | Alta | **Control de acceso roto / IDOR (BOLA)**: `getProjectById`, `getDocuments`, `updateProject`, etc. devolvían o modificaban cualquier expediente. `getProjects` confiaba en el rol que mandaba la vista. | `client.ts` | Nueva sesión en la API (`setSession`/`requireSession`). `assertCanAccessProject()` responde 404 si el proyecto no es del investigador, y el comité no puede ver los suyos (BR-011). Sin sesión se responde 401. |
| 6 | Alta | **Autorización faltante en acciones privilegiadas**: cualquiera podía validar productos (la regla BR-013 solo estaba en un comentario), leer la bitácora de auditoría o cambiar parámetros. Además, el validador lo indicaba el cliente. | `client.ts` | `requirePermission()` con la matriz `hasPermission`: `validate_product`, `view_audit_log`, `edit_parameters`, `create_project`, `submit_project`. El validador y el autor salen de la sesión. |
| 7 | Media | **Mass assignment**: `updateProject` aceptaba cambiar `pi_user_id`, `row_version`, `id` o `code`. `createProject` aceptaba el `pi_user_id` del formulario. Un producto podía crearse ya "validado". | `client.ts` | Se descartan esos campos. El PI es el usuario de la sesión. `validated_at` y `validator_id` siempre empiezan en `null`. |
| 8 | Media | **Carga de archivos sin validar**: se aceptaba cualquier extensión (`.html`, `.svg`, `.exe`, `.php`), nombres con `../` y tamaño 0 o negativo. | `client.ts`, `ProjectDocumentsView.tsx` | `validateUploadFileName()`: lista blanca de extensiones, sin rutas ni caracteres de control, máximo 150 caracteres. Responde 415 o 422 según el caso. |
| 9 | Media | **Dependencias vulnerables**: `vite@5.4.21` y `esbuild@0.21.5` (10 avisos: 1 alto, 8 moderados y 1 bajo, entre ellos path traversal y lectura del dev server desde otros sitios) y `postcss-selector-parser@6.1.4` (DoS). | `package.json`, `bun.lock` | `vite@^6.4.4` y actualización de `postcss-selector-parser`. `bun audit` ya no reporta vulnerabilidades. |
| 10 | Baja | **`.env` versionado** en git. Hoy no contiene secretos, pero si alguien agrega una clave, se publica. | `.gitignore` | Se agregó `.env` a `.gitignore` y se sacó del índice. La plantilla queda en `.env.example`. |
| 11 | Baja | **Timeout de inactividad débil**: ignoraba `VITE_IDLE_TIMEOUT_MINUTES`, solo contaba ratón y teclado (en móvil cerraba sesión aunque se estuviera usando) y corría sin sesión. | `AuthContext.tsx` | Lee la variable, cuenta también `touchstart`, `scroll` y `mousedown`, y solo corre con sesión iniciada. |
| 12 | Baja | Varias acciones (`acceptPrivacy`, `getNotifications`, `markNotificationRead`, asistente IA) usaban el `userId` que mandaba el cliente. | `client.ts` | Ahora usan el usuario de la sesión. |

## Pendientes (no se pueden resolver solo en el frontend)

- **Backend**: replicar en el servidor (Go) los controles 4 a 8 y 12. Lo del frontend es solo una capa extra.
- **Sesión real**: usar cookies `HttpOnly; Secure; SameSite=Strict` emitidas por el backend tras OIDC/SAML, y nunca tokens en `localStorage`.
- **Cabeceras HTTP** en el servidor que sirva `dist/`: `Content-Security-Policy` (sin `unsafe-inline` en scripts), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` y HSTS. No se puso CSP en `index.html` porque rompe el HMR de Vite en desarrollo.
- **Hash SHA-256 simulado**: `uploadDocument` genera `sha256-<Math.random>`, que no prueba integridad. El hash real lo tiene que calcular el servidor sobre los bytes del archivo.
- **`sanitizeInput` al guardar**: React ya escapa al renderizar, así que codificar HTML antes de guardar es redundante y produce doble escape (se ve `&lt;` en pantalla). Lo correcto es validar al recibir y escapar al mostrar. Se dejó así para no romper el comportamiento actual.
- **Datos sensibles en el mock**: `src/data/mock.ts` trae correos y nombres en el bundle. No hay que usar datos reales.

## Cómo verificar

```bash
bun install
bun test        # 38 pruebas, incluye la suite "Parches de la auditoría de seguridad (QA)"
bun run build   # tsc + vite build
bun audit       # sin vulnerabilidades
```
