---
estado: vigente
propietario: Producto y Líder de proyecto RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Producto, Desarrollo y Operación
---

# Backlog y riesgos

| R-010 | Rol laboral sin membresía Auth efectiva | Alto | Mitigado | Al crear/rehabilitar la cuenta mediante contraseña se sincroniza empresa, sede y rol específico en `user_roles`; se verificó RFC SAS como administrador. | Administración / Desarrollo |
| R-009 | Cuenta de Auth sin empresa/rol | Alto | Mitigado en interfaz | Bloquear guardado remoto y mostrar instrucción de asignación; administrar el vínculo desde Empleados antes de operar Cotizaciones/APU | Administración |

<!-- INV-003 (Ampliado, 2026-10-05): Conteos físicos incorpora jornadas periódicas por bodega, ubicación o categoría, historial visible y conciliación que produce movimientos de ajuste auditables. -->

## Validación de integración

- **QUO-OBRA-004 · Terminado:** caso de prueba `COT-004-2026-ALCALDIA-ESTRUCTURA_GIM-R1` enlazado con `OBRA-20261002-01`, con referencia bidireccional y cambio de estado a ejecución.
- **QUO-OBRA-005 · Terminado:** enlaces profundos seleccionan la ficha de obra destino y exponen el código efectivo de cotización como retorno visible.
- **QUO-OBRA-007 · Terminado:** compatibilidad de enlaces con obras históricas que guardaban el vínculo únicamente en la cotización.
- **PRJ-UX-006 · Terminado:** ayudas accesibles para acciones, selector, filtros y pestañas principales de Obras y Proyectos.
- **APU-006 · Terminado:** conservación y consulta del APU fuera de los estados editables, con bloqueo visible de edición y ruta de revisión.
- **ALQ-001 · Alta · Pendiente:** tipo de proyecto Alquiler, consecutivo `ALQ`, periodo de entrega/devolución, asignación de equipo, cargos por extensión/daños y enlace a facturación.
- **ALQ-002 · Terminado:** módulo de Alquiler rápido local para clientes particulares, bloqueo de disponibilidad del equipo y cierre con cargos adicionales.
- **ALQ-003 · Alta · Pendiente:** persistencia empresarial, adjuntos de cédula/fotos/firma y facturación para alquiler rápido.
- **REP-001 · Terminado:** centro de informes por nivel gerencial, operativo y financiero, con reportes de pipeline, APU y alquileres rápidos.
- **REP-002 · Alta · Pendiente:** filtros por período, indicadores de rentabilidad real y permisos por rol para exportaciones sensibles.
- **NAV-002 · Terminado:** Alquiler rápido se integra al Dashboard Shell; regla de composición obligatoria para módulos internos nuevos.

## Backlog priorizado

| ID | Prioridad | Entrega | Estado | Criterio de aceptación resumido |
| --- | --- | --- | --- | --- |
| DASH-001 | Alta | Dashboard Ejecutivo de Obras y Materiales | Terminado | Rediseño de `/dashboard` con KPIs financieros en COP, semáforo de obras y accesos rápidos de almacén |
| DASH-002 | Alta | Inteligencia de Costos y Alertas en Dashboard | Terminado | Top 5 materiales más costosos, gráfico comparativo de gasto, alertas de stock bajo mínimo y toasts |
| NAV-001 | Alta | Separación limpia de módulos y rutas | Terminado | Rutas independientes `/dashboard`, `/projects`, `/inventory`, `/movements` con iconos específicos |
| UI-001 | Alta | Corrección de Layout de Movimientos y Autocompletado | Terminado | Sidebar persistente en `/movements` y cierre automático del selector de artículos en modales |
| CORE-003 | Alta | Matriz RBAC de 5 Niveles de Empleado | Terminado | Definición de roles (Gerente, Residente, Almacenista, Maestro, Auditor) y reglas de visibilidad |
| INV-001 | Alta | Catálogo reactivo y buscador de 1,191 artículos | Terminado | Búsqueda predictiva, filtros por grupo y estado con paginador fluido |
| INV-002 | Alta | Kardex valorizado de movimientos (Entradas / Salidas / Ajustes) | Terminado | Validación de existencias, cálculo en tiempo real de costos y exportación CSV |
| COST-001 | Alta | Costeo de materiales por Obra / Proyecto | Terminado | Asignación de salidas a proyectos, cálculo de gasto acumulado y presupuestos |
| COST-002 | Alta | Calendario y estado de obra | Terminado | Fecha de inicio, entrega estimada, estado y validación de cronología en Proyectos y Supabase |
| COST-003 | Media | Tipificación y código automático de proyectos | Terminado | Al seleccionar Obra, Mantenimiento u Otro, se asigna un código consecutivo no editable por tipo y fecha de inicio |
| UI-002 | Media | Formato de campos monetarios COP | Terminado | Los presupuestos, costos y ajustes muestran `$500.000` al perder foco y conservan la edición numérica al enfocarse |
| COST-004 | Media | Asignación de empleados a obras | Terminado | La pestaña Personal de obra permite agregar empleados activos del directorio a una lista y retirarlos si se asignaron por error |
| CORE-002 | Alta | Autenticación y sesión con Supabase Auth | Terminado | Usuario administrador validado y confirmado en base de datos remota |
| VALE-001 | Media | Generación de Vales de Salida imprimibles (Remisión) | Terminado | Formato formal de remisión imprimible con firmas de entregado y recibido |
| REQ-001 | Media | Requisiciones de material desde frentes de obra | Terminado | Solicitud por residente de obra y aprobación por jefe de almacén |
| DEV-001 | Media | Devoluciones de material sobrante a bodega | Terminado | Reingreso de stock y reversión de costo asignado al proyecto |
| EQ-001 | Media | Módulo de equipos y custodia de herramientas | Terminado | Control de préstamo y devolución de herramientas por trabajador |
| QA-001 | Alta | Pruebas continuas y validación de build | Terminado | Validación estática `npm run build` con cero errores |
| QA-002 | Alta | Suite E2E y Pruebas Automatizadas por Módulo | Terminado | Integración de Playwright con suites para navegación, control de acceso y escenarios de módulos |
| INV-003 | Alta | Operaciones auditables de inventario | En implementación | Migración para ubicaciones, compras, conteos físicos, kardex con costos y auditoría bajo RLS |
| INV-004 | Media | Alertas y reportes operativos | En implementación | Punto de reorden, sugerencia de compra, consumo por obra, rotación, inmovilizado y valoración por grupo |
| INV-005 | Alta | Alta controlada de artículos | Terminado | Formulario para insumo, herramienta, equipo o dotación con entrada inicial trazable |
| SITE-001 | Media | Portada institucional y captura de solicitudes | Terminado | Landing corporativo ampliado, sin teléfonos publicados y con formulario que prepara la solicitud para el correo corporativo |
| SITE-002 | Alta | Envío directo de solicitudes web | Pendiente | Edge Function de Supabase envía una solicitud validada al buzón corporativo mediante proveedor transaccional, sin abrir el cliente de correo del visitante y con protección antispam |
| CORE-004 | Alta | Administración de empleados y accesos | Terminado | Crear fichas laborales, activar/desactivar, cambiar rol y otorgar o retirar permisos individuales guardados en Supabase bajo RLS y auditoría |

| PRJ-004 | Alta | Trazabilidad de despachos y cierre de obra | Terminado | Fecha y hora automática por despacho; fecha real de entrega manual al marcar una obra como finalizada |
| EQP-001 | Alta | Custodia de herramientas por obra | Terminado | Botón de asignación desde existencias, responsable, observaciones, devolución, novedades y anulación de asignaciones erróneas |
| INV-006 | Media | Clasificación operativa de catálogo | Terminado | Filtro y etiqueta de Material/Insumo, Herramienta, Equipo o Dotación/EPP; custodia limitada a herramientas y equipos |
| INV-007 | Alta | Requisiciones empresariales y despacho firmado | En implementación | Persistencia Supabase multiempresa de solicitud, líneas, aprobación, despacho, remisión y devolución; reemplaza el estado aislado del navegador. |
| INV-008 | Alta | Bajas por deterioro, daño o vencimiento | Planeado | Ajuste de salida con causa, evidencia, responsable, aprobación por umbral y acta imprimible. |
| INV-009 | Alta | Reposición, compras y proveedores | Planeado | Punto de reorden, propuesta de compra, recepción parcial, proveedor y costo promedio ponderado. |
| INV-010 | Media | Activos, QR y mantenimiento | Planeado | Identificación por QR/código, serial, custodio, estado, garantía, mantenimiento y evidencias. |
| INV-011 | Media | Inteligencia e importación de inventario | Planeado | Indicadores de rotación/inmovilizado/vencimiento y carga masiva con validación. |
| TALL-001 | Alta | Orden de taller y remisión de entrega | Planeado | Recepción de equipo/activo, diagnóstico, trabajo ejecutado, repuestos, notas, entrega por responsable y recibido con firma en documento institucional imprimible. |
| UI-003 | Baja | Orden e iconografía de pestañas de obra | Terminado | Materiales, herramientas, personal, requisiciones y ajustes informativos al final, con iconos SVG por función |
| UI-004 | Media | Búsqueda y configuración de catálogo | Terminado | Formularios sin solapamientos, icono de configuración y búsqueda de artículos con coincidencias en vivo |
| SEC-001 | Crítica | Endurecimiento integral de seguridad v1.0 | Terminado | Proxy/Middleware SSR, cookies de sesión, headers HTTP, RLS hardening, política de contraseñas y rate limiting |
| QTE-001 | Alta | Tablero Kanban y pipeline de cotizaciones v0.1 | Terminado | 12 estados operativos, vista Kanban y lista, filtros, badges de estado, consecutivo `COT-AAAA-###`, modal detallado con historial y notas |
| QTE-002 | Media | Persistencia Supabase y conversión a Obra/Proyecto | Terminado | Tablas `quotes` y `quote_history` con RLS, enlace con proyectos existentes y cálculo de estancamiento (>3 días) |
| QTE-003 | Alta | Consecutivo estandarizado RFC y pre-costeo paramétrico | Terminado | Consecutivo `COT-###-AAAA-EMPRESA-OBRA` y desglose de 3 rubros (Materiales, Mano de obra/Cuadrilla, Equipos/Maquinaria + Transporte e Imprevistos) |
| QTE-004 | Alta | Conversión 1-Click a Obra / Proyecto | Terminado | Botón en cotización confirmada que genera automáticamente el centro de costos en `/projects` con código de obra y presupuesto oficial |
| QTE-005 | Media | Control de versiones (R1, R2...) y Semáforo de vigencia comercial | Terminado | Generación de revisiones con motivo justificado, alerta visual de días de vigencia restantes y badge de ofertas por vencer/vencidas |
| QTE-006 | Alta | Visita técnica previa y Propuesta formal imprimible en PDF | Terminado | Pestaña de agendamiento y acta de visita en campo, más hoja membretada formal con desglose, condiciones y firmas (@media print) |

## Riesgos activos

| ID | Riesgo | Impacto | Probabilidad | Mitigación | Dueño |
| --- | --- | --- | --- | --- | --- |
| R-001 | Desconexión temporal de red en frentes de obra | Medio | Media | Persistencia local híbrida (`localStorage` + Supabase sync) | Desarrollo |
| R-002 | Despacho de materiales sin vale de entrega formal | Medio | Baja | Obligatoriedad del número de referencia / orden en el formulario | Almacén |
| R-003 | Desviación presupuestal inadvertida en obras | Alto | Media | Alertas visuales automáticas cuando la obra supera el 80% y 100% de materiales | Producto |
| R-004 | PII o secretos expuestos en código | Alto | Mitigado | Eliminados datos de usuario hardcoded, .env.example seguro y cabeceras CSP/HSTS activadas | Operación / Seguridad |
| R-005 | Cambios locales no sincronizados con la base | Alto | Media | Aplicar la migración de operaciones y migración de seguridad en Supabase | Desarrollo |
| R-006 | Solicitudes de la portada sin canal de recepción | Medio | Alta | Definir correo corporativo receptor o persistencia segura en Supabase antes de habilitar el envío | Dirección / Operación |
| R-007 | Empleado sin identidad de acceso al portal | Medio | Media | Configurar secreto administrativo de Supabase para invitar al correo del empleado y enlazar su ficha laboral con Auth | Operación / Desarrollo |
| R-008 | Formularios públicos o API abusadas | Medio | Mitigado | Rate limiting implementado en API de contraseñas, confirmación de correos obligatoria y auto_expose deshabilitado | Seguridad / Desarrollo |
<!-- QTE-007 (Terminado, 2026-10-01): navegacion consistente en Cotizaciones. `/quotes` se renderiza en el shell del portal con barra lateral, menu movil y autenticacion SSR. -->
<!-- QTE-008 (Terminado, 2026-10-01): visibilidad del cierre comercial. Las etapas Trabajo terminado y Pendiente pago son columnas del Kanban, evitando que una cotizacion actualizada parezca ausente. -->
<!-- QTE-009 (Terminado, 2026-10-01): cobertura completa de estados. Los 12 estados se pueden cambiar desde Lista o Detalle y se muestran como columnas de Kanban. -->
<!-- QTE-010 (Terminado, 2026-10-01): conversion persistente a Obra. La accion crea una obra con consecutivo oficial, presupuesto cotizado y fechas operativas para que aparezca en Proyectos. -->
<!-- APU-001 (Terminado, 2026-10-01): modulo de APU operativo con totales por rubro y costo unitario; materiales y equipos se seleccionan desde Inventarios. -->
<!-- APU-002 (Terminado, 2026-10-01): desde el detalle de una cotizacion se abre el APU contextual. Cada actividad queda ligada por quoteId y consolida los costos directos en el pre-costeo. -->
<!-- APU-003 (Terminado, 2026-10-01): catalogo inicial de actividades APU con buscador y creacion de actividad personalizada cuando no hay coincidencia. -->
<!-- APU-004 (Acordado, 2026-10-02): consulta y modificacion de APUs con autorizacion por permisos; definir matriz de roles en una fase posterior. -->
<!-- APU-005 (Pendiente de muestras, 2026-10-02): exportacion XLSX basada en el formato original, conservando dimensiones, celdas, formulas, estilos y configuracion de impresion; validar ademas las muestras PDF comerciales antes de implementar. -->
<!-- QTE-011 (Terminado, 2026-10-02): propuesta comercial imprimible redisenada desde cuatro muestras reales; conserva identidad RFC, franja verde, estructura tabular, IVA, condiciones y firma del representante legal. -->
<!-- APU-006 (Terminado, 2026-10-02): selector de mano de obra respaldado por `apu_labor_positions` en Supabase, con 68 cargos iniciales, búsqueda, filtros, vigencia, tarifa diaria completa, RLS multiempresa y fallback local. -->
<!-- APU-007 (Terminado, 2026-10-02): guardado explícito y confirmable del APU seleccionado, edición de nombre/unidad/cantidad y eliminación exclusiva del análisis abierto. -->
<!-- Riesgo APU-R01 (Mitigado, 2026-10-02): si la migración del catálogo salarial no se ha desplegado o no hay conexión, la interfaz identifica el respaldo local y permite continuar; la fuente visible indica si los datos provienen de base de datos. -->
<!-- NAV-002 (Terminado, 2026-10-02): botón accesible para contraer/mostrar la barra lateral del Dashboard en escritorio, con preferencia persistente y comportamiento móvil intacto. -->
<!-- APU-008 (Terminado, 2026-10-02): persistencia versionable de APU, líneas de recurso y vínculo opcional a cotización/obra con RLS multiempresa. -->
<!-- COST-005 (Terminado, 2026-10-02): presupuesto BOQ por obra e imputaciones de costo comprometido/real, con comparación contra el valor presupuestado. -->
<!-- APU-009 (Pendiente): clasificación configurable RFC/CSI/UniFormat/ICMS; no se incorporan catálogos licenciados sin autorización. -->
<!-- APU-010 (Pendiente): historial de precios, vigencias, proveedores, ciudades/sedes y alerta de variación de materiales/equipos. -->
<!-- APU-011 (Pendiente): cuadrillas reutilizables, productividad presupuestada vs. real, factor prestacional y horas extra. -->
<!-- APU-012 (Pendiente): compras/requisiciones desde líneas APU y alimentación automática de compromiso/real desde compras, inventario, nómina, equipo y subcontratos. -->
<!-- APU-013 (Pendiente): órdenes de cambio, evidencias técnicas adjuntas, AIU/impuestos/contingencias configurables y permisos finos de revisión/aprobación/exportación. -->
<!-- DB-001 (Terminado, 2026-10-02): aplicada `quotes_pipeline`; creadas `quotes` y `quote_history` con RLS y políticas por empresa. Se reconcilió el historial de migraciones ya existentes para evitar su reejecución. -->
<!-- APU-014 (Terminado, 2026-10-02): catálogo laboral robustecido por empresa y estado visible de contingencia; recursos no catalogados se pueden presupuestar manualmente sin afectar Inventarios. -->
<!-- UI-005 (Terminado, 2026-10-02): selector de recursos APU rediseñado como combobox buscable, limitado y táctil; elimina el desborde de listas nativas con catálogos extensos. -->
<!-- UI-006 (Terminado, 2026-10-02): normalización fonética y de tildes (NFD) con ranking de relevancia en buscadores de APU; resuelve búsquedas parciales e insensibles a diacríticos (ej. demolicion/demolición, tuberia/tubería) eliminando falsos positivos de grupo. -->
<!-- APU-015 (Terminado, 2026-10-02): catálogo maestro de transporte y fletes con CRUD persistente en Supabase y local; líneas APU congelan la tarifa al momento de agregar el ítem para preservar la inmutabilidad de análisis cerrados o anteriores ante variaciones futuras de tarifas. -->

<!-- QTE-012 (Terminado, 2026-10-02): ficha comercial legible y responsiva, con datos separados por etiqueta/valor y controles adaptados a móvil/tableta. -->
<!-- QTE-013 (Acordado, 2026-10-02): expediente técnico inicia al recibir la solicitud; revisión valida documentos/alcance/visita y Cotización en proceso habilita el APU. El cargue binario directo a Storage queda pendiente de la integración de almacenamiento. -->
<!-- DASH-001 (Terminado, 2026-10-02): dashboard ejecutivo muestra resumen enlazado de Cotizaciones, APUs y Obras, con acceso directo a la oferta que requiere costeo. -->
<!-- INV-016 (Terminado, 2026-10-02): búsqueda de Inventario y APU reconoce aliases de artículos sin alterar la denominación oficial. Pendiente: administración remota por roles de aliases para cada empresa. -->
<!-- APU-016 (Terminado, 2026-10-02): confirmación visible de guardado APU con estado de progreso y fuente de persistencia (base de datos, local o error). -->
<!-- DASH-002 (Terminado, 2026-10-02): alertas operativas priorizadas y accionables: las críticas/advertencias muestran origen y pulso visual discreto; se respeta prefers-reduced-motion. -->
<!-- UI-007 (Terminado, 2026-10-02): modales de impresión APU/Cotización no ocultan su encabezado ni su salida; scroll contenido, cierre superior/inferior y adaptación táctil. -->
<!-- QTE-014 (Terminado, 2026-10-02): iconos de ayuda contextuales en Cotizaciones explican el ciclo de estados sin sacar al usuario de la operación. -->
<!-- QTE-015 (Terminado, 2026-10-02): ayuda contextual por cada título de estado del Kanban, para reducir movimientos erróneos y orientar la siguiente acción. -->
<!-- QTE-016 (Terminado, 2026-10-02): propuesta comercial muestra valor total numérico y en letras en pesos colombianos M/L, reduciendo ambigüedad contractual. -->
<!-- QTE-017 (Terminado, 2026-10-02): se separan las notas comerciales de la cotización y se pueden editar en Datos Generales; se imprimen debajo del valor en letras. -->
<!-- QTE-018 (Terminado, 2026-10-02): notas comerciales multirenglón se preservan y se presentan como filas separadas en la propuesta, evitando agrupación ilegible. -->
<!-- QTE-019 (Terminado, 2026-10-02): trazabilidad bidireccional Cotización ↔ Obra; se evita perder el contexto comercial al entrar a la ejecución. -->
<!-- UI-008 (Terminado, 2026-10-02): historial comercial rediseñado como timeline responsivo; evita acumulación visual de fechas, responsables, cambios y notas. -->
<!-- APU-017 (Terminado, 2026-10-05): márgenes de ganancia diferenciados por rubro en APU (Materiales, Mano de obra, Equipos, Transporte) con cálculo en vivo de Costo Directo, Ganancia Estimada ponderada y Precio de Venta Cotizado integrado con Cotizaciones. -->
