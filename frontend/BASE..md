Este documento consolida la arquitectura técnica, el sistema de diseño, los contratos de API, las reglas de negocio y la totalidad de los requisitos funcionales (FR), no funcionales (NFR) y de Inteligencia Artificial (AIR) definidos en los entregables oficiales A1, A2, A3 (v1.1), A4, A5 y la Auditoría de Fase 0[cite: 1, 2, 3, 4, 5, 7]. Está estructurado como archivo de contexto base (System Context / Rules) para guiar la generación y refactorización de código con el agente de desarrollo[cite: 1, 7].1. Contexto General y Arquitectura del SistemaNombre del Sistema: Plataforma Universitaria de Gestión de Proyectos de Investigación (URPMP) — Universidad Politécnica de Durango.   Objetivo del Sistema: Centralizar el ciclo de vida completo de los proyectos de investigación (registro de propuestas, evaluación por comité, ejecución de plan de trabajo, control de documentos versionados, validación de productos científicos, reportes institucionales, bitácora de auditoría y asistencia normativa mediante IA basada en RAG), sustituyendo hojas de cálculo, correos y carpetas dispersas.   Patrón Arquitectónico: Aplicación web cliente-servidor implementada como una Single Page Application (SPA) en React que consume un monolito modular en Go (Golang) a través de una API REST (/api/v1).   Aislamiento y Límites de Seguridad del Cliente: El navegador web jamás se comunica directamente con la base de datos PostgreSQL, el almacenamiento privado de objetos (S3/volumen cifrado) ni el proveedor de IA (LLM); toda solicitud pasa por el servidor Go para validación de sesión, permisos por proyecto y filtrado de confidencialidad.   Repositorios Oficiales del Proyecto:Frontend: [https://github.com/oderflaY/project-bautista-Frontend](https://github.com/oderflaY/project-bautista-Frontend) (Responsable de arquitectura UI: Euen Eldrick Galindo García).   Backend: [https://github.com/oderflaY/Proyecto-de-bautista-Bakend](https://github.com/oderflaY/Proyecto-de-bautista-Bakend).   2. Stack Tecnológico Estricto del FrontendLibrería Core: React 18 mediante componentes funcionales modulares (.tsx)[cite: 1, 7].Lenguaje y Tipado: TypeScript en modo estricto (TS strict) para validación tipada de formularios complejos, estados de entidades y contratos OpenAPI[cite: 1, 7].Empaquetador (Build Tool): Vite, utilizando variables de entorno como import.meta.env.DEV para aislar herramientas de prueba (ej. conmutador de roles en desarrollo) antes de compilar a producción.Estilos: Tailwind CSS 3.4 compilado, utilizando tokens semánticos estrictos y evitando clases arbitrarias.Iconografía: Lucide React y Material Symbols Outlined (material-symbols-outlined) a 18px–20px.Tipografía:Principal (UI y Lectura): 'Plus Jakarta Sans' (pesos 400 Regular, 500 Medium, 600 SemiBold, 700 Bold).Técnica y Financiera: Fuente monoespaciada (tabular-nums) para presupuestos, porcentajes, hashes SHA-256, identificadores de expediente y registros de bitácora[cite: 1, 7].Compatibilidad y Responsividad (NFR-017): Diseño Mobile-First adaptable de forma continua desde 360px hasta 1920px de ancho de pantalla, compatible con las versiones actual y anterior de Chrome, Edge, Firefox y Safari.   Calidad y Pruebas (NFR-018): Pruebas automatizadas en React integradas en CI institucional que validen junto con el backend al menos el 70% de las reglas de negocio.   Idioma (CON-008, NFR-015): Toda la interfaz de usuario, etiquetas y mensajes de validación deben presentarse estrictamente en español.   3. Sistema de Diseño, Tokens y Reglas UX/UI (WCAG 2.1 AA)3.1 Tokens de ColorIdentidad Institucional:primary: #00142f (Azul institucional profundo para textos principales, encabezados y Sidebar).secondary: #0051d5 (Azul vibrante de acción, reservado para el único botón CTA primario por vista, enlaces activos y anillos de foco focus:ring-secondary).Superficies y Fondos:background: #f8f9ff (Fondo base de la aplicación).surface-container-lowest: #ffffff (Tarjetas principales, modales y drawers).surface-container-low / high / highest: #f1f5f9 a #e2e8f0 (Fondos de inputs, cabeceras de tabla y pie de página).outline-variant: #e2e8f0 (border-slate-200).Estados Semánticos:success: Fondo #ecfdf5, texto #065f46 / #047857, icono #059669.warning: Fondo #fffbeb, texto #92400e, borde #fde68a.danger / error: Fondo #fef2f2 / #fff1f2, contenedor #fee2e2, texto #991b1b / #b91c1c.3.2 Reglas Arquitectónicas Anti-Empalme y Accesibilidad (NFR-014, NFR-016)Respiro Visual (White Space): Queda prohibido usar paddings menores a p-4 (16px) en contenedores de contenido; las tarjetas (Cards) deben usar p-6 (24px) o p-8 (32px), y los Grids deben separar filas y columnas con gap-6 o gap-8.Tamaño Mínimo y Lectura: Ningún texto en la aplicación (incluyendo pies legales y badges) puede ser menor a 12px; los bloques de lectura deben usar interlineado relajado (leading-relaxed).Jerarquía de Acción Única: Solo puede existir UN botón CTA primario (bg-[#0051d5] text-white) por vista; todas las demás acciones (Guardar borrador, Descargar PDF, Exportar, Filtrar) deben usar variantes secundarias (outline) o terciarias (ghost).Límite de Densidad en Dashboards: Máximo 4 tarjetas KPI por fila en Desktop (apiladas a 1 columna en móvil) y máximo 5 datos visibles por tarjeta antes de requerir un desplegable.Divulgación Progresiva (<TechDetails>): Los metadatos técnicos secundarios (hashes SHA-256, certificados, bloques o IDs extensos) deben ocultarse por defecto dentro de un acordeón (<details>) o modal.Transformación Responsiva de Tablas: En resoluciones móviles (< 768px), las tablas de datos complejas (<DataTable>) deben transformarse en tarjetas apiladas (Responsive Cards) sin generar scroll horizontal[cite: 1, 7].Estados de Componentes y Accesibilidad: Todo formulario debe manejar estados idle, loading, error y success; los modales y el Wizard deben implementar atrapamiento de foco (focus trap); todos los botones que no envíen formularios deben declarar explícitamente type="button".4. Seguridad en el Cliente, Sesiones y Matriz de Roles4.1 Autenticación y Sesión (FR-001, CON-002, NFR-004, NFR-005)Cero Contraseñas Locales: El sistema delega la autenticación al servicio institucional (OIDC o SAML); está estrictamente prohibido renderizar inputs, columnas o flujos de contraseñas locales en cualquier pantalla.   Cookies Seguras + CSRF: El token del proveedor institucional permanece en el servidor Go; el navegador mantiene la sesión mediante cookies HttpOnly, Secure y SameSite, enviando un token CSRF en todas las peticiones mutables (POST, PATCH, DELETE).   Inactividad y Cierre: La sesión caduca automáticamente tras 30 minutos de inactividad (NFR-004), redirigiendo a /ingresar al recibir un estado HTTP 401.   Aviso de Privacidad en Primer Ingreso (NFR-009, UC-001 A1): En el primer inicio de sesión, el sistema debe mostrar un modal bloqueante (o Bottom Drawer en móvil) con el aviso de privacidad institucional con checkboxes desmarcados por defecto; el usuario debe aceptarlo para poder acceder al plataforma[cite: 1, 4, 7].4.2 Los 7 Roles Globales del Sistema (FR-004, BR-010, Tabla 8.3 de A3)Un usuario puede tener asignados uno o más roles institucionales, y la interfaz debe filtrar tanto el menú de navegación como las acciones permitidas por proyecto:   Rol del SistemaCódigo / ActorPermisos y Restricciones en el Frontend (según Tabla 8.3 de A3 y A5)1. Investigador PrincipalPI / ResearcherRegistra y edita sus propios borradores; envía propuestas; solicita modificaciones y cierre; define el plan de trabajo, registra avances, sube documentos, registra productos y consulta reportes de sus propios proyectos.   2. Estudiante InvestigadorStudent ResearcherSolo visualiza proyectos donde es miembro activo; registra porcentaje de avance y sube evidencias únicamente en las actividades que tiene asignadas (UC-006 A2); no puede crear proyectos ni ser PI (BR-012).   3. Coordinador de InvestigaciónResearch CoordinatorVisibilidad completa de todos los proyectos; asigna evaluadores verificando ausencia de conflicto de interés; registra la decisión final justificada; aprueba modificaciones y cierres; valida productos de investigación; genera todos los reportes y administra la base de conocimientos normativa (RAG).   4. Comité EvaluadorCommittee MemberVisualiza únicamente las propuestas que le fueron asignadas y registra su evaluación con recomendación y comentarios; no puede evaluar proyectos donde participa (BR-011).   5. Coordinador de DepartamentoDepartment CoordinatorAcceso de solo lectura a proyectos no confidenciales y reportes pertenecientes exclusivamente a su departamento académico.   6. Autoridad UniversitariaUniversity AuthorityConsulta únicamente dashboards institucionales y reportes agregados; no tiene acceso al contenido de expedientes individuales ni proyectos confidenciales.   7. Administrador del SistemaAdministratorGestiona cuentas de usuario (sin contraseñas locales), asigna roles, administra catálogos y parámetros del sistema, y consulta la bitácora de auditoría (audit_event); no tiene acceso al contenido de proyectos confidenciales.   Roles Internos dentro de un Proyecto (FR-011, BR-001, BR-012): Al gestionar el equipo de un proyecto, el sistema debe garantizar exactamente un PI activo (académico con rol Investigador) y permitir únicamente los roles internos: co-investigator (Coinvestigador), student researcher (Estudiante investigador) y collaborator (Colaborador), preservando el historial de actividades y documentos de los miembros dados de baja.   5. Arquitectura de Navegación y Especificación de Vistas (A5 + Fase 0)5.0 Contenedor Maestro: <AppShell>Desktop (>= 768px): Sidebar izquierdo fijo (260px–280px) con rutas filtradas por rol, Header superior con buscador, centro de notificaciones (Popover cerrado por defecto con contador de no leídas), selector de rol activo (solo visible si import.meta.env.DEV === true) y menú de perfil con botón de cierre de sesión[cite: 1, 7].Mobile (< 768px): Sidebar oculto (hidden md:flex) controlado por un botón de menú de hamburguesa en el Header (isMobileMenuOpen) que despliega un Drawer lateral accesible.5.1 Mapa de Rutas y Pantallas Oficiales (Sección 3.1 de A5)1. Acceso: /ingresar (UC-001, FR-001, NFR-004, NFR-009, NFR-015)Botón único «Entrar con cuenta institucional» con manejo de estados (idle, loading, error recuperable cuando el servicio de identidad no está disponible 503 o la cuenta está inactiva)[cite: 1, 4, 7].Modal / Drawer de Aviso de Privacidad en el primer ingreso con checkboxes desmarcados por defecto[cite: 1, 4, 7].2. Tablero Principal: /inicio (FR-024, FR-033 a FR-036, FR-040)Fila superior de máximo 4 tarjetas KPI adaptadas al rol activo[cite: 1, 7].Tarjetas de proyectos activos, lista de tareas/entregables próximos o vencidos (Overdue) y filtros dinámicos según rol.   Centro de Notificaciones (FR-033 a FR-036): Colapsado por defecto; permite consultar notificaciones leídas y no leídas sobre alertas de vencimiento (7 días antes, 1 día antes y día de vencimiento), cambios de estado y comentarios de evaluación[cite: 1, 4, 7].3. Nueva Propuesta (Wizard): /proyectos/nuevo (UC-003, UC-004, FR-007 a FR-013, OI-003)Estructura Visual (A5): Encabezado con identificador y estado; componente <Stepper> desacoplado con 5 secciones (1. Datos Generales, 2. Equipo, 3. Objetivos y Metodología, 4. Calendario, 5. Financiamiento y Declaraciones); formulario central de la sección activa; panel lateral derecho «Campos por completar»; y pie fijo con botón secundario «Guardar borrador» y CTA primario «Enviar a revisión»[cite: 1, 7].Validación con Enlaces de Foco (FR-009, UC-004 E1): Si falta un campo obligatorio o hay un valor inválido (ej. fecha de término anterior a la fecha de inicio), debe mostrarse un resumen de errores con enlaces directos que muevan el foco a cada campo afectado e identifiquen la corrección requerida.   Alerta de Duplicados (FR-010, UC-003 A1): Si la propuesta coincide en título e investigador principal con un proyecto existente, muestra una advertencia y solicita confirmación explícita antes de guardar.   Confirmación de Envío (UC-004): Al pulsar «Enviar a revisión», abre un diálogo de confirmación advirtiendo que la propuesta quedará en modo de solo lectura durante la revisión.   Pre-chequeo de Completitud con IA (AIR-008, AIR-009, UC-012): Botón opcional para que el PI solicite observaciones preventivas sobre su borrador antes de enviarlo (deshabilitado si el proyecto está marcado como confidencial AIR-011).   4. Expediente Maestro del Proyecto: /proyectos/:id (FR-011 a FR-032, FR-044)Vista estructurada en 7 pestañas (Tabs) cuyas acciones se habilitan según el rol del usuario y el estado del proyecto:   Resumen: Datos generales, indicador de confidencialidad, presupuesto y botón para Solicitar Modificación de Proyecto Aprobado (FR-012) con motivo justificado (preservando la versión previa en project_version). Incluye la vista consolidada de Subsanación de Observaciones con comparador visual (Redline Diff v1.0 vs v1.1) cuando el estado es Changes requested[cite: 1, 4, 7].   Equipo (FR-011): Gestión de miembros (co-investigator, student researcher, collaborator) manteniendo un único PI y conservando el historial de miembros dados de baja.   Evaluaciones (FR-016 a FR-019): Consulta de dictámenes, recomendaciones y comentarios registrados.   Plan de Trabajo (FR-020 a FR-024, UC-006): Lista/tabla responsiva de actividades y entregables con nombre, descripción, miembro responsable, fecha de inicio, fecha de vencimiento y peso/ponderación (weight) validado según la regla OI-007 (almacenando la versión de la regla utilizada). Incluye barra/slider de progreso (0 a 100%), cálculo automático del avance general por promedio ponderado (FR-023), marcado automático de estado Overdue (FR-024) y bloqueo del botón «Marcar entregable como Enviado» hasta que exista al menos un documento de evidencia adjunto (FR-022)[cite: 1, 4, 7].   Archivos: Acceso directo al gestor documental del proyecto.   Productos (FR-030 a FR-032, UC-008): Registro de productos vinculados al proyecto con selector de 8 tipos (artículo de revista, ponencia en congreso, libro, capítulo de libro, tesis, patente, software u otro), título, autores, fecha, editorial/revista (venue), DOI o URL, estado (en preparación, enviado, aceptado o publicado), carga de archivo probatorio/carta de aceptación y botón de validación exclusiva para la Coordinación.   Historial y Cierre (FR-018, FR-019, FR-044, UC-013): Línea de tiempo inmutable (no editable ni eliminable) de todos los cambios de estado y decisiones con usuario, fecha, hora, estado anterior, estado nuevo y justificación. Incluye el flujo para que el PI suba el informe final y solicite el cierre (Closure requested), y el Checklist de Cierre para que la Coordinación verifique (informe final cargado + entregables obligatorios enviados/cancelados + productos registrados) antes de aprobar el paso a Closed o devolverlo con observaciones a In progress.   5. Bandeja de Revisión y Evaluación: /revision (UC-005, FR-015 a FR-019, BR-011, AIR-010)Layout de 3 Paneles en Desktop (apilados en móvil con etiquetas accesibles):Panel Izquierdo: Lista de expedientes pendientes/asignados con filtros y fecha límite de revisión (due_at).   Panel Central: Visor de la propuesta, sus versiones/documentos y, para proyectos no confidenciales, el Resumen Ejecutivo generado por IA de máximo 250 palabras (AIR-010) claramente etiquetado como apoyo orientativo.   Panel Derecho: Para la Coordinación, selector de asignación de evaluadores que excluye automáticamente a cualquier miembro con conflicto de interés (FR-015, BR-011) y exige fecha límite, además del formulario de decisión final (Aprobar, Rechazar o Solicitar cambios) con justificación obligatoria (FR-017). Para el Comité Evaluador, formulario de evaluación con recomendación y comentarios (FR-016) e inhibición por conflicto de interés[cite: 1, 4, 7].   6. Gestión de Documentos Versionados: /proyectos/:id/documentos (UC-007, FR-025 a FR-029)Zona de Carga (Dropzone): Acepta únicamente archivos PDF, DOCX, XLSX, PPTX, PNG o JPG de hasta 25 MB por archivo y verifica que no se exceda la cuota del proyecto (OI-010).   Clasificación Obligatoria (FR-025): Selector de tipo de documento (Propuesta proposal, Informe técnico technical report, Evidencia evidence, Informe final final report, Convenio agreement u Otro other) y campo de nota de cambio (change_note).   Versionado Automático e Inmutabilidad (FR-026, FR-029): Si se sube un archivo con el mismo nombre y tipo en el proyecto, el sistema crea una nueva versión (version_no + 1) sin sobrescribir la anterior. Queda prohibido incluir botones para eliminar versiones; solo se permite la acción «Marcar como Obsoleto» ingresando un motivo obligatorio (obsolete_reason).   Buscador y Descarga (FR-027, FR-028): Filtros por nombre, tipo, proyecto, autor y rango de fechas, y descarga segura de cualquier versión mediante enlace temporal autorizado.   7. Módulo de Reportes y Dashboard Institucional: /reportes (UC-010, FR-037 a FR-041, NFR-002)Dashboard Institucional (FR-040): Indicadores por año seleccionado mostrando proyectos por estado, proyectos por departamento y área de investigación, entregables vencidos y productos validados por tipo.   Generador de los 4 Reportes Oficiales:Proyectos por estado (FR-037): Filtrable por periodo, departamento, área y estado; exportable a PDF y XLSX.   Productos de investigación (FR-038): Filtrable por periodo, departamento e investigador, contabilizando exclusivamente productos validados (BR-013); exportable a PDF y XLSX.   Avance y entregables vencidos (Overdue) (FR-039): Filtrable por proyecto y por departamento.   Ficha técnica de proyecto (Project record sheet - FR-041): Información general, miembros, historial de estados, entregables y productos de un expediente, exportable a PDF.   Reglas de Exportación y Privacidad (BR-014, UC-010 A2): Si el filtro no arroja registros, muestra "No existen registros que coincidan con los filtros" y deshabilita la exportación de archivos vacíos. Los proyectos confidenciales solo aparecen como conteo agregado para autoridades.   8. Ayuda Normativa (Asistente IA RAG) y Gestión de Corpus: /normativa (UC-011, UC-014, FR-045, AIR-001 a AIR-007)Interfaz de Consulta (UC-011):Campo de pregunta en español con contador y límite estricto de 1,000 caracteres (AIR-001).   Cada respuesta generada debe mostrar un aviso visible indicando que es generada por IA, de carácter orientativo (no vinculante) y que las decisiones oficiales corresponden a la autoridad competente (AIR-005), prohibiendo mostrar porcentajes de certeza jurídica[cite: 1, 4, 7].Citas Verificables (AIR-002): Cada afirmación muestra el documento fuente, su versión y la página o sección exacta.   Umbral de No Encontrado (AIR-003) y Fuera de Ámbito (AIR-013): Si no hay evidencia suficiente en las normas activas, muestra "No se encontró en la documentación aprobada; consulte a Coordinación"; si se le pide redactar contenido de investigación o ejecutar acciones de sistema, rechaza la solicitud explicando que es de solo lectura (AIR-014).   Evaluación de Respuesta (AIR-006): Botones para calificar cada respuesta como Útil o No útil más un comentario opcional.   Gestión de la Base de Conocimientos (UC-014, FR-045, AIR-004 - Exclusivo Coordinación): Vista o pestaña para agregar, reemplazar y retirar documentos normativos (PDF), registrando título, versión, fecha de entrada en vigor y estado (Activo / Retirado), reflejando el cambio en las búsquedas en menos de 30 minutos.   9. Administración, Catálogos, Parámetros y Bitácora: /administracion (UC-002, FR-002 a FR-006, FR-043, NFR-019)Sub-módulo 1 — Usuarios SSO (FR-002 a FR-004, BR-015): Tabla y formulario para registrar y editar perfiles (nombre completo, correo institucional único, departamento, asignación de múltiples roles y switch Activo/Inactivo sin borrar historial ni gestionar contraseñas locales).   Sub-módulo 2 — Catálogos Institucionales (FR-006): CRUD de Departamentos, Áreas de investigación, Líneas de investigación, Tipos de proyecto y Tipos de entregable.   Sub-módulo 3 — Parámetros Configurables del Sistema (NFR-019, system_setting): Formulario para modificar sin tocar código fuente (y dentro de rangos aprobados) los días de anticipación de notificaciones (7 y 1 día) y los parámetros del asistente IA (umbral de relevancia y longitud máxima de respuesta).   Sub-módulo 4 — Bitácora de Auditoría Inmutable (FR-042, FR-043, NFR-008): Visor de solo lectura (sin botones de edición o borrado para ningún rol) filtrable por usuario, rango de fechas, acción y registro afectado.   (Nota sobre pantallas extendidas del prototipo: Las vistas de Emisión de Resolución Rectoral y Portal Público de Verificación QR/CVD se conservan como vistas complementarias de valor ejecutivo, aplicando enmascaramiento obligatorio de datos personales como DNI: ***.***.342 y ocultando metadatos dentro de <TechDetails>)[cite: 4, 7].6. Contrato de API REST (/api/v1) y Manejo de Errores en el Cliente6.1 Convenciones de Comunicación HTTP (Sección 6 de A5)Prefijo y Formato: Todas las rutas consumen /api/v1 con payloads application/json; charset=utf-8 (excepto subida de documentos en multipart/form-data) y fechas en formato ISO 8601 UTC que el cliente formatea a la zona horaria institucional.   Paginación Estándar: ?page=1&page_size=25 (máximo 100 registros por petición) combinable con filtros de rol, texto, periodo y estado.   Control de Concurrencia Optimista (row_version): Al actualizar o enviar un proyecto (PATCH /api/v1/projects/:id o POST /api/v1/projects/:id/submit), el frontend debe enviar el entero row_version actual (ej. { "row_version": 3 }) y almacenar el nuevo row_version devuelto.   6.2 Tabla Completa de Endpoints a Consumir en src/api/MóduloMétodo y Endpoint (/api/v1/...)Payload de Solicitud → RespuestaRoles Autorizados y Códigos HTTPAutenticaciónGET /auth/startGET /auth/callbackPOST /auth/logoutGET /meRedirección SSO → Cookie de sesión; perfil activo, departamento y arreglo de roles.   Público (start/callback) y Autenticado (/me, /logout); 200, 302, 401, 503.   UsuariosGET /usersPOST /usersPATCH /users/:idDatos de perfil, arreglo de roles y bandera active (sin contraseñas) → perfil actualizado.   Administrador; 200, 201, 400, 409 (correo duplicado FR-003).   CatálogosGET /catalogsPATCH /catalogs/:type/:idConsulta y actualización de departamentos, áreas, líneas y tipos.   Lectura autenticada; mutación Administrador; 200, 403, 422.   ProyectosGET /projectsPOST /projectsGET /projects/:idPATCH /projects/:idPOST /projects/:id/submitDatos de propuesta y row_version → ID, estado actual y nuevo row_version.   PI (creación/edición en Draft o Changes requested); lectura según BR-010 y BR-014; 200, 201, 403, 409, 422.   Miembros y ModificacionesPOST /projects/:id/membersPATCH /projects/:id/members/:memberIdPOST /projects/:id/modification-requestsUsuario, rol de proyecto (BR-012) y fechas → membresía; cambios y justificación → solicitud (FR-012).   PI y resolución por Coordinación; 200, 201, 403, 409, 422.   Revisión y DecisionesPOST /projects/:id/reviewsPOST /reviews/:id/evaluationPOST /projects/:id/decisionsGET /projects/:id/historyAsignación de revisor y due_at; recomendación y comentarios; decisión final y justificación → historial status_history.   Coordinación / Miembro del Comité asignado / Lectura autorizada; 200, 201, 403, 409, 422.   Plan de Trabajo y EntregablesPOST /projects/:id/activitiesPOST /activities/:id/progressPOST /deliverables/:id/submitActividades con weight; porcentaje 0–100 y comentario; envío de entregable con evidencia adjunta.   PI y Estudiante responsable; 200, 201, 422.   DocumentosPOST /projects/:id/documentsGET /documents/:id/versionsGET /document-versions/:id/downloadPOST /documents/:id/obsoletemultipart/form-data (archivo ≤ 25 MB, type, change_note); lista de versiones; URL de descarga temporal; obsolete_reason.   Miembros del proyecto o roles autorizados; 200, 201, 403, 413, 415, 422, 503.   Productos de InvestigaciónPOST /projects/:id/productsPOST /products/:id/validateDatos del producto y evidencia → registro en research_product y validación.   PI (registro) / Coordinación (validación); 200, 201, 403, 422.   Cierre de ProyectoPOST /projects/:id/closure-requestPOST /projects/:id/closure-decisionInforme final cargado → estado Closure requested; revisión de checklist BR-006 → Closed o retorno a In progress.   PI / Coordinación; 200, 403, 409, 422.   NotificacionesGET /notificationsPATCH /notifications/:id/readFiltro de leídas/no leídas → lista de avisos in-app y marcado de lectura.   Usuario destinatario; 200, 403.   ReportesGET /reports/projectsGET /reports/productsGET /reports/progressGET /reports/:kind/exportFiltros por periodo, departamento, área y estado → datos JSON o descarga binaria PDF / XLSX.   Coordinación, Coordinador de Depto., Autoridad e Investigador según BR-010; 200, 400, 403, 503.   Asistente IA y NormativaPOST /regulationsPATCH /regulations/:idPOST /assistant/questionsPOST /assistant/interactions/:id/ratingCarga/retiro de normas; pregunta <= 1000 chars → respuesta con citas source_refs; valoración booleana y comentario.   Coordinación (normas) / Cualquier usuario autenticado (consulta); 200, 201, 422, 503.   Auditoría y AjustesGET /audit-eventsPATCH /settings/:keyFiltros de bitácora → eventos con cadena hash; actualización de parámetros dentro de rangos permitidos.   Administrador / Roles autorizados en matriz; 200, 403, 422.   6.3 Esquema de Errores y Reacción de la Interfaz (Sección 10 de A5)Contrato JSON de Error: { "error": { "code": "...", "message": "...", "fields": [{ "field": "end_date", "message": "Indica una fecha posterior a la de inicio" }] }, "request_id": "..." }.   Mapeo de Códigos HTTP en el Cliente:401 Unauthorized: Limpiar estado de sesión local y redirigir a /ingresar.   403 Forbidden / 404 Not Found: Mostrar vista de acceso restringido o recurso inexistente sin revelar metadatos de proyectos confidenciales.   409 Conflict: Informar que el correo ya existe (FR-003) o que la versión/estado del proyecto fue modificada por otro usuario (row_version), ofreciendo recargar el registro.   413 Payload Too Large / 415 Unsupported Media Type: Rechazar archivo en el Dropzone indicando el límite de 25 MB y los formatos válidos (PDF, DOCX, XLSX, PPTX, PNG, JPG), manteniendo intacta la versión previa (NFR-013).   422 Unprocessable Entity: Resaltar cada campo listado en error.fields[] y mostrar el mensaje correctivo.   503 Service Unavailable: Mostrar mensaje recuperable (ej. "El asistente no está disponible temporalmente" en IA o error de servicio de identidad) sin bloquear el resto de los módulos de la plataforma.   7. Máquina de Estados del Proyecto (BR-005, Tabla 8.2 de A3)El frontend debe habilitar o bloquear botones de acción respetando estrictamente las transiciones de estado autorizadas:   Estado Origen (From)Estado Destino (To)Ejecutado porCondición Requerida en UI y APIDraftSubmittedInvestigador Principal (PI)Todos los campos obligatorios completos (BR-002 / OI-003).   SubmittedUnder reviewCoordinador de InvestigaciónAl menos un miembro del comité asignado sin conflicto de interés (BR-011) y con fecha límite.   Under reviewApproved / Rejected / Changes requestedCoordinador de InvestigaciónEvaluaciones registradas o fecha límite vencida; justificación obligatoria ingresada.   Changes requestedSubmittedInvestigador Principal (PI)Propuesta corregida cumpliendo validaciones obligatorias (BR-002).   ApprovedIn progressSistema (Automático)Transición automática al cumplirse la fecha de inicio del proyecto (start_date).   In progressSuspendedCoordinador de InvestigaciónJustificación obligatoria ingresada.   SuspendedIn progressCoordinador de InvestigaciónJustificación obligatoria ingresada.   In progressClosure requestedInvestigador Principal (PI)Informe final (final report) cargado en el expediente.   Closure requestedClosedCoordinador de InvestigaciónChecklist de cierre cumplido (BR-006: informe final + entregables obligatorios enviados o cancelados).   Closure requestedIn progressCoordinador de InvestigaciónObservaciones ingresadas al devolver la solicitud de cierre.   Draft / In progress / SuspendedCancelledCoordinador de InvestigaciónJustificación obligatoria ingresada.   Estados Finales Inmutables: Rejected, Closed y Cancelled son estados finales (el expediente pasa a modo de solo lectura permanente).   Restricción Absoluta de IA (BR-007, BR-008, AIR-014): El componente de IA tiene acceso exclusivo de solo lectura; jamás puede ejecutar transiciones de estado, aprobar propuestas ni modificar registros oficiales.   8. Reglas de Gobernanza de IA y Privacidad de Datos (AIR-001 a AIR-014)Exclusión de Proyectos Confidenciales y Datos Personales (NFR-010, AIR-011, BR-014): Cuando un proyecto tiene confidential = true, el frontend debe deshabilitar el pre-chequeo de completitud (AI-2) y ocultar el resumen para evaluadores (AI-3), garantizando que ni textos confidenciales ni datos personales (correos, identificadores) se envíen al servicio LLM.   Mitigación del Defecto AIR-007 (Detectado en Auditoría A4): El almacenamiento y consulta de logs de interacción con la IA (ai_interaction: usuario, fecha, pregunta, fuentes, respuesta y calificación) debe restringirse exclusivamente a los roles autorizados en la matriz de permisos, aplicando minimización de datos, retención de 12 meses y controles de borrado documentados previa aprobación jurídica.   Métricas de Rendimiento (NFR-001 a NFR-003):Listas y búsquedas estándar: respuesta en < 3 segundos para el 95% de las solicitudes.   Exportación de reportes (PDF / XLSX hasta 1,000 registros): < 10 segundos.   Respuestas del Asistente IA: < 15 segundos para el 90% de las preguntas válidas (con timeout de interfaz a los 30 segundos según UC-011 E1).   9. Datos Semilla Normalizados para Desarrollo (/src/data/mock.ts)Para mantener coherencia visual y matemática en las vistas y pruebas unitarias antes de conectar el backend, el archivo /src/data/mock.ts debe utilizar los siguientes valores estandarizados en la Auditoría de Fase 0:Proyecto Eje: "Despliegue de Red Telemétrica de Sensores IoT de Bajo Costo para Monitoreo Bioclimático en Cuencas Altoandinas".Identificadores Trazables:Código Definitivo: PID-2023-CRH-019.Expediente Anónimo (Evaluación): #PROP-2025-084-ANON.Código de Verificación Digital (CVD): URP-9482-TX-2024.Resolución Rectoral: R.R. Nº 1042-2024-R-URPMP.Calificación Consolidada: 91.00 / 100 Puntos (Nivel de Excelencia Académica A+).Coherencia Financiera Exacta (Suma de fases = 100%):Monto Total Adjudicado: S/. 157,500.00 PEN ($42,000.00 USD a T.C. 3.75).Anticipo Fase I (40%): S/. 63,000.00 PEN ($16,800.00 USD).Hito Intermedio Fase II (40%): S/. 63,000.00 PEN ($16,800.00 USD).Hito Final Fase III (20%): S/. 31,500.00 PEN ($8,400.00 USD).Perfiles de Prueba por Rol:Investigador Principal (PI): Dr. Roberto Mendoza Vargas (DNI en vistas privadas: 41.890.342 / DNI enmascarado en vistas públicas: ***.***.342).Coordinadoras de Investigación: Dra. Elena Morales y Dra. Elena Vargas.   Presidenta del Comité Evaluador / Ética: Dra. Carmen Valdivia Prado.Evaluador Asignado: Revisor Par #REV-7734.Autoridades Universitarias: Dr. Aurelio Benavides Castro (Rector) y Dr. Hugo Santillana Pinedo (Secretario General).10. Estructura de Directorios Recomendada para el Agente (src/)Plaintextsrc/
├── api/                  # Cliente HTTP (fetch/axios con credenciales HttpOnly, token CSRF e interceptores 401/409/422/503)
├── components/
│   ├── layout/           # AppShell.tsx, Sidebar.tsx, Header.tsx, MobileDrawer.tsx, Footer.tsx
│   ├── ui/               # Button.tsx, Card.tsx, DataTable.tsx (con variante ResponsiveCard), Stepper.tsx, Modal.tsx, TechDetails.tsx, Toast.tsx
│   └── guards/           # ProtectedRoute.tsx (validación por los 7 roles BR-010 y pertenencia al proyecto BR-009)
├── context/              # AuthContext.tsx (sesión /me, timeout 30 min NFR-004 y selector DEV de los 7 roles)
├── data/                 # mock.ts (datos normalizados e interfaces semilla)
├── hooks/                # useAuth.ts, useIdleTimeout.ts, useOptimisticVersion.ts
├── pages/
│   ├── auth/             # LoginSSOView.tsx (/ingresar + Modal Privacidad NFR-009)
│   ├── dashboard/        # DashboardView.tsx (/inicio + Centro de Notificaciones FR-033..036)
│   ├── projects/         # NewProjectWizard.tsx (/proyectos/nuevo + Pre-check AI-2), ProjectDetailView.tsx (/proyectos/:id con 7 Tabs)
│   ├── review/           # ReviewInboxView.tsx (/revision de 3 paneles + Resumen AI-3 + Conflicto BR-011)
│   ├── documents/        # ProjectDocumentsView.tsx (/proyectos/:id/documentos + Versionado + Obsoleto FR-029)
│   ├── reports/          # ReportsDashboardView.tsx (/reportes con los 4 reportes FR-037..041 y exportación PDF/XLSX)
│   ├── normative/        # NormativeAssistantView.tsx (/normativa Chat RAG AI-1 + Gestión de Corpus FR-045)
│   ├── admin/            # AdminPanelView.tsx (/administracion: Usuarios SSO, Catálogos, Parámetros NFR-019 y Audit Log FR-043)
│   └── public/           # PublicVerificationView.tsx (Portal QR/CVD Mobile-First con DNI enmascarado)
├── types/                # Modelos TypeScript estrictos reflejando el diccionario de datos de A5 (Sección 5)
└── utils/                # Formateadores de moneda, fechas UTC a zona institucional y val


El archivo src/types/domain.ts traduce a TypeScript estricto (TS strict) la totalidad del diccionario de datos de A5 (Sección 5), el contrato de API REST de A5 (Sección 6), la máquina de estados y matriz de permisos de A3 (Secciones 6, 8 y 9), las correcciones de auditoría de A4 y las estructuras de interfaz auditadas en la Fase 0[cite: 1, 4, 5, 6].Convenciones de Datos (A5 Sección 5): Todos los identificadores primarios y foráneos utilizan UUID, las marcas de tiempo se reciben en ISO 8601 UTC para formatearse en la zona horaria institucional, y los montos financieros o porcentajes respetan las restricciones de precisión y rango (0–100 para avances, >= 0 para montos).   Concurrencia Optimista e Inmutabilidad (A5 Secciones 5 y 6): La interfaz Project incluye row_version obligatorio para prevenir sobrescrituras concurrentes (409 Conflict), mientras que las versiones de propuestas (ProjectVersion), versiones de documentos (DocumentVersion), decisiones (StatusHistory) y eventos de bitácora (AuditEvent) se modelan como registros inmutables (readonly).   Gobernanza de IA y Privacidad (A3 Sección 9, A4): Los tipos para el asistente RAG (AIInteraction), el pre-chequeo de completitud (AIPreCheckResult) y el resumen para evaluadores (AIProposalSummary) incorporan las restricciones de solo lectura (AIR-014), exclusión de proyectos confidenciales (AIR-011) y controles de retención/acceso de bitácora (AIR-007).   Archivo: src/types/domain.tsTypeScript/**
 * ESPECIFICACIÓN DE TIPOS DE DOMINIO Y CONTRATOS DE API — PLATAFORMA URPMP
 * Basado en los entregables oficiales A3 (v1.1), A4, A5 y Auditoría de Fase 0.
 * Stack: React 18 + TypeScript Strict + API REST (/api/v1)
 */

// ============================================================================
// 1. PRIMITIVAS Y CONVENCIONES BASE (A5 Sección 5 y 6)
// ============================================================================

/** Identificador único universal (UUID v4) */
export type UUID = string;

/** Fecha y hora en formato ISO 8601 UTC (ej. "2026-10-06T14:30:00Z") */
export type ISODateTimeUTC = string;

/** Fecha calendario en formato ISO 8601 (ej. "2026-10-06") */
export type ISODate = string;

/** Hash criptográfico SHA-256 en formato hexadecimal */
export type SHA256Hash = string;

/** Estado de ciclo de vida de peticiones asíncronas en formularios y vistas (Fase 0) */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// 2. ROLES, PERMISOS Y AUTENTICACIÓN SSO (FR-001..005, BR-001, BR-010, BR-012)
// ============================================================================

/**
 * Los 7 roles globales del sistema definidos en A3 (FR-004, Tabla 8.3) y A5.
 * Un usuario puede tener uno o múltiples roles asignados.
 */
export type SystemRoleCode =
  | 'researcher'              // Investigador Principal (PI)
  | 'student_researcher'      // Estudiante Investigador
  | 'research_coordinator'    // Coordinador de Investigación
  | 'committee_member'        // Miembro del Comité Evaluador
  | 'department_coordinator'  // Coordinador de Departamento (solo lectura no confidencial de su depto.)
  | 'university_authority'    // Autoridad Universitaria (solo reportes/dashboards agregados)
  | 'administrator';          // Administrador del Sistema (sin acceso a expedientes confidenciales)

/**
 * Roles permitidos para miembros internos de un proyecto (FR-011, BR-001, BR-012).
 * El Investigador Principal (PI) es único y se almacena en `Project.pi_user_id`.
 */
export type ProjectMemberRole =
  | 'co_investigator'
  | 'student_researcher'
  | 'collaborator';

/** Proveedores de identidad institucionales soportados en el acceso SSO (CON-002) */
export type IdentityProvider = 'microsoft_entra' | 'google_workspace' | 'saml_institutional';

export interface Role {
  readonly code: SystemRoleCode;
  readonly name: string;
}

/**
 * Entidad `user_profile` (A5 Tabla 5, FR-002, BR-015).
 * PROHIBIDO almacenar o manejar contraseñas locales (CON-002).
 */
export interface UserProfile {
  readonly id: UUID;
  readonly institutional_subject: string;
  email: string;
  full_name: string;
  department_id: UUID;
  department_name?: string;
  roles: SystemRoleCode[];
  active: boolean;
  /** En vistas públicas se enmascara obligatoriamente como "***.***.342" (NFR-009, Fase 0) */
  masked_national_id?: string;
  privacy_accepted_at?: ISODateTimeUTC | null;
}

export interface AuthSession {
  readonly user: UserProfile;
  readonly active_role: SystemRoleCode;
  readonly csrf_token: string;
  /** Expiración tras 30 minutos de inactividad (NFR-004) */
  readonly expires_at: ISODateTimeUTC;
}

// ============================================================================
// 3. CATÁLOGOS INSTITUCIONALES (FR-006, A5 Tabla 5)
// ============================================================================

export type CatalogType =
  | 'departments'
  | 'research_areas'
  | 'research_lines'
  | 'project_types'
  | 'deliverable_types';

/** Entidades `department`, `research_area`, `research_line`, `project_type`, `deliverable_type` */
export interface CatalogItem {
  readonly id: UUID;
  name: string;
  active: boolean;
  parent_id?: UUID | null; // Ej. Línea de investigación vinculada a un Área
}

// ============================================================================
// 4. MÁQUINA DE ESTADOS DEL PROYECTO Y TRANSICIONES (FR-014, BR-005, Tabla 8.2)
// ============================================================================

/**
 * Estados oficiales del ciclo de vida del proyecto (Tabla 8.2 de A3 y Sección 7 de A5).
 * 'Rejected', 'Closed' y 'Cancelled' son estados finales de solo lectura.
 */
export type ProjectStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under review'
  | 'Approved'
  | 'Rejected'
  | 'Changes requested'
  | 'In progress'
  | 'Suspended'
  | 'Closure requested'
  | 'Closed'
  | 'Cancelled';

export const FINAL_PROJECT_STATUSES: readonly ProjectStatus[] = [
  'Rejected',
  'Closed',
  'Cancelled',
] as const;

// ============================================================================
// 5. PROYECTOS, VERSIONES Y MIEMBROS (FR-007..013, BR-001, BR-004, OI-003)
// ============================================================================

export interface SpecificObjective {
  readonly id: string; // Ej. "OE1", "OE2", "OE3" (mínimo 3 en el Wizard de Fase 0)
  order: number;
  description: string;
}

export interface BudgetPhaseBreakdown {
  readonly phase_number: 1 | 2 | 3;
  readonly name: string;
  readonly percentage: number; // Ej. 40%, 40%, 20% (Suma = 100%)
  readonly amount_pen: number; // Ej. 63000, 63000, 31500 (Suma = 157500.00 PEN)
  readonly amount_usd?: number;
}

/** Entidad `project` (A5 Tabla 5) */
export interface Project {
  readonly id: UUID;
  readonly code: string; // Ej. "PID-2023-CRH-019"
  readonly anonymous_code?: string; // Ej. "#PROP-2025-084-ANON" para evaluación ciega
  title: string;
  pi_user_id: UUID;
  pi_full_name?: string;
  department_id: UUID;
  area_id: UUID;
  line_id: UUID;
  type_id: UUID;
  status: ProjectStatus;
  /**
   * Si `confidential === true`, su contenido solo es visible para miembros, revisores
   * asignados y coordinación, y queda EXCLUIDO de procesamiento IA (BR-014, NFR-010, AIR-011).
   */
  confidential: boolean;
  start_date: ISODate;
  end_date: ISODate; // Restricción CHECK: end_date >= start_date (FR-009)
  requested_funding: number; // Restricción CHECK: >= 0
  overall_progress?: number; // Promedio ponderado 0-100 (FR-023)
  /** Entero de control de concurrencia optimista para PATCH y POST /submit (A5 Sección 6) */
  row_version: number;
  current_version?: ProjectVersion;
  budget_breakdown?: BudgetPhaseBreakdown[];
}

/**
 * Entidad `project_version` (A5 Tabla 5, FR-008, FR-012, BR-004).
 * Inmutable: jamás se sobrescribe una versión previa.
 */
export interface ProjectVersion {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly version_no: number;
  readonly summary: string; // Máximo 500 palabras en validación de UI
  readonly general_objective?: string;
  readonly specific_objectives?: SpecificObjective[];
  readonly objectives: string;
  readonly justification: string;
  readonly methodology: string;
  readonly funding_source: string | null;
  readonly created_at: ISODateTimeUTC;
  readonly created_by: UUID;
}

/**
 * Entidad `project_member` (A5 Tabla 5, FR-011, BR-012).
 * Cuando un miembro se retira, se registra `left_at` conservando su historial.
 */
export interface ProjectMember {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly user_id: UUID;
  readonly full_name: string;
  readonly email: string;
  project_role: ProjectMemberRole;
  readonly joined_at: ISODateTimeUTC;
  left_at: ISODateTimeUTC | null;
}

/** Solicitud de modificación de proyecto aprobado (`FR-012`, `POST /projects/:id/modification-requests`) */
export interface ModificationRequest {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly requested_by: UUID;
  readonly motive: string;
  readonly proposed_changes: Partial<Pick<ProjectVersion, 'summary' | 'objectives' | 'justification' | 'methodology' | 'funding_source'>> &
    Partial<Pick<Project, 'title' | 'end_date' | 'requested_funding'>>;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly coordinator_resolution_comment?: string;
  readonly created_at: ISODateTimeUTC;
  readonly resolved_at?: ISODateTimeUTC | null;
}

// ============================================================================
// 6. EVALUACIÓN, DECISIONES E HISTORIAL INMUTABLE (FR-015..019, BR-003, BR-011)
// ============================================================================

export type EvaluationDecisionType = 'approve' | 'reject' | 'request_changes';

/** Entidad `review_assignment` (A5 Tabla 5, FR-015) */
export interface ReviewAssignment {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly reviewer_id: UUID;
  readonly reviewer_alias?: string; // Ej. "Revisor Par #REV-7734"
  readonly due_at: ISODateTimeUTC; // Fecha límite obligatoria (FR-015)
  readonly has_conflict_of_interest?: boolean; // Excluido por BR-011
  readonly evaluation?: Evaluation | null;
}

export interface RubricCriterionScore {
  readonly criterion_id: string;
  readonly criterion_name: string;
  readonly max_score: number;
  score: number;
  qualitative_justification: string; // Justificación obligatoria por criterio (Fase 0)
}

/** Entidad `evaluation` (A5 Tabla 5, FR-016, BR-003) */
export interface Evaluation {
  readonly id: UUID;
  readonly assignment_id: UUID;
  readonly recommendation: EvaluationDecisionType;
  readonly comments: string;
  readonly total_score?: number; // Ej. 91.00 / 100 Puntos
  readonly rubric_scores?: RubricCriterionScore[];
  readonly submitted_at: ISODateTimeUTC;
}

/** Entidades `project_decision` y `status_history` (A5 Tabla 5, FR-017, FR-018) */
export interface StatusHistoryEntry {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly actor_id: UUID;
  readonly actor_name?: string;
  readonly from_status: ProjectStatus | null;
  readonly to_status: ProjectStatus;
  readonly justification: string; // Obligatoria en decisiones y transiciones críticas
  readonly created_at: ISODateTimeUTC;
  readonly evaluation_id: UUID | null;
}

/** Estructura para Subsanación de Observaciones y Redline Diff (RF-08, Fase 0) */
export interface ObservationSubsanationItem {
  readonly id: UUID;
  readonly section_name: string;
  readonly original_text_v1: string;
  corrected_text_v2: string;
  researcher_justification: string;
  evidence_document_id?: UUID | null;
  resolved: boolean;
}

// ============================================================================
// 7. PLAN DE TRABAJO, ACTIVIDADES Y ENTREGABLES (FR-020..024, OI-007)
// ============================================================================

export type DeliverableStatus = 'Pending' | 'Submitted' | 'Overdue' | 'Approved' | 'Cancelled';

/** Entidad `activity` (A5 Tabla 5, FR-020, FR-023, FR-024) */
export interface Activity {
  readonly id: UUID;
  readonly project_id: UUID;
  name: string;
  description: string;
  responsible_user_id: UUID;
  responsible_name?: string;
  /** Peso validado según regla aprobada en OI-007 (`numeric(7,4)`) */
  weight: number;
  /** Versión de la regla de ponderación utilizada (FR-020) */
  readonly weighting_rule_version: string;
  /** Porcentaje de avance de 0 a 100 (`numeric(5,2)`, FR-021) */
  progress: number;
  start_date: ISODate;
  due_date: ISODate;
  is_overdue: boolean; // FR-024
  deliverables?: Deliverable[];
}

/**
 * Entidad `deliverable` (A5 Tabla 5, FR-022, FR-024).
 * Regla FR-022: No puede marcarse como 'Submitted' sin al menos un documento de evidencia adjunto.
 */
export interface Deliverable {
  readonly id: UUID;
  readonly activity_id: UUID;
  readonly code?: string; // Ej. "H2.2"
  name: string;
  description?: string;
  due_date: ISODate;
  status: DeliverableStatus;
  evidence_document_ids: UUID[]; // Debe tener length >= 1 para permitir POST /deliverables/:id/submit
}

/** Entidad `progress_update` (A5 Tabla 5, FR-021) */
export interface ProgressUpdate {
  readonly id: UUID;
  readonly activity_id: UUID;
  readonly author_id: UUID;
  readonly percent: number; // CHECK: 0 <= percent <= 100
  readonly comment: string;
  readonly evidence_document_id?: UUID | null;
  readonly at: ISODateTimeUTC;
}

// ============================================================================
// 8. GESTIÓN DE DOCUMENTOS VERSIONADOS (FR-025..029, OI-010, BR-004)
// ============================================================================

/** Clasificación obligatoria de documentos según FR-025 */
export type ProjectDocumentType =
  | 'proposal'
  | 'technical_report'
  | 'evidence'
  | 'final_report'
  | 'agreement'
  | 'other';

/** Extensiones y tipos permitidos de hasta 25 MB según FR-025 */
export type AllowedFileExtension = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'png' | 'jpg';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (FR-025)

/**
 * Entidad `project_document` (A5 Tabla 5, FR-025, FR-029).
 * Prohibido eliminar documentos o versiones; solo pueden marcarse como obsoletos con motivo.
 */
export interface ProjectDocument {
  readonly id: UUID;
  readonly project_id: UUID;
  name: string;
  type: ProjectDocumentType;
  obsolete_reason: string | null; // Si no es null, el documento está marcado como "Obsoleto" (FR-029)
  versions: DocumentVersion[];
}

/** Entidad `document_version` (A5 Tabla 5, FR-026) */
export interface DocumentVersion {
  readonly id: UUID;
  readonly document_id: UUID;
  readonly version_no: number; // Entero positivo secuencial
  readonly sha256: SHA256Hash;
  readonly mime: string;
  readonly size_bytes: number; // CHECK: <= 26214400 (25 MB)
  readonly author_id: UUID;
  readonly author_name?: string;
  readonly change_note: string; // Nota de cambio obligatoria al versionar (FR-026)
  readonly created_at: ISODateTimeUTC;
}

// ============================================================================
// 9. PRODUCTOS DE INVESTIGACIÓN Y CIERRE (FR-030..032, FR-044, BR-006, BR-013)
// ============================================================================

/** Los 8 tipos de productos de investigación definidos en FR-030 */
export type ResearchProductType =
  | 'journal_article'
  | 'conference_paper'
  | 'book'
  | 'book_chapter'
  | 'thesis'
  | 'patent'
  | 'software'
  | 'other';

/** Estados editoriales del producto definidos en FR-030 */
export type ResearchProductStatus =
  | 'in_preparation'
  | 'submitted'
  | 'accepted'
  | 'published';

/**
 * Entidad `research_product` (A5 Tabla 5, FR-030..032, BR-013).
 * Regla BR-013: Solo los productos con `validated_at !== null` se cuentan en indicadores institucionales.
 */
export interface ResearchProduct {
  readonly id: UUID;
  readonly project_id: UUID;
  readonly project_code?: string;
  type: ResearchProductType;
  title: string;
  authors: string;
  product_date: ISODate;
  venue: string; // Revista, editorial o congreso
  doi_or_url: string | null;
  status: ResearchProductStatus;
  evidence_document_id?: UUID | null; // FR-031
  readonly validated_at: ISODateTimeUTC | null; // FR-032
  readonly validator_id: UUID | null;
}

/** Checklist formal de cierre de proyecto (FR-044, BR-006, UC-013) */
export interface ProjectClosureChecklist {
  readonly project_id: UUID;
  readonly final_report_uploaded: boolean;
  readonly all_mandatory_deliverables_resolved: boolean; // Enviados o cancelados formalmente por Coordinación
  readonly research_products_registered: boolean;
  readonly can_approve_closure: boolean; // true solo si BR-006 se satisface por completo
}

// ============================================================================
// 10. NOTIFICACIONES Y COLA TRANSACCIONAL (FR-033..036, A5 Tabla 5)
// ============================================================================

export type NotificationKind =
  | 'due_in_7_days'
  | 'due_in_1_day'
  | 'overdue_today'
  | 'status_changed'
  | 'reviewer_comment'
  | 'proposal_submitted'
  | 'closure_requested'
  | 'evaluation_overdue';

/** Entidad `notification` (A5 Tabla 5, FR-033..036) */
export interface AppNotification {
  readonly id: UUID;
  readonly user_id: UUID;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly message: string;
  readonly project_id?: UUID;
  readonly created_at: ISODateTimeUTC;
  read_at: ISODateTimeUTC | null;
  readonly dedupe_key: string; // Evita notificaciones duplicadas del mismo evento (FR-033)
}

// ============================================================================
// 11. ASISTENTE NORMATIVO IA (RAG) Y BASE DE CONOCIMIENTOS (FR-045, AIR-001..014)
// ============================================================================

export type RegulationStatus = 'active' | 'retired';

/** Entidades `regulation` y `regulation_version` (A5 Tabla 5, FR-045, AIR-004) */
export interface RegulationDocument {
  readonly id: UUID;
  readonly version_id: UUID;
  title: string;
  version: string;
  status: RegulationStatus;
  effective_date: ISODate;
  readonly indexed_at?: ISODateTimeUTC; // Disponible/retirado en <= 30 min (AIR-004)
}

/** Cita verificable de un pasaje normativo recuperado por RAG (AIR-002) */
export interface RegulationSourceCitation {
  readonly regulation_id: UUID;
  readonly document_title: string;
  readonly version: string;
  readonly section: string;
  readonly page: number | string;
  readonly excerpt?: string;
}

/**
 * Entidad `ai_interaction` (A5 Tabla 5, AIR-001..007, A4 Defecto AIR-007 Corregido).
 * PROHIBIDO mostrar porcentajes de certeza jurídica. Siempre incluye aviso no vinculante (AIR-005).
 */
export interface AIInteraction {
  readonly id: UUID;
  readonly user_id: UUID;
  readonly at: ISODateTimeUTC;
  /** Máximo 1,000 caracteres en español (AIR-001) */
  readonly allowed_question: string;
  readonly answer: string;
  readonly is_not_found_fallback: boolean; // true cuando no supera el umbral de relevancia (AIR-003)
  readonly is_out_of_scope_declined: boolean; // true cuando sale de la taxonomía aprobada (AIR-013)
  readonly source_refs: RegulationSourceCitation[];
  readonly advisory_disclaimer: string; // Leyenda obligatoria AIR-005
  rating: boolean | null; // true = Útil, false = No útil / Requiere asesoría (AIR-006)
  rating_comment?: string | null;
  readonly expires_at: ISODateTimeUTC; // Retención de 12 meses sujeta a política (AIR-007)
  readonly restricted_access: boolean;
}

/** Observación individual del Pre-chequeo de Completitud con IA (AI-2: AIR-008, AIR-009, UC-012) */
export interface AIPreCheckObservation {
  readonly section_affected: string;
  readonly issue_detected: string;
  readonly suggestion: string;
  readonly guideline_reference: string;
}

export interface AIPreCheckResult {
  readonly project_id: UUID;
  readonly generated_at: ISODateTimeUTC;
  readonly advisory_notice: string; // No bloquea el envío (AIR-009)
  readonly observations: AIPreCheckObservation[];
}

/** Resumen Ejecutivo de Propuesta para Evaluadores (AI-3: AIR-010, UC-005) */
export interface AIProposalSummary {
  readonly project_id: UUID;
  readonly version_no: number;
  /** Máximo 250 palabras sobre objetivos, metodología, productos y cronograma (AIR-010) */
  readonly summary_text: string;
  readonly word_count: number;
  readonly advisory_notice: string;
  readonly generated_at: ISODateTimeUTC;
}

// ============================================================================
// 12. REPORTES, AUDITORÍA INMUTABLE Y PARÁMETROS (FR-037..043, NFR-008, NFR-019)
// ============================================================================

export type ReportKind =
  | 'projects_by_status'     // FR-037 (PDF / XLSX)
  | 'research_products'      // FR-038 (Solo validados BR-013, PDF / XLSX)
  | 'progress_and_overdue'   // FR-039
  | 'project_record_sheet';  // FR-041 (PDF)

export type ReportExportFormat = 'pdf' | 'xlsx';

export interface ReportFilterParams {
  period_year?: number;
  start_date?: ISODate;
  end_date?: ISODate;
  department_id?: UUID;
  research_area_id?: UUID;
  researcher_id?: UUID;
  status?: ProjectStatus;
  project_id?: UUID;
}

/**
 * Entidad `audit_event` (A5 Tabla 5, FR-042, FR-043, NFR-008).
 * Append-only: ningún rol (incluido el Administrador) puede editar o eliminar entradas.
 * Retención mínima de 5 años con cadena hash de integridad.
 */
export interface AuditEvent {
  readonly id: UUID;
  readonly actor_id: UUID | null;
  readonly actor_name?: string;
  readonly actor_role?: SystemRoleCode;
  readonly at: ISODateTimeUTC;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: UUID;
  readonly metadata: Record<string, unknown>;
  readonly prev_hash: SHA256Hash;
  readonly event_hash: SHA256Hash;
}

/**
 * Parámetros configurables sin cambiar código fuente (NFR-019, `system_setting` en A5 Tabla 5).
 */
export type ConfigurableSettingKey =
  | 'notification.lead_days_warning'    // Por defecto: 7 días
  | 'notification.lead_days_critical'   // Por defecto: 1 día
  | 'ai.rag_relevance_threshold'        // Umbral de relevancia del recuperador RAG
  | 'ai.max_answer_length_chars';       // Longitud máxima de respuesta del asistente

export interface SystemSetting<T = number | string | boolean | Record<string, unknown>> {
  readonly key: ConfigurableSettingKey;
  value: T;
  readonly min_allowed?: number;
  readonly max_allowed?: number;
  readonly approved_by: UUID;
  readonly updated_at: ISODateTimeUTC;
  readonly version: number;
}

// ============================================================================
// 13. CONTRATOS GENÉRICOS DE RED Y ERRORES HTTP (/api/v1 - A5 Sección 6 y 10)
// ============================================================================

export interface PaginationQueryParams {
  page?: number;      // Por defecto: 1
  page_size?: number; // Por defecto: 25, Máximo permitido: 100
  search?: string;
  status?: string;
  period?: string;
}

export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly page: number;
  readonly page_size: number;
  readonly total_items: number;
  readonly total_pages: number;
}

export interface ApiFieldValidationError {
  readonly field: string;   // Nombre exacto del input afectado (FR-009, NFR-015)
  readonly message: string; // Corrección requerida en español
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'           // 401: Sesión vencida o no iniciada
  | 'FORBIDDEN'              // 403: Rol insuficiente o proyecto confidencial
  | 'NOT_FOUND'              // 404: Recurso no encontrado (o enmascaramiento de confidencial)
  | 'CONFLICT'               // 409: Correo duplicado (FR-003) o row_version obsoleto
  | 'PAYLOAD_TOO_LARGE'      // 413: Archivo > 25 MB (FR-025)
  | 'UNSUPPORTED_MEDIA_TYPE' // 415: Extensión no permitida
  | 'UNPROCESSABLE_ENTITY'   // 422: Campos obligatorios faltantes, fechas inválidas o cuota excedida
  | 'SERVICE_UNAVAILABLE';   // 503: SSO, BD, Almacenamiento o LLM temporalmente fuera de servicio

/** Contrato de error estándar devuelto por el servidor Go (A5 Sección 6) */
export interface ApiErrorResponse {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly fields: ApiFieldValidationError[];
  };
  readonly request_id: string;
}