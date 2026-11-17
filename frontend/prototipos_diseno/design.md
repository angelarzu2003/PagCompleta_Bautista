Rol: Actúa como un Principal Product Designer & Lead Design Systems Architect. Tu especialidad es el diseño de sistemas complejos (SaaS B2B/G2B e institucionales), accesibilidad certificada WCAG 2.1 AA/AAA y flujos de trabajo basados en evidencia técnica y trazabilidad criptográfica.
Objetivo: Generar la documentación técnica, la arquitectura de componentes y las estructuras visuales en alta fidelidad (Web Desktop 1440px y Mobile-First 375px) para construir desde cero en Figma la "Plataforma Universitaria de Gestión de Proyectos de Investigación (URPMP)". El sistema debe proyectar Autoridad Académica, Transparencia Criptográfica y Eficiencia Administrativa, eliminando el uso de hojas de cálculo dispersas y centralizando desde la postulación hasta la promulgación rectoral.
1. FUNDAMENTOS DEL SISTEMA DE DISEÑO (ATOMIC DESIGN, TOKENS & 8PT GRID)
A. Tipografía Fluida y Escala Visual (Fluid Typography)


Primary Typeface (UI y Lectura): 'Plus Jakarta Sans' aplicando una escala tipográfica matemática Minor Third (1.200):


Display / Titles (font-title-sm a lg): Pesos SemiBold (600) y Bold (700), letter-spacing -0.02em.

Body (font-body-sm, font-body-md): Medium (500) para legibilidad de interfaz y Regular (400) con interlineado relajado obligatorio (150% / leading-relaxed) para bloques extensos de lectura.

Technical & Financial Typeface: 'JetBrains Mono' (Medium 500, tabular-nums). Uso exclusivo y obligatorio en hashes SHA-256, códigos CVD, OIDs, bloques de ledger, códigos de expediente y montos financieros para garantizar una alineación tabular de decimales perfecta.

Iconografía: Material Symbols Outlined o Lucide Icons con trazo consistente a 18px - 20px.

Regla Estricta WCAG: Ningún texto en todo el sistema (incluyendo etiquetas, badges y pies legales) bajará de los 12px.
B. Paleta de Colores y Capas de Elevación (Semantic Tokens)


Brand Essence:


Primary (Deep Navy): #00142f (Estructura institucional, Sidebar activo, textos High-Emphasis, burbujas de usuario).

Action / Secondary (Vibrant Blue): #0051d5 (Interactividad, reservado para el único botón CTA primario por vista, enlaces activos y Focus Rings accesibles).

Neutral Scale & Elevation (Slate/Zinc):


Bg-Base: #f8f9ff (Lienzo general de la aplicación para descanso visual).

Surface-Sunken: #f1f5f9 (Fondos de inputs, cabeceras de tablas, contenedores secundarios y footer).

Surface-Default: #ffffff (Tarjetas principales, modales, drawers).

Surface-Elevated / Highest: #e2e8f0 (Estados hover/focus de contenedores y separadores activos).

Border-Subtle: #e2e8f0 (1px solid para delimitar tarjetas sin saturar).

Semantic Feedback (Contraste Accesible Certificado):


Success (Validado / Cumplimiento / Quórum 3/3): Fondo #ecfdf5 / Texto #065f46 / Icono #059669 (Contraste 7:1).

Warning (Plazo 7 días / Subsanación / Similitud Semántica): Fondo #fffbeb / Texto #92400e / Borde #fde68a (Contraste 4.5:1).

Danger / Error (Plazo 1 día / Rechazo / Inhibición Ética / Falta Evidencia): Fondo #fef2f2 / Contenedor icono #fee2e2 / Texto #991b1b / Acción destructiva #dc2626 (Contraste 7:1).
C. Sistema Espacial y Layout Anti-Empalme (8pt Grid)


Grid System: Base estricta de 8px. Radios de borde: 8px (sm-component: inputs, botones), 12px (large-card: tarjetas, modales) y 9999px (rounded-pill: badges de estado y roles).

Layout Desktop (1440px): Sidebar izquierdo fijo (280px) + Contenedor de contenido centrado con Max-Width: 1160px. Paddings de sección: 40px. Paddings internos de tarjetas (Cards): 24px a 32px (prohibido usar paddings menores a 16px). Separación (gap) en Grids: 24px a 32px.

Layout Mobile-First (375px - NFR-017): Sidebar oculto por defecto y controlado por botón de Menú de Hamburguesa en el Header (Off-canvas Drawer). Padding lateral: 16px, gap vertical: 16px. Reemplazo obligatorio de tablas complejas por tarjetas apiladas (Stacked Responsive Cards) sin scroll horizontal.
2. REGLAS DE UX, LÓGICA DE COMPONENTES Y TRAZABILIDAD DE REQUERIMIENTOS


Divulgación Progresiva (<TechDetails>): Todos los metadatos técnicos complejos (hashes SHA-256, árboles PKI, certificados X.509, sellos TSA, OIDs y bloques de ledger) deben ocultarse dentro de un componente Accordion o Disclosure titulado "Trazabilidad de Seguridad e Integridad" colapsado por defecto, mostrando en primer plano únicamente el sello semántico de validez.

Arquitectura de CTA Único: Solo puede existir UN botón con estilo Solid Blue (#0051d5) por vista. Todas las acciones secundarias (Guardar Borrador, Descargar PDF, Exportar, Filtrar) deben diseñarse como Outline o Ghost.

Límite de Densidad Cognitiva: Máximo 4 tarjetas de KPI por fila en Desktop (1 columna en móvil) y máximo 5 datos visibles por tarjeta antes de requerir un desplegable.

Estados de Carga y Vacíos (Empty States): Diseñar componentes de Skeleton Loader para tablas/dashboards y micro-ilustraciones minimalistas institucionales cuando una bandeja no tenga registros.

IA Human-in-the-loop (AIR-001 a AIR-006): Queda estrictamente prohibido mostrar porcentajes de certeza (ej. "98% de certeza jurídica") o calificar las respuestas como "Dictamen". Cada burbuja del bot debe llevar la etiqueta AI-Assistant (Orientación no vinculante), estructurar su respuesta en Veredicto orientativo + Condiciones + Citas reglamentarias exactas, e incluir al pie los botones "Útil" y "Solicitar Asesoría Humana / Legal".

Seguridad, Privacidad y Reglas de Negocio (RF-01, NFR-009, BR-011, BR-014):


Cero Contraseñas Locales (FR-002, FR-004, FR-006): Autenticación delegada exclusivamente a SSO (OIDC/SAML); prohibido incluir inputs o gestión de contraseñas en cualquier vista.

Privacidad Ciudadana (NFR-009): Checkboxes éticos y de privacidad desmarcados por defecto en modales/formularios, y enmascaramiento obligatorio del DNI en vistas públicas (***.***.342).

Revisión Doble Ciego (BR-011, BR-014): Anonimización total del autor en la vista del evaluador y flujo obligatorio de inhibición por conflicto de interés.
3. DATOS MAESTROS (MOCK DATA) PARA COHERENCIA VISUAL Y MATEMÁTICA
Aplica exactamente estos datos en toda la interfaz para mantener trazabilidad absoluta:


Institución: Universidad Regional Politécnica y de Posgrado (URPMP).

Proyecto Eje: "Despliegue de Red Telemétrica de Sensores IoT de Bajo Costo para Monitoreo Bioclimático en Cuencas Altoandinas".

Identificadores Oficiales (JetBrains Mono): Código Definitivo: PID-2023-CRH-019 | Expediente Ciego: #PROP-2025-084-ANON | CVD: URP-9482-TX-2024 | Resolución: R.R. Nº 1042-2024-R-URPMP | Ledger: Bloque #194,821 | Calificación: 91.00 / 100 Puntos (Excelencia Académica A+).

Presupuesto Oficial (Math-Check en JetBrains Mono): Total Adjudicado: S/. 157,500.00 PEN ($42,000.00 USD a T.C. 3.75):


Anticipo Fase I (40%): S/. 63,000.00 PEN ($16,800.00 USD).

Hito Intermedio Fase II (40%): S/. 63,000.00 PEN ($16,800.00 USD).

Hito Final Fase III (20%): S/. 31,500.00 PEN ($8,400.00 USD).

Actores por Rol: Investigador Principal: Dr. Roberto Mendoza Vargas (DNI privado: 41.890.342 / DNI público: ***.***.342) | Presidenta Comité de Ética (CIE): Dra. Carmen Valdivia Prado | Coordinación: Dra. Elena Morales y Dra. Elena Vargas | Secretario General: Dr. Hugo Santillana Pinedo | Rector: Dr. Aurelio Benavides Castro | Evaluador Anónimo: Revisor Par #REV-7734.
4. ARQUITECTURA DE LAS 14 INTERFACES + APPSHELL (WEB 1440PX & MOBILE 375PX)
V00: <AppShell> (Estructura Maestra y Navegación)


Desktop (1440px): Sidebar izquierdo fijo (280px) en #00142f, Header superior con buscador global, Selector de Rol Activo (RF-01) para conmutar vistas entre los 5 roles (Investigador, Revisor, Comité, Coordinación, Admin), campana de notificaciones con badge numérico reactivo y perfil de usuario.

Mobile (375px): Header compacto con botón de Menú de Hamburguesa que abre el Sidebar como un Drawer lateral accesible. Footer institucional con textos a 12px y enlaces legales (Mesa de Ayuda, Normativas Académicas, Términos de Servicio, Aviso Legal & Privacidad).
V01: Auth & Consent - Login Institucional SSO (SCREEN_24 | RF-01, NFR-009)


UX: Tarjeta central limpia con selector de proveedor SSO (Microsoft Entra ID, Google Workspace, SAML 2.0) y estados (Idle, Loading con spinner, Error inline). Estrictamente sin campos de contraseña.

Modal / Bottom Drawer de Privacidad: Cerrado por defecto. Al clicar en "Iniciar Sesión SSO", emerge un modal bloqueante (Bottom Drawer en móvil) con el Consentimiento Informado y la Declaración Jurada Ética. Incluye 2 checkboxes desmarcados por defecto; el botón primario "Aceptar y Continuar" permanece en estado Disabled hasta marcar ambos.
V02: Dashboard del Investigador - Health Monitor (SCREEN_20 | RF-03, FR-033, FR-034, FR-040)


Desktop: Fila superior de máximo 4 Cards de KPI con sombra suave (Elevation 1: Proyectos Activos, Presupuesto Ejecutado S/. 157,500.00 PEN, Avance de Entregables, Productos Validados) y lista de "Acciones Pendientes" priorizadas por fecha.

Mobile & Notificaciones: KPIs apilados en 1 columna vertical. El Centro de Notificaciones permanece cerrado por defecto y se abre como Popover en Desktop o Full-Screen / Bottom Drawer en Mobile, destacando alertas críticas a 1 día (Danger), 7 días (Warning) y dictámenes de comité.
V03: Registro de Propuesta de Proyecto - Smart Wizard (SCREEN_22 | RF-02, FR-007, FR-008, FR-010)


Componente Principal: <Stepper> desacoplado (lateral/horizontal en Desktop, compacto en Header Mobile) para los pasos: 1. Datos Generales, 2. Equipo, 3. Objetivos y Metodología, 4. Calendario y Presupuesto, 5. Declaraciones y Envío.

Validaciones e Interacciones:


Alerta IA de Similitud (FR-010): Inline Alert tipo Warning sobre el título indicando "Advertencia: 78% de similitud semántica detectada con un proyecto histórico".

Reglas de Campos: Textarea de resumen con contador reactivo (máximo 500 palabras, pasa a rojo al exceder) y constructor dinámico de Objetivos Específicos (mínimo 3 obligatorios OE1, OE2, OE3 con controles para reordenar y bloqueo de eliminación si quedan 3).

Cierre: Checkboxes de declaración ética desmarcados por defecto, botón secundario Outline "Guardar Borrador" y único CTA primario "Enviar a Revisión".
V04: Plan de Trabajo y Seguimiento Físico-Financiero (SCREEN_18 | RF-04, FR-021, FR-022, FR-025)


Coherencia Financiera: Resumen superior con las 3 fases exactas (S/. 63,000.00 + S/. 63,000.00 + S/. 31,500.00 = S/. 157,500.00 PEN) en JetBrains Mono.

Tabla Responsiva y Drawer de Evidencia: <DataTable> de entregables en Desktop que se transforma en Stacked Responsive Cards en Mobile. Al seleccionar el entregable H2.2, el panel/drawer muestra un Slider sincronizado con input numérico (0% - 100%) y un Dropzone (Máx. 25 MB en PDF, ZIP, DOCX). Si no hay archivo adjunto, muestra alerta Danger ("Validación Normativa Incompleta") y mantiene el CTA "Enviar Entregable a Dictamen" en estado Disabled; al cargar el PDF, cambia a alerta Success y habilita el botón.
V05: Registro y Validación de Productos Científicos (FR-030, FR-031, FR-032)


Layout: Grid de 2 columnas en Desktop (gap: 32px), 1 columna apilada en Mobile.

Columna Izquierda (Bandeja de Coordinación y KPIs): Tarjetas métricas ("Productos Validados: 118", "Pendientes: 3") y lista de tarjetas de productos enviados con botones secundarios Outline para "Aprobar" o "Rechazar".

Columna Derecha (Formulario del Investigador): Selectores para Tipo (Artículo Q1/Q2, Patente, Tesis, Libro), inputs para Título, Autores, Fecha, DOI/URL y un área punteada (Dropzone) para subir el PDF de evidencia.
V06: Evaluación por Pares Ciegos y Dictamen Ético (SCREEN_12 | RF-07, FR-017, FR-018, BR-011, BR-014)


Visor Anonimizado (BR-014): Columna izquierda con el documento identificado solo como #PROP-2025-084-ANON, sin datos del autor y con marca de agua diagonal "Copia Ciega / No Distribuir".

Rúbrica Cuantitativa/Cualitativa (FR-017): Columna derecha con criterios de evaluación (suma hasta 100 puntos en JetBrains Mono) donde cada puntaje exige obligatoriamente un comentario de justificación cualitativa.

Flujos Modales Críticos:


Botón secundario destructivo "Declarar Conflicto de Interés" que abre el Modal de Inhibición (BR-011) para reasignar la propuesta si el revisor reconoce al autor.

Único CTA primario "Emitir Dictamen Vinculante" que abre un <ConfirmDialog> advirtiendo que la firma criptográfica es irrevocable.
V07: Subsanación de Observaciones - Visual Diff Consolidado (SCREEN_8 + SCREEN_10 | RF-08)


Consolidación Canónica: Fusión en una sola pantalla del comparador de versiones, justificación por ítem y Drawer de anexos.

Componente Principal (Redline Difference Engine): Comparador visual holgado entre la Versión 1.0 (texto original tachado en fondo rojo suave) y la Versión 1.1 Corregida (texto nuevo resaltado en fondo verde suave). Incluye sugerencias de redacción del asistente con badge "Orientación no vinculante" (sin porcentajes).

Lógica de Desbloqueo: Checklist de observaciones (4/4 resueltas) y checkbox de declaración jurada desmarcado por defecto. El CTA primario de firma y reenvío permanece Disabled (con microcopia explicativa debajo) hasta completar las 4 subsanaciones y marcar el juramento, disparando un <Toast> de confirmación al enviar.
V08: Reevaluación por Comité y Dictamen Colegiado (SCREEN_6 | RF-07)


Control de Quórum: Panel de votación del Comité de Ética presidido por la Dra. Carmen Valdivia Prado. El único CTA primario para emitir la resolución colegiada permanece bloqueado hasta verificar la ratificación de quórum 3/3.

Divulgación Progresiva: El árbol PKI, los hashes SHA-256 de cada voto y los bloques del ledger se agrupan ocultos dentro del acordeón "Trazabilidad de Seguridad e Integridad".
V09: Dashboard Institucional de Autoridades, Coordinadores y Reportes (SCREEN_16 | RF-05, FR-040)


Métricas y Densidad Controlada: Fila superior con máximo 4 tarjetas KPI. Tarjetas de comités limitadas a máximo 5 datos visibles, ocultando el detalle secundario en un acordeón.

Tabla Maestra y Exportación: Tabla de proyectos institucionales con filtros por periodo/departamento/estado, paginador formal inferior, menú desplegable secundario para Exportar Reportes (PDF / XLSX) y botón de acción rápida para enviar requerimiento preventivo al investigador.
V10: Asistente Normativo IA - RAG Chat (SCREEN_14 | RF-06, AIR-001, AIR-002, AIR-005, AIR-006)


Interfaz Dividida: Columna de conversación (60% ancho en Desktop) + Sidebar derecho de "Fuentes y Reglamentos Activos" (40% ancho en Desktop, Drawer en Mobile) con filtros de corpus.

Restricción Legal y Estructura del Bot: Sin porcentajes de certeza. Cada respuesta lleva el badge AI-Assistant (Orientación no vinculante) y se estructura en: 1) Veredicto orientativo breve, 2) Condiciones aplicables, 3) Citas exactas con acordeón <TechDetails> colapsado, y 4) Pie obligatorio: "Esta información es una guía orientativa basada en el Reglamento General de Investigación Art. [X]. No constituye una resolución legal." acompañado de los botones "Útil" y "Solicitar Asesoría Humana".
V11: Gestión de Base de Conocimientos / Corpus IA RAG (FR-045, AIR-004)


Sección Superior (Ingesta Documental): Dropzone amplio con fondo azul sutil y borde punteado para "Cargar nueva directiva o reglamento oficial (PDF) al modelo RAG".

Sección Inferior (Inventario del Corpus): Tabla/tarjetas de "Reglamentos Activos en la Base de Conocimientos" con Nombre del documento, Versión, Fecha de entrada en vigor, Estado de indexación vectorial y un botón secundario destructivo (Outline rojo) para "Retirar de la base de conocimientos".
V12: Emisión de Resolución Rectoral y PDF Descargable (SCREEN_4 | RF-09)


Lectura Administrativa Limpia: Visor formal de la resolución R.R. Nº 1042-2024-R-URPMP que adjudica el proyecto PID-2023-CRH-019 con firma criptográfica dual del Rector (Dr. Aurelio Benavides Castro) y del Secretario General (Dr. Hugo Santillana Pinedo).

Jerarquía de Botones y Criptografía: Un único CTA primario ("Promulgar / Validar en Ledger"), pasando "Descargar Resolución PDF" y "Descargar Diploma" a botones secundarios Outline. Los metadatos SHA-256, OID y sellos de tiempo TSA van ocultos dentro del acordeón "Trazabilidad de Seguridad e Integridad".
V13: Portal Público de Verificación QR / CVD - Trust Center (SCREEN_2 | RF-10, NFR-009)


UX Mobile-First (375px): Diseñado prioritariamente para visualización inmediata tras escanear un código QR desde un smartphone, sin scroll horizontal.

Privacidad y Sello de Confianza: Sello visual prominente de documento auténtico (CVD: URP-9482-TX-2024), título del proyecto y nombre del investigador (Dr. Roberto Mendoza Vargas) con enmascaramiento obligatorio de su documento de identidad: DNI: ***.***.342. Los certificados X.509 y el bloque del ledger (#194,821) permanecen colapsados en el acordeón de trazabilidad.
V14: Administración de Usuarios SSO, Catálogos y Audit Log (FR-002, FR-004, FR-006, FR-042, FR-043)


Sub-vista A (Directorio de Usuarios SSO): Tabla responsiva con Avatar/Nombre, Correo Institucional, Departamento Académico, Badges de Roles múltiples (Investigador, Revisor, Comité, Coordinador, Admin), botón "Editar Roles" (abre modal con checkboxes) y Switch/Toggle para "Activar/Desactivar" cuenta. Estrictamente sin columnas ni acciones de contraseñas.

Sub-vista B (Catálogos Institucionales): Gestión de Departamentos Académicos, Líneas de Investigación y Tipos de Proyecto.

Sub-vista C (Bitácora de Auditoría Inmutable - Audit Log): Tabla de seguridad de solo lectura con tipografía JetBrains Mono que muestra Fecha/Hora exacta, Usuario, Rol, Acción realizada, Dirección IP y Hash de integridad.
5. ESPECIFICACIONES DE ENTREGA (OUTPUT EXPECTED)
Para el <AppShell> y cada una de las 14 vistas (V01 a V14), genera de forma estructurada:


Jerarquía de Información: Lista priorizada del flujo visual (qué ve el usuario en primer, segundo y tercer plano, y qué queda oculto en divulgación progresiva).

Propiedades de Auto Layout (Figma Specs): Dirección (Vertical / Horizontal / Wrap), Padding exacto, Gap entre elementos, distribución y reglas de Resizing (Fill container vs Hug contents) respetando el 8pt Grid.

Comportamiento Responsivo (1440px -> 375px): Explicación técnica de cómo se transforma cada contenedor de Desktop a Mobile (ej. Grid 4 columns -> Flex column, Sidebar 280px -> Off-canvas Drawer, DataTable -> Stacked Responsive Cards).

Matriz de Estados Interactivos: Definición visual de botones, inputs, modales y tablas en sus estados: Idle, Hover, Active, Focus (WCAG Ring), Disabled, Error Inline, Empty State y Loading / Skeleton.