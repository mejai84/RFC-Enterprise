---
estado: vigente
propietario: Equipo RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Desarrollo y Operación
---

# Registro de decisiones arquitectónicas y de producto

## ADR-073 · Identidad legible de la obra de origen comercial

**Fecha:** 2026-10-02
**Estado:** Aceptada

El consecutivo de obra conserva el formato operativo `OBRA-AAAAMMDD-##`. Cuando nace de una cotización, el nombre de la obra inicia con el código efectivo de la cotización (incluida la revisión), mientras se guardan `sourceQuoteId` y `sourceQuoteCode` para un enlace seguro y navegable.

El enlace comercial hacia Obras utiliza `projectId` en la URL para abrir la ficha concreta; el retorno utiliza `sourceQuoteId`. La referencia se muestra como control de navegación, no como texto informativo secundario.

Para compatibilidad de datos existentes, una obra también resuelve su cotización de origen al encontrar una cotización cuyo `projectId` o `projectCode` coincide con ella.

Las acciones operativas de Obras y Proyectos disponen de ayuda contextual breve y visible mediante foco, cursor o toque, sin ocultar las etiquetas funcionales.

## ADR-074 · APU persistente con edición por estado comercial

**Fecha:** 2026-10-02
**Estado:** Aceptada

El APU es evidencia de la estimación y nunca se oculta por un cambio de pipeline. Solo los estados `estimating` y `revision_requested` permiten crear, editar, guardar o eliminar APUs. En estados posteriores se abre en consulta para preservar la propuesta enviada; una nueva revisión restablece la edición.

## ADR-075 · Proyecto como entidad general; alquiler como tipo

**Fecha:** 2026-10-02
**Estado:** Aceptada

`Proyecto` es la entidad transversal creada al adjudicar una cotización. `Obra`, `Mantenimiento` y `Alquiler` son tipos de proyecto. El alquiler tendrá consecutivo `ALQ`, control de periodo, equipo en custodia y cargos adicionales antes de facturar.

## ADR-076 · Alquiler rápido para clientes particulares

**Fecha:** 2026-10-02
**Estado:** Aceptada

El alquiler de corta duración no exige cotización ni APU. Se registra mediante un comprobante operativo `ALQ-RAP`, con cliente, teléfono, documento, periodo, tarifa, garantía, accesorios y estado. Al entregar, descuenta una unidad disponible; al devolver, registra novedades/cargo adicional y la restaura.

## ADR-077 · Informes por propósito de decisión

**Fecha:** 2026-10-02
**Estado:** Aceptada

Los informes se clasifican en Gerenciales, Operativos y Financieros para que cada usuario encuentre el indicador requerido sin conocer la estructura técnica de los módulos. La versión inicial consulta datos locales y deja para la fase de permisos el control de acceso y exportación.

## ADR-078 · Navegación uniforme para módulos internos

**Fecha:** 2026-10-02
**Estado:** Aceptada

Las rutas de módulos internos se renderizan dentro de `DashboardShell`. Ningún módulo operativo puede abrir como página aislada, pues debe preservar navegación, sesión, alertas y diseño adaptable del portal.

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
<!-- ADR-042 (Aceptada, 2026-10-01): el flujo principal de APU inicia dentro del detalle de una cotizacion. Consecuencia: los APUs se identifican con quoteId/quoteCode y consolidan automaticamente el pre-costeo de esa oferta. -->
<!-- ADR-043 (Aceptada, 2026-10-01): APU mantiene un catalogo semilla de actividades reutilizables y permite crear actividades personalizadas. Consecuencia: la operacion no queda limitada a una lista cerrada. -->
<!-- ADR-044 (Aceptada, 2026-10-02): los APUs seran documentos consultables y versionables; consultar, modificar y exportar se resolvera mediante permisos independientes. La asignacion concreta a roles se definira posteriormente. -->
<!-- ADR-045 (Aceptada, 2026-10-02): las salidas APU se generan desde plantillas maestras suministradas por el usuario. El XLSX debe preservar exactamente estructura y presentacion; el PDF comercial se ajustara tras comparar varias muestras reales. -->
<!-- ADR-046 (Aceptada, 2026-10-02): el formato comercial PDF oficial parte del patron comun observado en COT-116, COT-119, COT-121 y COT-128. Se reutilizan `rfc-logo.svg` y la firma real como activos; no se recrea ni se simula la firma. -->
<!-- ADR-047 (Aceptada, 2026-10-02): el tabulador salarial deja de ser únicamente código embebido y se persiste en `public.apu_labor_positions`, aislado por empresa y protegido con RLS. APU consume este catálogo mediante su repositorio y solo recurre a la copia local cuando Supabase no está disponible. -->
<!-- ADR-048 (Aceptada, 2026-10-02): los cambios de un APU en el editor se consideran pendientes hasta pulsar `Guardar APU`; la interfaz confirma hora y código guardado. Editar o eliminar actúa únicamente sobre el APU seleccionado, nunca sobre todos los APUs de la cotización. -->
<!-- ADR-049 (Aceptada, 2026-10-02): la navegación lateral del Dashboard se puede contraer solo en escritorio para liberar área de trabajo. La elección se guarda en el navegador; bajo 980px prevalece el drawer móvil completo y accesible. -->
<!-- ADR-050 (Aceptada, 2026-10-02): un APU es una entidad persistente y versionable. Cada guardado genera una versión con sus líneas y total directo; el análisis conserva la versión vigente, y borrar desde UI lo archiva en vez de destruir su trazabilidad. -->
<!-- ADR-051 (Aceptada, 2026-10-02): el presupuesto de obra adopta una estructura BOQ: cada APU guardado puede ser una línea de presupuesto de una obra, con cantidad contractual, costo unitario, presupuesto total e imputaciones comprometidas/reales. -->
<!-- ADR-052 (Aceptada, 2026-10-02): la clasificación de actividades queda preparada como campo extensible y configurable; cualquier catálogo CSI, UniFormat o ICMS se importará únicamente con licencia/datos autorizados. -->
<!-- ADR-053 (Aceptada, 2026-10-02): el historial de Supabase es la fuente operativa de despliegue y debe coincidir con `supabase/migrations`. Cuando el esquema existente carezca de historial, se verifica primero su presencia y luego se marca como aplicado sin reejecutar DDL; las migraciones aplicadas por la plataforma se renombran localmente a su versión remota. -->
<!-- ADR-054 (Aceptada, 2026-10-02): una línea APU manual representa un costo presupuestado, no un alta de inventario. Solo las líneas seleccionadas desde el catálogo conservan referencia de inventario; el maestro se crea mediante su proceso formal para evitar stock, costo o SKU ficticios. -->
<!-- ADR-055 (Aceptada, 2026-10-02): los catálogos extensos dentro de APU usan búsqueda progresiva y resultados acotados, no selectores nativos. Consecuencia: la interacción mantiene el contexto de la actividad, es usable con teclado/táctil y no desborda el formulario. -->
<!-- ADR-056 (Aceptada, 2026-10-02): el estado inicial de cotizaciones consolida directamente los APUs existentes en el inicializador de estado reactivo perezoso (lazy initializer) eliminando efectos sincronos en cascada. Los componentes de seleccion buscables implementan atributos ARIA completos (aria-controls, aria-expanded, aria-selected) y sincronizacion en render sin efectos reactivos secundarios. -->
<!-- ADR-057 (Aceptada, 2026-10-02): los buscadores de actividades, mano de obra y recursos en APU aplican normalización canónica de caracteres (NFD) para suprimir diacríticos/tildes y dividen las entradas en tokens. La coincidencia en el nombre del elemento tiene prelación estricta sobre grupos o resúmenes de funciones, eliminando falsos positivos en los que aparecían cargos o actividades no relacionadas. -->
<!-- ADR-058 (Aceptada, 2026-10-02): el rubro de Transporte en APU se respalda en un catálogo maestro editable (`apu_transport_items`) estructurado según Odoo Fleet y logística industrial. Cada línea de transporte asignada a un APU guarda una instantánea independiente (snapshot) de su tarifa y unidad. Por diseño arquitectónico, cualquier edición posterior de precios en el maestro solo aplica a nuevos análisis; los APUs históricos, cerrados o en ejecución permanecen financieramente inmutables. -->
<!-- ADR-059 (Aceptada, 2026-10-02): cada APU seleccionado expone un botón "🖨️ Imprimir APU" que abre un modal (ApuPrintModal) con formato institucional A4 que incluye logo RFC, metadatos, 4 tablas de costo por categoría, resumen de costo directo/unitario y zona de firmas. El @media print oculta la interfaz de la aplicación y solo renderiza la hoja A4, permitiendo exportar a PDF desde el navegador. -->
<!-- ADR-060 (Aceptada, 2026-10-02): el selector de obra/proyecto para vincular APUs al presupuesto BOQ fusiona tres fuentes en orden de prioridad: proyectos remotos de Supabase, proyectos almacenados en localStorage (`rfc_inventory_projects`) y proyectos semilla (`initialProjects`). Esto garantiza que el dropdown nunca esté vacío, incluso offline o antes de crear proyectos en la base de datos. En modo local sin companyId, el vínculo BOQ se persiste en localStorage (`rfc_apu_boq_items`). -->
<!-- ADR-056 (Aceptada, 2026-10-02): el flujo comercial de una solicitud es Recibido (radicar correo y adjuntos), En revisión (validar alcance, planos, requisitos y visita) y Cotización en proceso (crear/ajustar APU y propuesta). El APU no se edita antes de esa etapa salvo que se devuelva Por modificar. -->
<!-- ADR-061 (Aceptada, 2026-10-02): el Dashboard es una consola ejecutiva modular, no solo de inventario. Consolida lecturas locales de Cotizaciones, APUs y Obras y ofrece enlaces de acción; no duplica sus datos ni sus reglas de negocio. -->
<!-- ADR-062 (Aceptada, 2026-10-02): los aliases de Inventario son metadatos de búsqueda. Se comparan con normalización de tildes y por tokens, pero el resultado conserva siempre nombre, SKU y unidad técnicos para impedir ambigüedad operativa. -->
<!-- ADR-063 (Aceptada, 2026-10-02): las acciones de persistencia APU deben comunicar explícitamente el resultado y su destino. No se presenta un guardado local como si fuera una confirmación de base de datos. -->
<!-- ADR-064 (Aceptada, 2026-10-02): las alertas del Dashboard se derivan de los datos de sus módulos y no duplican estados. Cada alerta expresa origen, causa, prioridad y un enlace para atenderla; solo las alertas críticas o de advertencia usan animación, compatible con reducción de movimiento. -->
<!-- ADR-065 (Aceptada, 2026-10-02): una vista previa extensa debe desplazar su propio contenido y conservar una salida disponible arriba y abajo. Los controles se excluyen de la impresión final. -->
<!-- ADR-066 (Aceptada, 2026-10-02): las ayudas contextuales exponen la regla operativa junto al control que la requiere. En Cotizaciones son accesibles por cursor, foco de teclado y toque; no dependen exclusivamente del hover. -->
<!-- ADR-067 (Aceptada, 2026-10-02): cada estado oficial del pipeline comercial posee una explicación contextual propia en su columna Kanban. La ayuda indica la acción esperada, no solo una definición nominal. -->
<!-- ADR-068 (Aceptada, 2026-10-02): toda propuesta comercial impresa debe incluir el valor en cifra y en letras en mayúsculas con la leyenda PESOS COLOMBIANOS M/L; la leyenda se calcula del total presentado en esa versión. -->
<!-- ADR-069 (Aceptada, 2026-10-02): para evitar redundancia visual, la línea VALOR A PAGAR muestra únicamente el valor en letras. Las notas comerciales se administran en la ficha de la cotización y se ubican debajo de esa leyenda al imprimir. -->
<!-- ADR-070 (Aceptada, 2026-10-02): las notas comerciales usan saltos de línea como delimitador de filas de impresión. La interfaz lo indica junto al campo para que el usuario controle el resultado documental. -->
<!-- ADR-071 (Aceptada, 2026-10-02): la conversión de Cotización a Obra persiste identificador y código de oferta de origen en la obra. La ficha resuelve también enlaces históricos por projectId/projectCode y retorna al detalle de Cotizaciones mediante parámetro quoteId. -->
<!-- ADR-072 (Aceptada, 2026-10-02): la trazabilidad de cotizaciones se representa como línea de tiempo; cada evento conserva responsable, fecha, transición y nota como unidades visuales separadas. -->
