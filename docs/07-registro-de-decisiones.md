---
estado: vigente
propietario: Equipo RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Desarrollo y Operación
---

# Registro de decisiones arquitectónicas y de producto

Este registro conserva decisiones que afectan el rumbo del producto. Una decisión no se elimina: si cambia, se agrega una nueva entrada que indique cuál reemplaza.

## ADR-001 · Monolito modular

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** RFC Enterprise crecerá a múltiples procesos, pero está en una etapa inicial donde varios despliegues y repositorios independientes añadirían complejidad innecesaria.

**Decisión.** Mantener una aplicación Next.js con límites explícitos entre `core`, `shared`, `modules` y `app`.

**Consecuencia.** La entrega es simple de desplegar, pero los límites de importación deberán revisarse en cada cambio. Si un dominio requiere escalar de forma autónoma en el futuro, se tomará una nueva decisión documentada.

---

## ADR-002 · Usuario no es trabajador

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** La cuenta que ingresa al ERP y el expediente de una persona empleada tienen ciclos de vida distintos.

**Decisión.** Modelar usuarios de plataforma por separado de trabajadores del futuro módulo de Talento Humano.

**Consecuencia.** Una persona empleada podrá tener o no una cuenta de usuario, y la identidad no quedará acoplada a contratos, nómina o datos laborales.

---

## ADR-003 · Permisos por código, no por banderas de interfaz

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** Banderas como `isAdmin` o `isAlmacenista` no escalan para varios módulos y responsabilidades.

**Decisión.** Definir roles compuestos por permisos con códigos estables, por ejemplo `core.users.manage` e `inventory.movements.create`.

**Consecuencia.** La versión actual sólo define la base de Core; antes de flujos reales habrá que completar permisos por módulo y aplicarlos del lado servidor.

---

## ADR-004 · Datos semilla y persistencia híbrida

**Fecha:** 2026-09-15 (Actualizada 2026-09-16)  
**Estado:** Aceptada

**Contexto.** Se requería operar con el catálogo completo de 1,191 productos reales de RFC garantizando fluidez tanto en entornos locales como conectados a Supabase.

**Decisión.** Normalizar el catálogo completo como base reactiva con persistencia local (`localStorage`) sincronizable con el backend de Supabase.

---

## ADR-005 · Autenticación Supabase Auth

**Fecha:** 2026-09-16
**Estado:** Aceptada

**Contexto.** Se requería un sistema de autenticación seguro, validado en servidor, con tokens JWT y recuperación de credenciales.

**Decisión.** Adoptar Supabase Auth gestionado con `@supabase/ssr` e identidades verificadas por correo.

---

## ADR-007 · Confirmación y Preservación Obligatoria de Documentación

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Para evitar pérdida de contexto o desviaciones de alcance, todo acuerdo, modelo de datos y diseño funcional debe ser registrado inmediatamente en la carpeta `docs/`.

**Decisión.** Exigir la confirmación explícita de archivos guardados y un resumen de acuerdos al usuario en cada iteración del asistente AI.

---

## ADR-008 · Rediseño del Dashboard Principal y Extensiones Operativas de Inventario

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Se necesitaba elevar la visibilidad del estado financiero de los proyectos desde la pantalla principal (`/dashboard`) y proveer formatos de remisión imprimibles, requisiciones de obra, custodia de herramientas y devoluciones de sobrantes.

**Decisión.** 
1. Rediseñar `/dashboard` como un **Panel Ejecutivo de Obras y Materiales**, mostrando métricas consolidadas, semáforos de avance presupuestal por proyecto y accesos a operaciones de almacén.
2. Implementar vales de salida imprimibles (remisión con espacio de firmas para archivo físico o PDF).
3. Añadir la gestión de requisiciones de frente de obra, custodia de herramientas entregadas a trabajadores y devoluciones de material sobrante a bodega.

---

## ADR-009 · Módulo y Ruta Dedicada de Proyectos / Obras (/projects)

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** El usuario requiere una vista específica y profunda para inspeccionar la Ficha de Obra completa: materiales e insumos gastados por proyecto, herramientas en custodia y requisiciones de frente de trabajo.

**Decisión.** Crear la ruta dedicada `/projects` con navegación en la barra lateral del portal y la vista `ProjectsWorkspace` para la inspección detallada de obras, presupuestos y kardex de insumos imputados.

---

## ADR-010 · Niveles de Empleado (RBAC), Visibilidad de Dashboard y Separación de Rutas

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Se detectaron dos necesidades clave:
1. En la barra de navegación lateral se seleccionaban simultáneamente "Inventarios" y "Movimientos" porque ambos apuntaban a `/inventory` y compartían el mismo icono.
2. Es indispensable formalizar la jerarquía de roles de empleados (RBAC) y la matriz de qué información puede ver cada nivel en el Dashboard y la plataforma.

**Decisión.**
1. **Separación de rutas de navegación:**
   - `/dashboard`: Panel Ejecutivo, Inteligencia de Costos y Saludo Contextual (Icono `grid`).
   - `/projects`: Ficha de Obras, Centros de Costo y Materiales Gastados (Icono `building`).
   - `/inventory`: Catálogo de 1,191 insumos, niveles de stock y ajuste de mínimos (Icono `boxes`).
   - `/movements`: Kardex general de entradas, salidas por obra, devoluciones y remisiones (Icono `arrows`).
2. **Matriz de 5 Niveles de Empleado y Visibilidad:**
   - **Nivel 1: Administrador / Gerencia General**: Acceso total, finanzas en COP, presupuestos globales, ranking de materiales costosos, auditoría y parametrización.
   - **Nivel 2: Ingeniero Residente / Director de Obra**: Fichas de sus obras a cargo, avance presupuestal de su obra, aprobación de requisiciones y custodia de herramientas. No ve finanzas corporativas globales.
   - **Nivel 3: Jefe de Almacén / Bodeguero**: Prioridad en alertas de stock crítico bajo mínimo, requisiciones pendientes, emisión de vales/remisiones y control de préstamos de herramientas.
   - **Nivel 4: Maestro de Obra / Cuadrilla**: Solicitudes rápidas de materiales desde frente de obra, consulta de herramientas recibidas y registro de sobrantes.
   - **Nivel 5: Auditor / Contador de Costos**: Kardex valorizado, remisiones históricas, auditoría de consumos y balances financieros sin modificación física de inventario.
3. **Paneles de Inteligencia en Dashboard:** Top 5 materiales más costosos despachados, gráfico comparativo de gasto por obra, tabla de stock crítico bajo mínimo, saludo contextual y sistema de notificaciones toast.

---

## ADR-011 · Calendario operativo de proyectos

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Decisión.** Cada obra registra fecha de inicio, fecha estimada de finalización y estado (`pending`, `active`, `on_hold`, `completed`). La base de datos impide fechas finales anteriores al inicio y protege los registros con RLS para miembros autorizados de la empresa.

La edición inicia con un selector visual de obras y abre el formulario únicamente para la obra elegida. Los ajustes de presupuesto se mantienen como una acción financiera separada para auditar su historial.

---

## ADR-012 · Operaciones auditables de inventario

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Decisión.** Inventarios centraliza ubicaciones detalladas, recepciones de compra, conteos físicos con aprobación, puntos de reorden, movimientos valorizados, ajustes presupuestales y registros de auditoría en Supabase. Una salida exige una obra activa; los datos se protegen con RLS por empresa y roles de inventario.

**Consecuencia.** El script `20260916_inventory_operations.sql` debe aplicarse en Supabase antes de habilitar la sincronización de escritura en producción.

**Extensión.** La creación de un artículo incluye su cantidad y costo iniciales y produce un movimiento de entrada, evitando existencias sin trazabilidad.

---

## ADR-013 · Portada institucional orientada a proyectos

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Contexto.** El sitio institucional requería explicar con mayor claridad la oferta de RFC y reemplazar los teléfonos visibles por un mecanismo de contacto más apropiado para solicitudes de proyecto.

**Decisión.** Ampliar la portada con capacidades verificables de arquitectura e ingeniería, estructuras metálicas, mantenimiento y paisajismo; un enfoque de trabajo; recursos visuales de Caucasia y operación petrolera industrial; y un formulario de solicitud sin publicar teléfonos.

**Consecuencia.** El formulario conserva sus campos, pero su botón de envío permanece inactivo hasta definir un correo corporativo receptor o una integración segura con Supabase. No se almacenarán datos de contacto en el navegador.

---

## ADR-014 · Directorio laboral y permisos por empleado

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** Administrar a cada empleado mediante una ficha laboral separada de su identidad de Supabase Auth. La ficha admite activación, uno o más roles y excepciones de permiso explícitas (`grant` o `revoke`), registradas bajo RLS y auditoría.

**Consecuencia.** Un administrador puede preparar el acceso de un empleado antes de que este tenga cuenta. Para enviar la invitación y enlazar la ficha con Auth se requiere configurar en servidor el secreto administrativo de Supabase; nunca se expone en el navegador.

---

## ADR-015 · Identidad visual oficial en documentos operativos

**Fecha:** 2026-09-17  
**Estado:** Aceptada

**Decisión.** Los vales de salida, remisiones, informes imprimibles y futuros comprobantes utilizan el archivo oficial `public/rfc-logo.svg` en el membrete. El formato no publica números telefónicos de contacto.

**Consecuencia.** Cualquier nuevo generador de PDF o impresión debe reutilizar este activo y no recrear el logo con texto o una imagen alternativa.

---

## ADR-016 · Acceso institucional al portal de empleados

**Fecha:** 2026-09-17  
**Estado:** Aceptada

**Decisión.** La cabecera de la portada pública incluye el enlace visible “Portal de empleados”, dirigido a `/login`; permanece disponible en móvil y escritorio sin competir con la llamada de contacto comercial.

---

## ADR-017 · Identidad de sesión y canal de solicitudes

**Fecha:** 2026-09-17  
**Estado:** Aceptada

**Decisión.** La cabecera del portal consulta el perfil de la sesión autenticada y muestra su `display_name` y rol, sin usar un nombre fijo. El formulario institucional prepara un correo con los datos de la solicitud para `rfcsas094@gmail.com`, sin publicar teléfonos ni persistir los datos en el navegador.

**Pendiente acordado.** Implementar en una fase posterior el envío directo mediante Edge Function de Supabase y un proveedor de correo transaccional. Las claves del proveedor residirán solo en secretos de Supabase; el formulario público deberá usar validación, límite de solicitudes y protección antispam.

---

## ADR-018 · Cierre de sesión y cambio de usuario

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** La cabecera del portal incorpora una acción visible para cerrar la sesión de Supabase y volver a `/login`. Esto permite que otra persona use el mismo equipo sin reutilizar la sesión anterior.

---

## ADR-019 · Catálogos buscables durante el alta de inventario

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** El formulario de nuevo artículo inicia sin categoría, marca, unidad ni ubicación preseleccionadas y usa sugerencias filtrables para esos valores. Categoría, unidad y ubicación son obligatorias; la marca conserva “Sin marca” como opción explícita. Si el valor no existe, el usuario puede crearlo y seleccionarlo en el mismo campo, sin abrir otra página ni perder lo ya diligenciado.

**Consecuencia.** La ubicación seleccionada se guarda directamente en el artículo. Los catálogos muestran primero las opciones existentes ordenadas alfabéticamente y evitan entradas repetidas por mayúsculas o acentos.

---

## ADR-020 · Unidades de compra y consumo

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** Los artículos nuevos registran una unidad de consumo, una presentación de compra y un factor de conversión. La cantidad y el costo capturados corresponden a la presentación recibida; existencias y costo unitario se calculan en la unidad de consumo.

**Ejemplo.** Tres cajas de 100 tornillos se registran como 300 unidades disponibles; cada despacho puede descontar una o varias unidades.

---

## ADR-021 · Manual de usuario operativo

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** RFC Enterprise cuenta con un manual paso a paso para los roles operativos y administrativos. Cubre acceso, catálogo, unidades de compra y consumo, movimientos, ajustes físicos, conteos, proyectos, informes, empleados y permisos.

**Consecuencia.** El manual debe actualizarse cuando se aprueben nuevos módulos o cambien los procesos de operación.

---

## ADR-022 · Informes operativos interactivos

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** Informes consolida inventario, Kardex, stock crítico y ejecución por obra con filtros de categoría y obra, indicadores, gráficos SVG responsivos, CSV e impresión con identidad RFC. Los datos se leen de la operación local actual para reflejar los movimientos del portal.

---

## ADR-023 · Flujo de requisiciones y sincronización del directorio

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** Los maestros y residentes generan requisiciones dentro de la obra; el almacén las recibe como pendientes, confirma las cantidades disponibles y emite el despacho y su Kardex. Los perfiles existentes que ya poseen empresa y rol se incorporan al directorio de empleados mediante una sincronización idempotente, sin alterar su rol ni duplicar registros.

**Consecuencia.** El indicador de requisiciones pendientes solo aumenta cuando una solicitud ha sido enviada desde una obra. El directorio representa tanto empleados creados desde administración como usuarios ya habilitados para el portal.

---

## ADR-024 · Recuperación y cambio de contraseña

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** El inicio de sesión incluye recuperación por correo con enlace de un solo uso y el portal ofrece cambio voluntario con confirmación de la clave actual. Las operaciones se ejecutan mediante Supabase Auth y las credenciales no se persisten en tablas de negocio.

**Consecuencia.** Debe configurarse la URL de retorno de producción en Supabase Auth y un servicio SMTP de producción para una entrega confiable de los correos.

---

## ADR-025 · Tipificación y código automático de proyectos

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** Al dar de alta un proyecto, el usuario selecciona `obra`, `mantenimiento` u `otro`. La aplicación calcula y muestra, sin permitir su edición, un código con el prefijo del tipo y un consecutivo de dos dígitos por fecha de inicio: `OBRA-AAAAMMDD-##`, `MANT-AAAAMMDD-##` u `OTRO-AAAAMMDD-##`.

**Consecuencia.** El tipo y el código quedan asociados al proyecto en la persistencia local actual. Los datos que no pueden inferirse de forma fiable —nombre, cliente, ubicación, presupuesto y fecha estimada— continúan siendo diligenciados por el usuario.

---

## ADR-026 · Formato de captura para valores monetarios COP

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** Los campos de presupuestos, costos y ajustes monetarios conservan internamente una cadena numérica para sus cálculos. Al perder foco, muestran el valor como pesos colombianos sin decimales —por ejemplo, `$500.000`— y al recibir foco se presentan nuevamente para edición numérica.

**Consecuencia.** La aplicación reduce errores de lectura en formularios sin modificar los valores almacenados o las operaciones de cálculo.

---

## ADR-027 · Asignación de empleados a proyectos

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** El formulario de alta de obras se limita a los datos de la obra. Después de crear y seleccionar el proyecto, una pestaña Personal de obra consulta el directorio de empleados activos. El usuario elige una persona, la agrega a una lista visible y puede retirarla si se asignó por error. La ficha del proyecto conserva y muestra el personal asignado.

**Consecuencia.** La asignación queda en la persistencia local actual del módulo de proyectos. Su relación transaccional en Supabase se incorporará con la migración operativa de Proyectos.

---

## ADR-028 · Fechas de despacho y de entrega real de obra

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** La fecha y hora del despacho se capturan automáticamente al confirmar la salida y quedan en el movimiento de inventario y la remisión. La fecha real de entrega o finalización se solicita al marcar la obra como finalizada; se valida contra la fecha de inicio, pero puede ser anterior a la fecha estimada.

**Consecuencia.** Se diferencia la evidencia operativa de cada entrega de insumos del hito de cierre de la obra. Reabrir una obra elimina la fecha real de entrega anterior y exige una nueva fecha estimada.

---

## ADR-029 · Custodia de herramientas por obra

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** Las herramientas y equipos se asignan desde existencias disponibles a una persona previamente incluida en Personal de obra. El préstamo registra responsable, fecha de salida automática, fecha prevista y observaciones. La devolución se confirma con fecha y hora automática y un estado: buen estado o con novedad/dañada.

**Consecuencia.** Asignar una herramienta disminuye la disponibilidad en una unidad. Devolverla en buen estado repone esa unidad; una devolución dañada conserva el registro de novedad y no repone la disponibilidad hasta su revisión. Una asignación activa registrada por error puede anularse explícitamente, eliminando su custodia y reponiendo la unidad.

---

## ADR-030 · Clasificación operativa de artículos y búsqueda de custodia

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** El sistema clasifica los artículos del catálogo a partir de su grupo, categoría y nombre en Material/Insumo, Herramienta, Equipo o Dotación/EPP. El catálogo permite filtrar por esta clasificación. El registro de custodia solo presenta Herramientas y Equipos disponibles y ofrece búsqueda por nombre, código, marca o categoría antes de seleccionarlos.

**Consecuencia.** Los consumibles, materiales y elementos de protección no aparecen en la asignación de herramientas. Las herramientas que estén ubicadas en Bodega o en Herramientas de trabajadores se pueden encontrar y custodiar bajo la misma regla.

---

## ADR-031 · Orden operativo de pestañas de obra

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** Las pestañas de la ficha de obra se ordenan como Materiales e insumos, Herramientas en custodia, Personal de obra, Requisiciones y Ajustes de presupuesto. Este último queda al final como información de consulta. Cada pestaña usa un icono SVG asociado a su función.

**Consecuencia.** La interfaz refleja la consulta y gestión habitual de una obra, prioriza los costos y custodia operativa, y evita iconos dependientes de emojis o de la plataforma.

---

## ADR-032 · Búsqueda visible y formularios alineados en Inventario

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** La búsqueda del catálogo ofrece una lista de coincidencias mientras se escribe. Al seleccionar una coincidencia, se restablecen filtros de grupo, tipo, existencias, ubicación y categoría para mostrar el artículo. Los formularios de categorías y ubicaciones usan una grilla específica que evita que los botones cubran los campos; Configuración incorpora un icono SVG.

**Consecuencia.** Los artículos se encuentran aunque un filtro previo no tenga resultados. La configuración mantiene etiquetas visibles y controles utilizables en escritorio y dispositivos táctiles.

---

## ADR-033 · Suite de Endurecimiento de Seguridad y Transición a Next.js SSR

**Fecha:** 2026-09-21  
**Estado:** Aceptada

**Contexto.** El proyecto operaba con exportación puramente estática (`output: "export"`), lo que impedía la ejecución de middleware de borde, el refresco de cookies de sesión en servidor, el uso de cabeceras HTTP de seguridad dinámicas y el funcionamiento de API routes transaccionales (`/api/employees/password-reset`). Además, la auditoría integral de seguridad identificó bypasses potenciales en login sin Supabase, ausencia de redirección forzada en Server Components, contraseñas débiles y datos personales en bundle cliente.

**Decisión.**
1. **Transición a SSR en Next.js**: Remover `output: "export"` para habilitar el motor Serverless en Vercel.
2. **Middleware de Borde (`src/middleware.ts`)**: Proteger rutas `/dashboard`, `/inventory`, `/projects`, `/movements`, `/employees`, `/counts` y `/reports`, redirigiendo automáticamente a `/login` si no hay sesión activa y refrescando cookies `@supabase/ssr`.
3. **Autenticación Estricta en Servidor**: Modificar `requireAuthenticatedUser()` para invocar `redirect("/login")` inmediatamente en lugar de retornar valores nulos pasivos.
4. **Endurecimiento de Login**: Eliminar bypass demo sin Supabase, erradicar credenciales hardcoded por defecto y limpiar logs con correos o errores internos.
5. **Headers de Seguridad y CDN**: Configurar HSTS preload, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff y Referrer-Policy en `next.config.ts` y `vercel.json`.
6. **Hardening de API Route**: Añadir validación estricta de UUID y contraseña, control de tasa (rate limiting a 5 req/min) y registro en `audit_logs`.
7. **Políticas de Base de Datos y Supabase**: Elevar longitud mínima a 10 caracteres con complejidad, requerir confirmación por correo, limitar frecuencia a 60s, fijar timeouts de sesión a 8h por inactividad y 24h absoluto, deshabilitar auto-exposición de tablas y S3, e incorporar `pg_temp` al `search_path` de funciones `private`.

**Consecuencia.** La aplicación se alinea con los estándares de seguridad empresarial requeridos antes de producción, salvaguarda las rutas privadas contra accesos anónimos y garantiza la trazabilidad auditable de operaciones sensibles.

---

## ADR-034 · Adopción de Framework de Pruebas E2E y Validación de Escenarios de Negocio

**Fecha:** 2026-09-22  
**Estado:** Aceptada

**Contexto.** A medida que los módulos de Inventario, Movimientos, Proyectos y Empleados crecen en complejidad, realizar pruebas manuales dispersas en pantalla no asegura la integridad de los flujos críticos (control de acceso, consistencia de inventario, filtros y presupuestos).

**Decisión.**
1. Adoptar **Playwright** (`@playwright/test`) como estándar de pruebas E2E e integración de interfaz siguiendo las guías de `playwright-best-practices`.
2. Estructurar las pruebas bajo el directorio `tests/e2e/` con soporte para reportes visuales y de lista en consola (`npm run test:e2e`).
3. Validar el control de acceso en rutas protegidas, la navegación corporativa y los formularios interactivos de cada módulo.

**Consecuencia.** El equipo cuenta con un mecanismo profesional, repetible y automatizado para validar el comportamiento del ERP antes de despliegues y prevenir regresiones en la experiencia de usuario y seguridad.

---

## ADR-035 · Módulo de Cotizaciones, Embudo Comercial (Kanban) y Trazabilidad Operativa

**Fecha:** 2026-10-01  
**Estado:** Aceptada

**Contexto.** La recepción de solicitudes por correo (planos, visitas de obra, cotizaciones APU) no contaba con un canal operativo centralizado dentro del ERP. Los requerimientos corrían el riesgo de perderse entre correos y mensajes, sin seguimiento de tiempos de respuesta, responsables ni enlace directo hacia la creación del proyecto de obra una vez adjudicado.

**Decisión.**
1. **Módulo Desacoplado `quotes`**: Crear el dominio comercial en `src/modules/quotes/` con contrato público en `index.ts`.
2. **Ciclo de Vida de 12 Estados Operativos**:
   - `received`: 📥 Recibido (llegó correo/solicitud).
   - `in_review`: 🔎 En revisión (análisis de planos, alcance y requisitos).
   - `estimating`: 📝 Cotización en proceso (APU, materiales, cuadrilla y precios).
   - `sent`: 📤 Cotización enviada al cliente.
   - `awaiting_response`: ⏳ Esperando respuesta del cliente (con alerta automática si >3 días sin gestión).
   - `revision_requested`: 🔄 Por modificar (ajustes solicitados por el cliente).
   - `confirmed`: ✅ Trabajo confirmado (aprobación / orden de servicio).
   - `in_execution`: 🚧 En ejecución (obra iniciada en frentes de trabajo).
   - `work_completed`: 📋 Trabajo terminado (ejecución física finalizada).
   - `billing_pending`: 💰 Pendiente facturación / pago (actas o trámite contable).
   - `closed`: 🟢 Cerrado (finalizado integralmente).
   - `lost`: ❌ No adjudicado (no aprobada o cancelada).
3. **Tablero Kanban Interactivo & Vista Tabular**:
   - Vista Kanban con tarjetas arrastrables/desplazables con badges de estado, valores formateados en COP, origen de correo, responsable y alerta de estancamiento.
   - Alternancia ágil a vista de Tabla con búsqueda en vivo, filtros por estado y ordenamiento.
   - Modal de detalle con historial cronológico auditable (`quote_history`), cambio de estado con notas explicativas y vinculación a proyecto.
4. **Consecutivo Estandarizado RFC**: Formato exacto compuesto: `COT-{numero_consecutivo_automatico}-{año_actual}-{nombre_empresa}-{obra}` (ej. `COT-001-2026-OCENSA-CHIMENEA_CCM`), garantizando unicidad, indexación y correspondencia directa con nombres de archivos y expedientes físicos.
5. **Esquema de Base de Datos y RLS**:
   - Tablas `public.quotes` y `public.quote_history` en Supabase con políticas RLS de lectura y escritura para personal autorizado.
6. **Protección de Rutas**: Registro en `src/core/modules/catalog.ts` y protección SSR en `src/proxy.ts` (`/quotes`).

**Evolución e Ideas Acordadas para Próximas Fases:**
- **Pre-costeo / Estimación Paramétrica**: Desglose rápido de Materiales (vinculados al catálogo de 1,191 insumos), Cuadrillas/Mano de obra y Equipos/Maquinaria para generar el APU.
- **Conversión 1-Click a Proyecto (`/projects`)**: Creación automática de la ficha de obra con su centro de costos, presupuesto y fechas al pasar a estado confirmado o en ejecución.
- **Control de Versiones y Revisiones (R0, R1, R2)**: Trazabilidad de ajustes solicitados por el cliente sin perder la cotización original.
- **Semáforo de Vencimiento de Ofertas**: Validez comercial en días con alertas antes del vencimiento por variación de precios de insumos.
- **Registro de Visita Técnica Previa**: Acta de inspección de campo, fotos y levantamiento preliminar antes de cotizar.
- **Exportación de Propuesta Económica en PDF**: Generación membretada lista para enviar al cliente.

**Consecuencia.** La empresa estandariza el flujo comercial desde la recepción del correo hasta el cierre de obra, garantizando cero solicitudes extraviadas, alertas de seguimiento comercial oportunas y enlace directo al módulo de costeo de proyectos.

---

## ADR-036 · Pre-costeo Paramétrico, Trazabilidad de Revisiones (R1/R2), Conversión 1-Click y Propuesta Formal en PDF

**Fecha:** 2026-10-01  
**Estado:** Aceptada

**Contexto.** El módulo de cotizaciones v0.1 requería capacidades avanzadas para adaptarse a la operativa real de ingeniería y construcción de RFC: desglosar costos preliminares antes de adjudicar, gestionar solicitudes de descuento o cambios de alcance sin perder la oferta previa, alertar sobre ofertas comerciales que expiran por volatilidad de insumos, planificar inspecciones en campo y emitir la oferta formal membretada lista para el cliente.

**Decisión.**
1. **Pre-costeo Paramétrico de 3 Rubros**:
   - Modelar `costBreakdown` con: Materiales e insumos, Mano de obra/cuadrillas, Equipos y maquinaria, Transporte/fletes e Imprevistos/AIU.
   - Cálculo automático del valor estimado total y visualización compacta en tarjetas Kanban.
2. **Control de Versiones y Revisiones (R0, R1, R2...)**:
   - Atributo `revision` que añade el sufijo `-R1`, `-R2` al consecutivo base.
   - Flujo de creación de revisión con captura de motivo justificado para preservar la trazabilidad de negociaciones con clientes.
3. **Conversión 1-Click a Obra / Proyecto**:
   - Enlace directo con el módulo `/projects`: botón en cotizaciones confirmadas que genera el código de obra (`OBRA-AAAA-MM-DD-XX`), vincula el identificador y traslada el valor comercial como presupuesto oficial de la obra.
4. **Semáforo de Vigencia Comercial**:
   - Parámetro `validityDays` y cálculo de fecha de caducidad.
   - Etiquetas dinámicas en tarjetas y tabla: *Vigente*, *Vence pronto* (<= 5 días) y *Vencida*.
5. **Inspección Técnica en Campo Previa**:
   - Registro de estado de visita (pendiente/realizada), fecha programada, ingeniero inspector y acta de hallazgos.
6. **Propuesta Comercial Membretada Imprimible en PDF**:
   - Vista modal membretada con identidad institucional de Representaciones Figueroa Castro S.A.S. (Caucasia, Antioquia), alcance, desglose económico, condiciones comerciales y firmas autorizadas de ambas partes con reglas `@media print`.

**Consecuencia.** La empresa cuenta con una suite integral de estimación, negociación y contratación que conecta las oportunidades comerciales con la ejecución física y el control presupuestal de obras.



<!-- ADR-037 (Aceptada, 2026-10-01): Cotizaciones usa layout propio con requireAuthenticatedUser() y DashboardShell. Consecuencia: conserva navegacion lateral, encabezado, respuesta movil y control de acceso sin duplicar interfaz. -->
<!-- ADR-038 (Aceptada, 2026-10-01): el Kanban muestra todas las etapas operativas de cierre. Consecuencia: las cotizaciones en Trabajo terminado y Pendiente pago se localizan sin cambiar a la vista de lista ni depender de filtros. -->
<!-- ADR-039 (Aceptada, 2026-10-01): el arreglo de columnas Kanban se deriva de `quoteStatuses`. Consecuencia: cualquier nuevo estado oficial queda visible en el tablero y no se desincroniza de los selectores. -->
<!-- ADR-040 (Aceptada, 2026-10-01): la conversion de cotizacion a obra escribe en el repositorio persistente de Proyectos y conserva `projectId` y `projectCode` en la cotizacion. -->
<!-- ADR-041 (Aceptada, 2026-10-01): APU es un modulo de negocio independiente que consume el contrato publico de Inventarios para cotizar recursos sin duplicar el catalogo. -->
