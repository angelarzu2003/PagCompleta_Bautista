# URPMP — Plataforma Universitaria de Gestión de Proyectos de Investigación

Aplicación completa (frontend + backend) para gestionar el ciclo de vida de proyectos de investigación:
propuestas, evaluación por pares ciegos, dictamen colegiado, plan de trabajo, documentos versionados,
productos científicos, reportes, bitácora de auditoría y asistente normativo.

| Parte | Tecnología | Carpeta |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind | [`frontend/`](frontend/) (repo original: `sedrick117/Bautista-frontend`) |
| Backend | Node.js + Express, API REST `/api/v1` | [`backend/`](backend/) |
| Base de datos | SQLite embebido (sql.js, sin instalar nada) | se crea sola en `backend/data/` |

---

## ▶ Levantar la plataforma (cualquier PC)

**Único requisito:** [Node.js](https://nodejs.org) **18.17 o superior** (recomendado 20 LTS o 22 LTS).

```bash
npm start
```

o con doble clic:

- **Windows:** `iniciar.bat`
- **macOS / Linux:** `./iniciar.sh`

La primera vez el comando instala las dependencias, compila el frontend y crea la base de datos con los
datos iniciales (tarda 1–2 minutos). Después abre **http://localhost:4000** en el navegador.
Las siguientes veces arranca en segundos y **conserva** todo lo que se haya registrado.

Para detenerla: `Ctrl + C` en la terminal.

### Iniciar sesión

La pantalla de acceso muestra el proveedor SSO y una lista de **cuentas institucionales** registradas.
Elija una cuenta y pulse *Entrar*. Cada cuenta tiene un rol distinto:

| Cuenta | Rol | Qué puede probar |
|---|---|---|
| Dr. Roberto Mendoza Vargas | Investigador Principal | Nueva propuesta, plan de trabajo, cargar evidencias, productos, subsanación |
| Br. Carlos Alva Paredes | Estudiante Investigador | Avance de actividades y entregables del proyecto donde es miembro |
| Dra. Elena Morales | Coordinación de Investigación | Decisiones de estado, validar productos, corpus normativo, cierre |
| Dra. Carmen Valdivia Prado | Comité Evaluador | Bandeja de revisión ciega, rúbrica, conflicto de interés, voto colegiado |
| Mg. Teresa Palomino Hurtado | Comité Evaluador | Tiene el voto pendiente de la sesión CIE Nº 014-2025 |
| Ing. Marcos Salinas | Coordinación de Departamento | Reportes de su facultad |
| Dr. Aurelio Benavides Castro | Autoridad Universitaria | Indicadores agregados |
| Lic. Sofía Quispe | Administración | Usuarios, catálogos, parámetros, bitácora de auditoría |

En la barra superior hay un **selector de rol** para cambiar de cuenta rápidamente durante una demostración
(se desactiva con `ENABLE_DEV_ROLE_SWITCHER=false` en `backend/.env`).

La verificación pública de documentos no requiere sesión: **http://localhost:4000/#/verificar?cvd=URP-9482-TX-2024**

---

## Qué hace el backend

- **Sesiones seguras:** cookie `HttpOnly` + token CSRF por sesión, expiración por 30 min de inactividad.
  Sin contraseñas locales (CON-002); el SSO institucional se simula eligiendo la cuenta.
- **Autorización en el servidor** para cada endpoint y cada objeto (matriz de roles, IDOR → 404,
  evaluación ciega, proyectos confidenciales).
- **Máquina de estados** del proyecto (Borrador → Enviado → En evaluación → Aprobado/Subsanación/Rechazado
  → En ejecución → Cierre solicitado → Cerrado) con justificación obligatoria e historial.
- **Concurrencia optimista** con `row_version` / `If-Match` (409 Conflict).
- **Documentos reales:** se suben archivos, se valida extensión y contenido, se calcula SHA-256 en el
  servidor, versionado inmutable, descarga con verificación de integridad. Límite 25 MB.
- **Plan de trabajo:** avance ponderado automático, entregables que no se envían sin evidencia, alertas
  automáticas a 7 días / 1 día / vencido.
- **Evaluación y dictamen:** rúbrica 35/35/30, conflicto de interés, votos firmados con SHA-256 y
  resolución colegiada con control de quórum.
- **Asistente normativo:** búsqueda BM25 sobre el texto de los reglamentos guardados en la base de datos;
  responde citando documento, artículo y página, declina preguntas fuera de tema y nunca usa normas
  retiradas. Pre-chequeo de propuestas con reglas de las bases y resumen para evaluadores. Todo local:
  ningún dato sale del servidor y los proyectos confidenciales quedan excluidos.
- **Bitácora de auditoría** append-only encadenada con SHA-256 y verificación de integridad.
- **Reportes** con filtros y exportación a CSV (Excel) y PDF.

---

## Comandos útiles (desde la raíz)

| Comando | Para qué |
|---|---|
| `npm start` | Instala lo que falte, compila y levanta todo en http://localhost:4000 |
| `npm run dev` | Modo desarrollo: backend con recarga automática + Vite con HMR en http://localhost:3000 |
| `npm test` | Pruebas de integración del backend (27) y unitarias del frontend (16) |
| `npm run reset-db` | Borra la base de datos y los archivos subidos y vuelve a cargar los datos iniciales |
| `npm run build` | Solo compila el frontend |

Configuración opcional: copie `backend/.env.example` como `backend/.env` (puerto, tamaño máximo de archivo,
tiempo de inactividad, etc.). Para abrirla desde otros equipos de la red use `HOST=0.0.0.0`.

### Alternativa con Docker

```bash
docker compose up --build
```

Queda en http://localhost:4000 y los datos se guardan en el volumen `urpmp-data`.

---

## Estructura

```
├── backend/
│   ├── src/
│   │   ├── server.js        # arranque, siembra inicial y tarea de alertas
│   │   ├── app.js           # Express, seguridad, errores estándar, sirve el frontend
│   │   ├── schema.sql       # modelo relacional
│   │   ├── seed.js          # datos iniciales
│   │   ├── auth.js          # sesiones, CSRF y permisos
│   │   ├── repo.js          # consultas y control de acceso por objeto
│   │   ├── ai.js            # asistente normativo, pre-chequeo y resumen
│   │   └── routes/          # core (auth, admin, IA), projects, reports (+ públicos)
│   ├── test/api.test.js     # pruebas de integración
│   └── data/                # BD y archivos (se genera, no se versiona)
├── frontend/                # SPA React (cliente HTTP en src/api/client.ts)
├── scripts/                 # start / dev / setup multiplataforma
├── iniciar.bat / iniciar.sh
└── Dockerfile / docker-compose.yml
```

## Notas

- Los datos iniciales (usuarios, proyectos, reglamentos, documentos) son de demostración para una
  universidad ficticia: sustitúyalos por los de su institución con la pantalla de Administración o
  editando `backend/src/seed.js` y ejecutando `npm run reset-db`.
- El documento de arquitectura original (`frontend/BASE..md`) contempla un backend en Go con PostgreSQL;
  esta implementación en Node.js + SQLite respeta el mismo contrato `/api/v1` y se eligió para que el
  proyecto funcione en cualquier PC sin instalar un servidor de base de datos.
- Para un SSO real (Microsoft Entra ID / Google / SAML) se reemplaza el endpoint `POST /api/v1/auth/login`
  por el callback OIDC/SAML del proveedor; el resto del sistema no cambia.
