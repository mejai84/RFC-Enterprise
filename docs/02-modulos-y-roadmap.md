<!-- Registro 2026-10-22: Inventario y Movimientos conservan pestaña, búsqueda, filtros y página en la URL para enlaces operativos compartibles. Sus diálogos son accesibles por teclado: foco contenido, Escape, clic fuera y retorno al control de origen. -->
<!-- Registro 2026-10-19: el Resumen del dashboard explica cada indicador con un icono de ayuda contextual; presupuesto de obras, gasto real, saldo, alertas y contadores comerciales indican que miden y de donde salen. -->
<!-- Registro 2026-10-20: Compras ya permite registrar recepción total o parcial de una orden, con factura/remisión, costo unitario y entrada transaccional a inventario. -->
<!-- Registro 2026-10-20: Informes de inventario agrega consumo por obra, rotación, stock inmovilizado y valoración por grupo sobre datos persistidos. El alquiler rápido pasa a documento multi-línea con una sola firma y devolución parcial por ítem. El catálogo de transporte del APU deja de usar localStorage como fuente de verdad y migra sus códigos ausentes a Supabase. -->
<!-- Registro 2026-10-21: el Kardex de inventario pasa a ser un libro mayor transaccional con RPCs, idempotencia, saldo antes/después, auditoría y escrituras directas revocadas. Las lecturas recorren todas las páginas de PostgREST y los préstamos de herramientas generan movimiento. -->
<!-- Registro 2026-10-19: la campana del portal carga las alertas operativas desde el shell compartido y las muestra en todos los modulos autorizados, con acceso directo al caso que requiere atencion. Resumen consume la misma regla para evitar conteos distintos. -->
<!-- Registro 2026-10-13: cada version de APU conserva rendimiento diario de la cuadrilla y tamano de cuadrilla. La duracion tecnica se calcula como techo(cantidad de obra / rendimiento diario), en dias fisicos; no usa fechas comerciales ni crea dias remunerados o extras. -->
---
estado: vigente
propietario: Producto y Desarrollo RFC Enterprise
ultima_actualizacion: 2026-10-22
audiencia: Dirección, Producto y Desarrollo
---

# Módulos y roadmap

> Actualización 2026-10-06: las actividades APU seleccionan su unidad desde un catálogo filtrable por nombre o abreviatura y guardan el símbolo técnico elegido (`m²`, `kg`, `und`, `m³`, entre otros).

<!-- Registro 2026-10-06: una ficha laboral recibe empresa, sede y rol al crearse. Al asignar su primera contraseña se crea o repara su membresía efectiva `user_roles` con ese mismo rol; la autorización de Supabase y la pantalla de Empleados permanecen coherentes. -->
<!-- Registro 2026-10-06: Cotizaciones y Proyectos/Obras evitan desplazamiento lateral en móvil; Kanban se presenta como columnas verticales y los controles de vista permanecen junto al título en escritorio. -->
<!-- Registro 2026-10-06: Cotizaciones usa Supabase como fuente compartida: carga cotizaciones e historial por empresa, persiste altas y modificaciones con UUID válido y notifica el fallo si la cuenta no tiene empresa/rol. La ficha permite editar datos generales del cliente, contacto, actividad, responsable y siguiente acción. -->
<!-- Registro 2026-10-06: APU no presenta un guardado local como confirmación cuando existe sesión sin empresa/rol; el usuario recibe una acción clara para solicitar su asignación. Cantidad, rendimiento y tarifa aceptan decimales con coma o punto. -->

## Enlace de prueba cotización → obra

La cotización `COT-004-2026-ALCALDIA-ESTRUCTURA_GIM-R1` queda convertida en la obra `OBRA-20261002-01`. El código de obra permanece consecutivo y operativo; su nombre inicia con el código efectivo de cotización para conservar la trazabilidad visual en ambos módulos.

Al navegar desde la cotización, la obra indicada por el enlace se selecciona y abre directamente en su ficha. La ficha de obra muestra una tarjeta clicable con la cotización de origen para el retorno inmediato al pipeline.

La referencia de origen se resuelve tanto desde los campos nuevos de la obra como desde vínculos ya existentes en la cotización, para no perder la navegación en obras creadas anteriormente.

El módulo de Obras y Proyectos incorpora ayudas contextuales y descripciones de las acciones principales para orientar a usuarios operativos.

## Ciclo de vida del APU en cotizaciones

Un APU creado permanece disponible durante todo el pipeline. Se puede crear y editar únicamente en `Cotización en proceso` y `Por modificar`; en los demás estados se consulta como registro histórico. Para cambiar una oferta enviada o adjudicada se debe crear una revisión.

## Proyecto de alquiler de equipos

Proyecto es el concepto general y `Obra`, `Mantenimiento` o `Alquiler` son sus tipos. El flujo de alquiler se planifica desde Cotizaciones: tarifa/APU, periodo, transporte, operador y condiciones; al confirmarse genera un proyecto `ALQ-AAAAMMDD-##`, enlazado con la custodia de equipos y con los cargos para facturación.

Como vía alternativa para clientes particulares se incorpora `Alquiler rápido`: entrega sin cotización formal, con consecutivo `ALQ-RAP-AAAAMMDD-###`, identificación básica, equipo, periodo, tarifa, garantía, devolución y novedades.

**Estado 2026-10-07 (ADR-106, ADR-107).** El proyecto de tipo `Alquiler` ya registra sus condiciones económicas en la propia ficha: tarifa diaria, cargo por día de extensión, mora por día de retraso y condiciones particulares. La entrega del equipo es la fecha de inicio, la devolución pactada es la fecha estimada de fin y la devolución real se captura al cerrar el proyecto; con esos tres datos el sistema calcula los días facturados, la extensión, la mora y el total a facturar. El presupuesto de materiales deja de ser obligatorio en este tipo porque un alquiler no despacha insumos. El `Alquiler rápido` quedó con persistencia real en Supabase —tablas `quick_rentals` y `quick_rental_attachments`, bucket privado `rental-attachments`, RLS por empresa—, con la firma del cliente almacenada como adjunto y sin reservas en `localStorage`.

**Estado 2026-10-20 (ADR-160).** El alquiler rápido activo es un documento multi-línea: `quick_rental_orders` guarda una sola cabecera y una sola firma de entrega, y `quick_rental_order_items` conserva cantidad, tarifa, garantía unitaria, devolución parcial y recargo por equipo. La disponibilidad se calcula contra la bodega persistida (`inventory_stock` + `inventory_items`) menos las líneas pendientes de otros documentos activos; no se usa el catálogo semilla del navegador. La tabla histórica `quick_rentals` se conserva como archivo de la etapa anterior y no es fuente de verdad del flujo nuevo. Se retiró la pantalla unitaria sin ruta activa.

## Informes de inventario y catálogo de transporte (2026-10-20)

El Centro de informes incorpora cuatro lecturas operativas sobre datos persistidos: **consumo por obra** (salidas valorizadas por proyecto), **rotación** (unidades salidas ÷ existencia actual), **stock inmovilizado** (referencias con existencia y sin salidas en el periodo) y **valoración por grupo** (Bodega, Dotación y Trabajadores). El periodo se elige entre 30 días, 90 días, 12 meses o histórico completo. La rotación se declara como índice operativo, no como costo de ventas contable, porque aún no hay fotografías históricas de existencias (ADR-158, riesgo INF-001).

El catálogo de transporte del APU deja de escribir en `rfc_apu_transport_items`. La primera carga con sesión importa a `apu_transport_items` solo los códigos que no existan en la empresa y elimina la clave local únicamente después de una importación exitosa; sin Supabase o sin sesión no se muestran datos locales como si fueran persistidos (ADR-159).

## Registro de jornada

El `Registro de jornada` registra una **declaración del empleado** sobre dónde está trabajando y qué actividad realiza. **No hay lectura automática de ubicación ni seguimiento en segundo plano**, y no se exigen fotografías. Queda respaldo de lo que el propio trabajador declara y de quién lo declara: sitio o frente, actividad, obra asociada y la hora del servidor.

**Ubicación declarada (opcional, ADR-110).** El formulario incluye un botón `Activar mi ubicación` que lee el punto **solo cuando la persona lo pulsa**. Antes de leer nada se muestra el texto de consentimiento, que declara que es opcional y que el registro vale igual sin compartirla. Si el permiso se deniega o el GPS está apagado, la pantalla lo explica y sugiere escribir el sitio con palabras, sin dejar el formulario bloqueado. Cuando se comparte, se conservan latitud, longitud, precisión aproximada, el nombre del lugar y el momento de la lectura, todos con hora del servidor; el nombre del lugar se resuelve en el servidor de RFC contra OpenStreetMap, de modo que el navegador no sale a un tercero. Las coordenadas son una declaración del cliente, no una atestación del dispositivo: no deben presentarse como prueba de presencia (riesgo LAB-003). Cambiar la política a obligatoria es modificar `ATTENDANCE_MAP_REQUIREMENT` en el dominio; la rama ya está implementada.

La jornada se gestiona por **tramos consecutivos**: la entrada abre el primer tramo; al cambiar de actividad, sitio, desplazarse o tomar una pausa, el sistema cierra el tramo anterior y abre el siguiente dentro de la misma transacción. La salida cierra el tramo activo y la jornada. Si una persona olvida salir, el sistema no inventa una hora: el día queda `needs_review` al comenzar una jornada posterior, pendiente del futuro flujo formal de corrección. La interfaz recuerda de forma visible la salida y el uso de desplazamiento para que no existan huecos sin explicación.

La pantalla se divide en dos secciones cuando el usuario tiene permisos de consulta. `Mi jornada` presenta una sola acción primaria según el estado: registrar entrada, abrir un nuevo tramo o registrar salida. Obra es opcional; sitio y actividad son obligatorios. `Consulta de jornada` es la vista gerencial: filtros por período (Día, Semana, Mes), por empleado, por obra y búsqueda de texto sobre nombre, sitio y actividad, con cuatro indicadores (empleados con declaración, sin declaración, total de declaraciones y obras o frentes con actividad), tabla del día y resumen expandible por empleado en los períodos largos.

La declaración es inmutable: se registra por RPC con hora del servidor y no admite edición ni borrado, ni desde la interfaz ni con permisos directos sobre la tabla (ADR-108, ADR-109).


## Identidad, membrete y valores por defecto

Configuración concentra lo que aplica a toda la empresa y se separa por áreas: **Firma y membrete**, **Propuesta** y **Empresa y nómina**. La ficha personal ya no vive ahí: tiene su propio módulo `Mi perfil`, con el cambio de contraseña en un modal (ADR-120).

**Firma y membrete (ADR-115).** El nombre del representante legal y la imagen de la firma salen de la base de datos y se suben desde la pantalla, con un interruptor por tipo de documento: propuestas comerciales, impresión del APU, exportación XLSX, vales de salida y facturas de alquiler. Si la empresa no sube firma, se usa la del sistema.

**Propuesta (ADR-116).** IVA, anticipo, descuento máximo, retención, plazo de entrega, vigencia de la oferta, condiciones de pago, datos bancarios y si el total se imprime también en letras. Vigencia, plazo y condiciones se aplican solos al abrir una cotización nueva.

## Navegación por bloques

La barra lateral agrupa los módulos por dominio sin unirlos (ADR-118): **Comercial** (Cotizaciones, APU), **Obras** (Proyectos, Registro de jornada, Alquiler rápido), **Bodega** (Inventarios, Movimientos, Conteos físicos), **Consultas** (Informes) y **Administración** (Empleados, Mi perfil, Configuración). Cada módulo sigue siendo su propia pantalla y su propia ruta. Un bloque con un solo módulo visible se muestra suelto, y si a la persona solo le corresponde un módulo en toda la aplicación no ve ningún encabezado.
## Centro de informes

El módulo de Informes se organiza en vistas Gerenciales, Operativas y Financieras. Consolida cotizaciones, inventario, kardex, proyectos, APU y alquileres rápidos, con filtros, exportación CSV e impresión.

Todo módulo interno, incluido Alquiler rápido, se compone dentro de `DashboardShell` para conservar navegación lateral, barra superior, sesión y comportamiento responsive de forma uniforme.

## Módulos de la plataforma

| Código | Módulo | Estado | Alcance actual |
| --- | --- | --- | --- |
| `core` | Administración | Operativo v0.4 | Directorio persistente de empleados, roles, permisos individuales, activación, auditoría, empresas, sedes, sesión y cierre de sesión |
| `site` | Sitio institucional | Operativo v0.5 | Portada corporativa ampliada, capacidades, enfoque de trabajo, imágenes sectoriales, acceso superior al portal de empleados y formulario que envía la solicitud a una Edge Function con validación, antispam y proveedor transaccional |
| `dashboard` | Dashboard Ejecutivo | Operativo v0.4 | Panel principal e informes funcionales con filtros, KPIs, gráficos SVG accesibles, exportación CSV, impresión y análisis de inventario, Kardex, stock crítico y obras |
| `quotes` | Cotizaciones & Pipeline | Operativo v0.3 | Tablero Kanban y lista, consecutivo `COT-###-AAAA-EMPRESA-OBRA`, pre-costeo por 3 rubros (Materiales, Cuadrillas, Equipos), control de revisiones (R1/R2), comparador de revisiones de solo lectura, expediente comercial privado (solicitud, planos, correos, orden de servicio, aprobación), inspección técnica en campo, procedimiento de trabajo y matriz de riesgos privados/versionados, semáforo de vigencia comercial, conversión 1-click a obra y propuesta membretada imprimible en PDF |
| `inventory` | Inventarios & Kardex | Operativo v0.6 | Catálogo, kardex, conteos, alta de artículos, ubicaciones, custodia, despachos e importación masiva CSV/XLSX con vista previa y auditoría. Se inicia la persistencia empresarial del ciclo requisición de obra → despacho/remisión firmada → devolución. |
| `projects` | Costeo de Proyectos | Operativo v0.4 | Centro de costos, tipo de proyecto, código consecutivo automático, asignación de empleados, calendario de inicio/entrega estimada, estado de obra, presupuestos y control de sobrecostos |
| `attendance` | Registro de Jornada | Operativo v0.3 | Jornada con entrada, salida y tramos consecutivos de trabajo, desplazamiento o pausa; las actividades se encadenan sin cerrar la jornada. Ubicación declarada de forma opcional y solo por acción del empleado. Consulta gerencial por día, semana o mes, habilitada por el permiso `attendance.team.view` |
| `equipment` | Equipos & Custodia | Operativo v0.1 | Préstamo y seguimiento de herramientas a cuadrillas y trabajadores por obra |
| `purchases` | Compras | Planeado | Sin implementación |
| `suppliers` | Proveedores | Planeado | Sin implementación |
| `contracts` | Contratos | Planeado | Sin implementación |
| `hr` | Talento humano | Planeado | Sin implementación |
| `apu` | APU | Planeado | Sin implementación |

<!-- Registro 2026-10-01: APU operativo v0.1 se inicia desde el detalle de cada cotizacion y conserva el catalogo general para reutilizar actividades. -->
<!-- Registro 2026-10-01: el catalogo base de APU incorpora actividades frecuentes de obra civil, cubiertas, redes, electricidad, metalmecanica, acabados y SST; el usuario puede crear actividades personalizadas. -->

## Regla de propiedad e integración

- **Inventarios** es dueño de productos, existencias, vales de salida y movimientos.
- **Proyectos** consume el contrato público de movimientos de Inventarios para imputar costos de materiales a cada obra sin romper el desacoplamiento modular.
- **Dashboard** expone la síntesis ejecutiva para la toma de decisiones gerenciales y operativas.

## Evolución acordada de Inventarios

La evolución se ejecutará en este orden para que cada fase entregue control operativo completo y reutilizable:

1. **Requisiciones y despacho compartido:** solicitudes por obra persistentes, aprobación, disponibilidad, despacho, remisión firmada y devolución.
2. **Bajas y deterioros:** salida por daño, vencimiento, pérdida o baja con motivo, evidencia, responsable y autorización según el valor.
3. **Reposición y compras:** mínimos, punto de reorden, sugerencia/solicitud de compra, proveedores y recepción que actualiza el costo promedio.
4. **Custodia y activos:** QR/código de barras, préstamos, seriales, estado, garantía, mantenimiento y actas de entrega/devolución.
5. **Taller y servicios:** orden de recepción, diagnóstico, trabajos ejecutados, repuestos, responsable y remisión de entrega firmada para equipos propios o de terceros.
6. **Inteligencia e importación:** rotación, inmovilizado, valor por grupo, vencimientos, auditoría e importación validada desde Excel.

## Entrega actual: Dashboard Ejecutivo, Inteligencia de Costos & Jerarquía de Empleados v0.4

### Incluye

- **Separación de Módulos y Rutas**:
  - `/dashboard`: Panel ejecutivo, saludo contextual y resumen de actividad diaria.
  - `/projects`: Centro de costos por obra, presupuestos y materiales consumidos.
  - `/inventory`: Catálogo integral de 1,191 insumos y control de existencias.
  - `/movements`: Kardex cronológico valorizado de entradas, salidas y remisiones.
- **Jerarquía de Niveles de Empleado (5 Roles)**:
  1. *Administrador / Gerencia General*: Acceso total y finanzas consolidadas en COP.
  2. *Ingeniero Residente / Director de Obra*: Visibilidad de sus obras a cargo, requisiciones y herramientas asignadas.
  3. *Jefe de Almacén / Bodeguero*: Alertas de stock crítico, vales de salida con remisión física y custodia de equipos.
  4. *Maestro de Obra / Cuadrilla*: Solicitudes de pedidos desde frente de obra y consulta de herramientas.
  5. *Auditor / Contador*: Kardex valorizado, auditoría y control de consumos sin alteración física de inventarios.
- **Paneles de Inteligencia en Dashboard**:
  - *Top 5 Materiales Más Costosos*: Ranking dinámico por gasto en COP y % sobre el presupuesto despachado.
  - *Comparativo de Gasto Acumulado por Obra*: Gráfico de barras visual con semáforo presupuestal.
  - *Artículos Críticos Bajo Mínimo*: Tabla de alertas operativas con stock actual, mínimo y déficit para reposición.
  - *Sistema de Toasts*: Notificaciones elegantes tipo SaaS reemplazando alertas nativas.
- **Diseño 100% Responsivo Multidispositivo (PC, Tablets, Móviles)**:
  - Navegación lateral colapsable con drawer táctil y botón hamburguesa.
  - Modales, vales de remisión y fichas de obra adaptados a pantallas táctiles.
  - Gráficos y tablas con scroll suave y contenedores `overflow-x: auto` sin romper el ancho de pantalla.
  - Botones y elementos interactivos con área táctil óptima de 44px para uso en obra con smartphones y tablets.
- Catálogo completo con 1,191 artículos, Kardex valorizado y exportación CSV.
- Persistencia en Supabase e integración con identidad Supabase. El navegador solo conserva preferencias de interfaz, no confirmaciones de negocio.

## Entrega acordada: Operaciones de inventario v0.4

- El registro de entrada parte sin artículo preseleccionado; la selección se realiza por nombre, SKU o código de barras.
- Inventario permite dar de alta un artículo nuevo y registra su existencia inicial como entrada de Kardex.
- El alta de artículos permite buscar o crear, sin abandonar el formulario, categorías, marcas, unidades y ubicaciones; la opción elegida queda aplicada al artículo creado.
- Cada artículo nuevo define unidad de consumo, presentación de compra y equivalencia. El stock inicial y el costo unitario se calculan en la unidad de consumo.
- `/movements` presenta únicamente el Kardex, sin mezclar catálogo, costos por obra ni alertas. El Kardex es un libro mayor: toda entrada, salida, devolución, ajuste o traslado pasa por una RPC transaccional y conserva saldo antes/después, actor, fecha y auditoría.
- Todo comprobante, remisión, informe imprimible o documento exportable debe usar el activo oficial `public/rfc-logo.svg` como membrete; no se emplean siglas tipográficas como sustituto.
- El sitio institucional ya envía las solicitudes a la Edge Function `contact-form`; falta configurar los secretos del proveedor, desplegarla y validar una entrega real (R-006/SITE-002).
- Las salidas se limitan a obras activas. El modelo de datos incorpora compras/recepciones, conteos físicos, ubicaciones detalladas, puntos de reorden, ajustes de presupuesto y auditoría.
- Una requisición se crea desde la obra por maestro o residente; pasa a la bandeja de despachos del almacén, donde se valida disponibilidad, se despacha y se genera el movimiento de Kardex asociado a la obra.
- Al crear un proyecto se selecciona su tipo (Obra, Mantenimiento u Otro). El sistema asigna un código ineditable con prefijo y consecutivo independientes por tipo y fecha de inicio: `OBRA-AAAAMMDD-##`, `MANT-AAAAMMDD-##` u `OTRO-AAAAMMDD-##`.
- Los perfiles que ya tienen rol y empresa en Supabase se sincronizan con el directorio de empleados, preservando sus roles y sin duplicar fichas laborales existentes.
- El acceso ofrece recuperación por correo y cambio voluntario de contraseña. Supabase Auth administra las credenciales; la aplicación nunca las almacena.
- La administración de empleados usa acciones y modales para registrar fichas, editar datos y gestionar accesos; evita formularios permanentes que sobrecarguen la pantalla.
- Los campos de valores monetarios en COP se formatean al perder foco, usando símbolo `$` y separador de miles colombiano; al enfocarlos se habilita la edición numérica.
- Después de crear y seleccionar una obra, la pestaña Personal de obra permite elegir un empleado del directorio, agregarlo a la lista de personal y retirarlo si se asignó por error.
- Cada despacho registra automáticamente la fecha y hora de entrega en el movimiento y en su remisión. Al finalizar una obra se captura por separado la fecha real de entrega, que puede anticiparse a la fecha estimada.
- La pestaña Herramientas y Equipos en Custodia incluye el botón Asignar herramienta, permite asignar una unidad disponible a una persona del equipo de obra, registrar fecha prevista y observaciones, confirmar la devolución o anular una asignación hecha por error.
- El catálogo clasifica operativamente cada artículo como Material/Insumo, Herramienta, Equipo o Dotación/EPP. Las asignaciones de custodia solo ofrecen Herramientas y Equipos disponibles y permiten buscarlos por nombre, código, marca o categoría.
- Las pestañas de obra se presentan en el orden operativo: Materiales e insumos, Herramientas en custodia, Personal de obra, Requisiciones y, al final, Ajustes de presupuesto como consulta informativa; cada una tiene un icono SVG propio.
- Configuración de inventario dispone formularios con controles alineados e icono SVG. La búsqueda de catálogo muestra coincidencias en vivo y, al elegir una, restablece filtros restrictivos para presentar el artículo seleccionado.
- El manual de usuario de RFC Enterprise documenta los procedimientos de acceso, inventario, movimientos, conteos, obras, informes, empleados y permisos.
- La pestaña Bajas de Inventario registra salida por deterioro, daño, vencimiento, pérdida u obsolescencia, con evidencia fotográfica en bucket privado, valorización al costo vigente y umbral de aprobación configurable por empresa; las bajas sobre el umbral quedan pendientes de un administrador y no descuentan existencias hasta su autorización.
- La base de datos de proveedores y su vinculación con materiales y equipos queda creada sin interfaz, lista para el módulo de Compras y Proveedores: cada artículo admite varios proveedores con precio, unidad de compra, plazo y mínimo a pedir, de los cuales uno es el preferido (ADR-093).
- Cada actividad muestra su costo por unidad de forma explícita: costo directo total ÷ cantidad de la actividad, junto al precio de venta por unidad. Si la cantidad está en 1 o sin definir, el sistema advierte que el costo por unidad todavía no es confiable (ADR-095).
- El módulo de APUs se entra limpio desde el menú: sin contexto de cotización y mostrando únicamente actividades generales, sin vincular a una cotización. Los APUs de una cotización se muestran exclusivamente cuando se ingresa mediante “Gestionar APU” desde esa cotización (ADR-096).
- Desde la vista general de APU se puede buscar una cotización por código, cliente o nombre y abrir su contexto de análisis; la navegación conserva la cotización seleccionada en la URL para que el enlace sea directo y compartible.
- La ficha de una actividad muestra únicamente sus propias cifras (precio de venta, precio de venta por unidad y costo por unidad con su operación costo total ÷ cantidad). El encabezado usa una rejilla de dos columnas para que las cifras conserven su tamaño aunque el nombre de la actividad sea largo. El resumen que suma todas las actividades del presupuesto se presenta en una barra propia a nivel de módulo, solo en pesos, indicando además cuántas actividades están aún sin cotizar. No se suman unidades de medidas distintas (ADR-097).
- El campo de tarifa base de cada línea del APU es editable y se muestra formateado como moneda al salir o al tabular, numérico mientras se escribe.
- Los cuatro rubros del APU (equipos, materiales, mano de obra y transporte) se pliegan y se despliegan uno por uno, con los botones "Expandir todo" y "Plegar todo". Plegado, cada rubro conserva visible su número de recursos y su costo base. La preferencia de qué rubros quedan plegados se recuerda en el navegador (ADR-098). El panel de faltantes para ejecutar el APU también se pliega.
- El alta de una actividad se hace desde un modal que pide nombre, unidad y cantidad de obra; los botones "Nuevo APU" e "Importar desde Excel" están al tope de la lista de actividades para que no queden fuera de vista cuando hay muchas.
- Las cantidades y los rendimientos del APU aceptan decimales escritos con coma o con punto y, al salir del campo o al tabular, se presentan con maximo dos decimales en formato colombiano. Aplica a la cantidad de obra, a la cantidad y el rendimiento de cada recurso, y a los valores de los resumenes y de los faltantes. No se usa el control numerico del navegador porque su separador decimal depende de la configuracion regional y no es confiable (ADR-102).
- Los rubros del APU se pliegan con un boton de tamano comodo y su icono deplegable ampliado, para que se distinga de un vistazo si un rubro esta abierto o cerrado.
- Los porcentajes de ganancia por rubro se guardan en la base de datos con la actividad: al recargar el módulo se conservan los valores que el usuario dejó y no vuelven a los predeterminados (ADR-099).
- Cuando un material, equipo, cargo o transporte no aparece en el catálogo, se ingresa con un formulario que propone el texto ya buscado y pide la tarifa; al aceptar, la línea entra a la actividad y el buscador queda en blanco (ADR-100).
- El APU se importa desde el mismo libro que exporta el sistema y desde el formato histórico de RFC: el archivo se lee en el navegador, detecta cada hoja de actividad como un APU independiente y excluye automáticamente hojas auxiliares de catálogos, dotación, salarios y resúmenes. Las secciones de equipos, materiales, mano de obra y transporte se reconocen por rótulos y columnas, no por números fijos de fila, por lo que cada rubro puede crecer o reducirse. Antes de guardar se marcan con casillas una o varias hojas de actividad, se puede seleccionar todo, se revisa una vista previa por hoja y las líneas sin cantidad se señalan y pueden entrar con cantidad 1 o quedar fuera. La exportación genera un único libro RFC con la hoja inicial `RESUMEN ACTUALIZADO` y una hoja oficial por cada actividad del contexto actual, con bloques y subtotales dinámicos por rubro (ADR-094, ADR-101, ADR-103, ADR-107).
- Los formatos institucionales muestran la firma oficial de Jorge Figueroa Castro como representante legal: APU imprimible y XLSX, propuestas comerciales, vales de salida y facturas de alquiler. Las firmas de cliente, residente o receptor se mantienen como evidencia individual y no se reemplazan (ADR-104).
- Los procedimientos de trabajo y las matrices de riesgos enviados al cliente pasan por control de versiones: se elaboran en Cotización en proceso, se remiten para revisión, pueden volver a Por modificar con observaciones y solo la versión re-aprobada permite confirmar la cotización y convertirla en Obra para iniciar ejecución (ADR-105).
- La pestaña Documentos técnicos de la cotización exige el procedimiento de trabajo y la matriz de peligros, riesgos y controles. Acepta PDF, DOC o DOCX hasta 15 MB en almacenamiento privado; conserva versiones, observaciones y estado de revisión. El RPC de conversión verifica en base de datos que ambas versiones vigentes estén aprobadas antes de crear la Obra (ADR-106).
<!-- Registro 2026-10-01: `/quotes` se compone dentro de DashboardShell; conserva barra lateral, menu movil y control de sesion del portal. -->
<!-- Registro 2026-10-01: el Kanban de `/quotes` presenta el tramo completo de ejecucion: En ejecucion, Trabajo terminado, Pendiente pago y Cerrado. -->
<!-- Registro 2026-10-01: el Kanban de `/quotes` deriva sus columnas del catalogo unico de 12 estados; ningun estado seleccionable queda oculto. -->
<!-- Registro 2026-10-01: convertir una cotizacion confirmada crea una Obra activa persistente, enlaza ambos registros y la presenta en `/projects`. -->
<!-- Registro 2026-10-01: se crea el modulo `/apu` para construir analisis de precios unitarios por actividad, con rubros de materiales, equipos/herramientas, mano de obra y transporte enlazados al catalogo de Inventarios. -->
<!-- Registro 2026-10-02: APU incorporara consulta, modificacion y exportacion segun permisos del empleado. La exportacion XLSX usara una plantilla aprobada sin alterar anchos, altos, celdas combinadas, formulas, estilos ni configuracion de impresion; el PDF comercial se definira con las muestras suministradas por el usuario. -->
<!-- Registro 2026-10-02: Cotizaciones adopta una plantilla comercial premium A4 basada en COT-116, COT-119, COT-121 y COT-128: logo, marco, franja verde, tabla economica, subtotal, IVA, total, condiciones, firma autorizada y fecha. -->
<!-- Registro 2026-10-02: Mano de obra del APU consulta en Supabase el catálogo de 68 cargos del tabulador salarial suministrado; permite buscar por cargo, código o especialidad, filtrar actividades propias/no propias y conserva un respaldo local para contingencias. -->
<!-- Registro 2026-10-02: el editor APU incorpora guardado explícito con confirmación, edición de la actividad seleccionada y eliminación aislada del APU abierto. -->
<!-- Registro 2026-10-02: Dashboard incorpora un control de barra lateral contraíble en escritorio; la preferencia se conserva localmente y en móvil se mantiene el menú completo con etiquetas. -->
<!-- Registro 2026-10-02: APU v0.2 persiste análisis, versiones y líneas en Supabase; un APU guardado genera una versión trazable y puede vincularse como ítem BOQ a una obra para controlar presupuesto, compromiso y costo real. -->
<!-- Registro 2026-10-02: quedan priorizadas para fases posteriores la clasificación configurable (RFC/CSI/UniFormat/ICMS), precios y proveedores, cuadrillas/rendimientos, compras automáticas, órdenes de cambio, evidencias, AIU y permisos finos de aprobación. -->
<!-- Registro 2026-10-02: Supabase tiene desplegado el esquema de Cotizaciones (`quotes` y `quote_history`) con RLS; el historial remoto y los archivos locales de migración quedan reconciliados para despliegues repetibles. -->
<!-- Registro 2026-10-02: APU permite presupuestar materiales, equipos y herramientas que aún no están registrados en Inventarios como recursos manuales del análisis; no se crean existencias ni se modifica el catálogo sin un alta formal. El selector de mano de obra consulta explícitamente la empresa de la sesión y conserva el respaldo local si no puede acceder a la base. -->
<!-- Registro 2026-10-02: el APU reemplaza listas nativas extensas de Inventarios por una búsqueda contextual con máximo seis resultados, scroll interno y alta manual visible; el control no puede expandirse fuera del módulo y se adapta a escritorio, tableta y móvil. -->
<!-- Registro 2026-10-02: se incorpora el Catálogo Maestro de Transporte y Fletes para APU modelado según Odoo Fleet y estándares de costos de logística en construcción (volquetas, camas bajas, cama alta, camión doble cabina, camionetas 4x4, busetas de personal, fluvial, carrotanques). Incluye CRUD completo conectado a Supabase y respaldo local. Las líneas APU almacenan su propia instantánea de tarifa, garantizando que futuras modificaciones de precios en el catálogo jamás alteren APUs anteriores ni presupuestos cerrados. -->
<!-- Registro 2026-10-02: Cotizaciones presenta los datos de cliente como pares etiqueta/valor y adapta ficha, acciones, Kanban y tabla a escritorio, tableta y móvil. Los planos y soportes se registran al recibir la solicitud, antes de la revisión; el APU se gestiona únicamente en Cotización en proceso o Por modificar. -->
<!-- Registro 2026-10-02: el Resumen Ejecutivo recupera indicadores transversales de Cotizaciones, APU y Obras; muestra ofertas en costeo/revisión, APUs vinculados y alerta accionable para cotizaciones en proceso sin APU. -->
<!-- Registro 2026-10-19: el Resumen Ejecutivo y el informe de APU leen los análisis con el mapeo del módulo APU (empresa activa, sin archivados) mediante `listApuAnalyses()`. Se corrigen el indicador "APUs vinculados a cotizaciones" y los totales por actividad, que aparecían en 0 porque la pantalla leía `apu_analyses` en crudo y buscaba `quoteId` sobre columnas snake_case (`quote_id`). -->
<!-- Registro 2026-10-02: Inventarios admite sinónimos técnicos, comerciales o regionales por artículo (por ejemplo, gato/vástago hidráulico y pulidora/esmeril/amoladora) sin sustituir el nombre técnico oficial; la búsqueda se comparte con APU. -->
<!-- Registro 2026-10-02: Guardar APU comunica su resultado de forma verificable: durante la operación indica guardando; al finalizar diferencia persistencia correcta en base de datos, guardado solo local y error. -->
<!-- Registro 2026-10-02: el Dashboard presenta un Centro de Atención con alertas enlazadas a Cotizaciones, APU, Inventario y Obras. Incluye vencimiento, estancamiento, falta de APU, stock mínimo, presupuesto crítico y requisiciones pendientes. -->
<!-- Registro 2026-10-02: las vistas previas imprimibles de APU y Cotizaciones usan desplazamiento interno, barra de controles superior fija y botones de cierre al inicio y al final del documento. -->
<!-- Registro 2026-10-02: Cotizaciones incorpora ayuda contextual sobre el flujo de estados en la cabecera y en el cambio de estado; explica registro/revisión, elaboración APU, envío, confirmación/obra, ejecución y retorno Por modificar. -->
<!-- Registro 2026-10-02: cada columna del Kanban de Cotizaciones incorpora ayuda contextual específica para su estado, con la acción operativa esperada desde Recibido hasta Cerrado o No adjudicado. -->
<!-- Registro 2026-10-02: el formato comercial imprimible de Cotizaciones expresa el valor total en letras, en mayúsculas y con la terminación PESOS COLOMBIANOS M/L, además de la cifra numérica. -->
<!-- Registro 2026-10-02: la propuesta muestra solo el valor en letras bajo VALOR A PAGAR, pues el total numérico ya se presenta en la tabla. Las Notas para la propuesta se editan en Datos Generales y se imprimen inmediatamente debajo del valor en letras. -->
<!-- Registro 2026-10-02: Notas para la propuesta admite múltiples líneas; cada renglón guardado se imprime como una fila independiente debajo del valor en letras. -->
<!-- Registro 2026-10-02: la relación Cotización-Obra es bidireccional: una cotización adjudicada abre su obra y la ficha de obra muestra su Cotización de origen con retorno directo al detalle comercial. -->
<!-- Registro 2026-10-02: el historial de una cotización se presenta como línea de tiempo con eventos separados: responsable, fecha, transición de estado y nota en bloques legibles; el control de actualización se adapta a móvil. -->
<!-- Registro 2026-10-07: Alquiler rápido evoluciona a cabecera de entrega/factura y líneas de equipo; una firma y un documento pueden cubrir varios equipos, con devolución parcial por línea. -->
<!-- Registro 2026-10-07: Operaciones de obra persiste personal asignado, reaperturas, ajustes presupuestales, líneas de requisición, categorías, ubicaciones y responsable de Kardex. La interfaz confirma únicamente respuestas exitosas de base de datos. -->
<!-- Registro 2026-10-07: El sitio público de inicio adopta el sistema visual RFC Graphite: superficies oscuras, borde técnico, tipografía Inter, acciones monocromas y movimiento sutil compatible con reducción de movimiento. Los módulos operativos conservan su interfaz propia. -->
<!-- Registro 2026-10-07: La landing conserva únicamente el video de metalmecánica; portada y sección de fabricación usan imágenes editoriales propias. Su movimiento se limita a malla luminosa, barrido espectral, entrada de contenido y microinteracciones, siempre respetando `prefers-reduced-motion`. -->
<!-- Registro 2026-10-07: La composición pública usa franja contextual, navegación contenida, geometría luminosa y mosaico asimétrico de capacidades. Los efectos de puntero, revelado y brillo se limitan a capas decorativas y nunca mueven texto ni controles. -->
## Persistencia operativa (actualización 2026-10-06)

Inventarios y Movimientos confirman altas, entradas, salidas, mínimos, ubicaciones y obras en Supabase antes de reflejarlas en pantalla. La creación de artículo usa una operación transaccional que registra ficha, existencia y movimiento de apertura como una sola unidad.

Resumen ejecutivo e Informes se alimentan de las tablas de Inventario, Proyectos, Requisiciones, Cotizaciones y APU; no leen ni guardan indicadores operativos en el navegador.

Conversión Cotización → Obra: al 1-click el sistema crea la obra en `projects` con empresa, sede, código, presupuesto, fechas y cliente; guarda `project_id`/`project_code` en la cotización, la mueve a “En ejecución” y registra el evento en `quote_history`. Sin persistencia local de negocio; el consecutivo es por empresa y el constraint `unique(company_id, code)` garantiza no duplicados.

Visitas técnicas: una cotización o obra admite varias visitas numeradas (`VISITA-01`, `VISITA-02`…) en `quotes.technical_visits`. Cada visita registra fecha y hora, responsable, checklist por tipo de servicio, mediciones, fotografías, coordenadas, firma de cierre y acta imprimible; los faltantes detectados generan una requisición real al almacén.

Circuito de abastecimiento (pendiente el eslabón de compra): APU → conversión a obra → requisición al almacén → **orden de compra (COM-01, no construido)** → entrada al inventario → despacho a la obra. El APU costea el requerimiento aunque el artículo no tenga existencias hoy.
<!-- Registro 2026-10-08: La portada pública usa una secuencia WebP del logo RFC controlada por desplazamiento: al bajar avanza y al subir retrocede, sin video ni imagen-póster intermedia. La vista explosiva de estructura emplea una segunda secuencia con el mismo comportamiento dentro de su panel; ambas cargan fotogramas por proximidad, conservan una imagen inicial y respetan reducción de movimiento. La composición se adapta a una columna desde 860 px y a acciones de ancho completo desde 520 px. -->

- **Tablas salariales versionadas (en curso):** Configuración incorpora Costos y tablas salariales para administrar tablas de mano de obra por cliente, vigencia, actividad y cargo; Cotizaciones selecciona una tabla y conserva su copia de valores.


- **Costos / tablas salariales (2026-10-08):** la tabla elegida por cada cotizaci�n alimenta el selector de cargos del APU. Se persiste el v�nculo cargo�nivel�tabla y se distingue auxilio legal de transporte de vi�ticos operativos. Pendiente: ampliar el importador para Word/PDF con una etapa de revisi�n humana; Excel ya usa mapeo y vista previa.

- **Consulta de tabla salarial (2026-10-08):** al abrir una tabla vigente en Configuraci�n se muestran sus niveles, puestos asociados, componentes oficiales y total d�a en una vista de consulta equivalente al Excel exportado. En m�vil la tabla conserva sus columnas dentro de un contenedor desplazable, sin romper el ancho de la pantalla.

- **Costos / correcci�n de fuente oficial (2026-10-08):** el detalle y el APU consumen el `Total d�a` publicado por cada tabla salarial. Se retir� el rec�lculo que lo sobrescrib�a y la consulta solo presenta los componentes presentes en la fuente.


## Cat?logo oficial de cargos por tabla salarial (2026-10-08)

Cada tabla salarial conserva dos capas: los valores documentales del nivel y el cat?logo completo de cargos asociado a ese nivel. Se cargaron 68 puestos de OCENSA, 158 de CENIT 2026 y 119 de ODC 2025 seg?n las fuentes entregadas. La consulta y la exportaci?n muestran ambas capas, sin duplicar ni alterar los valores oficiales.


<!-- 2026-10-08: Correction: the 68 OCENSA positions are the pre-existing mapped catalogue, not a verified complete transcription of all own-activity positions. Complete the OCENSA own-position map only from its official role-to-level annex; do not infer it from CENIT or ODC. Official source views exclude provisions and extra-hour references. -->

<!-- 2026-10-08: A job title is reusable across companies, but its salary mapping is never global. labor_rate_roles is scoped by company_id, labor_rate_table_id and labor_rate_entry_id, so the same title may map to a different level and official value for each company, contract/version and validity period. -->

<!-- 2026-10-08: Salary tables uploaded for each company are documentary source data and mandatory inputs to the contractor calculation model. They are not standalone APU final costs: RFC preserves published values, then derives project/APU cost in a separate auditable snapshot without modifying the source table. -->

<!-- 2026-10-08: Cotizaciones incorpora el paso Costeo de mano de obra. La selecci?n contractual agrupa las escalas de un mismo cliente/versi?n en una sola tabla visible; el usuario define condiciones de obra y cuadrilla antes de abrir APU. -->

<!-- 2026-10-08: El costeo de mano de obra en Cotizaciones solo estima costos para APU; RFC Enterprise no reemplaza el software de n?mina ni liquida aportes laborales. -->

<!-- 2026-10-09: La portada conserva el video de soldadura en movil, sin parallax en pantalla compacta y con alternativa estatica al reducir movimiento. -->

+<!-- 2026-10-09: La ruta no encontrada tiene una experiencia RFC propia: orienta al visitante a portada o portal, con animacion CSS ligera y respuesta movil. -->

## Parametros nacionales de costo laboral (2026-10-09)

Configuracion incorpora la pestana **Parametros laborales**. Sus porcentajes viven en `labor_cost_parameters`, una tabla nacional y extensible: se pueden modificar, desactivar o agregar sin editar codigo. Solo administracion, ingenieria residente y gerencia general pueden cambiarlos; los demas miembros autenticados los consultan. Cada parametro declara base, efecto y divisor. Al cambiarlo, la base recalcula los costos vigentes y las cotizaciones nuevas guardan una copia de los parametros utilizados.

## Dotacion reutilizable y entrega operativa (2026-10-09)

Separa el costo de dotacion del movimiento fisico. Los perfiles reutilizables permiten que un mismo oficio comparta dotacion entre tablas salariales de OCENSA, CENIT y ODC, con excepciones por cargo. Una entrega se registra contra trabajador y obra, crea un movimiento de inventario y descuenta existencias dentro de la misma transaccion.

## Estimado inicial plegable (2026-10-09)

La creacion de cotizaciones mantiene plegados el estimado comercial y la planeacion preliminar de cuadrilla. Son opcionales y solo se abren para respuesta rapida, viabilidad o preparacion antes del APU; no bloquean la creacion de una solicitud ni sustituyen el costo tecnico final.

## Criterios de jornada y productividad para APU (contexto, 2026-10-09)

Para el costeo RFC se manejaran por separado: jornada ordinaria programada de 42 horas semanales (lunes a viernes, con almuerzo no laborado), dias fisicos de produccion, dias calendario remunerados y horas efectivas de produccion. Como supuesto inicial para estaciones OCENSA se reconoce 5,333 horas productivas por dia; es configurable por frente, actividad y restriccion operativa, no una jornada legal ni un rendimiento obligatorio.

## Precosteo laboral con dias fisicos y remunerados (2026-10-09)

El estimado opcional de cuadrilla calcula dias fisicos de lunes a viernes y propone dias remunerados con la regla presupuestal 7/5; ambos quedan editables para festivos, novedades y tarifas que ya incluyan descansos. La mano de obra usa los dias remunerados; productividad, rendimientos y horas extras usan dias fisicos. Alojamiento y viaticos conservan su propia cantidad de dias.

**Extras del precosteo:** no se prorratean automaticamente desde las referencias historicas de una tabla. Inician en cero y se ingresan segun el turno o programacion real del periodo; los dias fisicos ayudan a revisar su coherencia, pero no crean recargos por si mismos.

**Duracion sin fechas:** el precosteo no exige inicio ni fin. El usuario estima dias fisicos mientras construye la oferta; las fechas viven en un calendario opcional de programacion. Al desarrollar cada APU, cantidad, rendimiento y cuadrilla seran la fuente tecnica de los dias fisicos.

## Fechas comerciales de la solicitud (2026-10-09)

Cotizaciones diferencia la fecha de llegada real del correo o solicitud de la fecha maxima que el cliente dio para entregar la cotizacion. La segunda es opcional y representa un compromiso comercial, no la fecha de inicio o duracion de la obra. Las horas productivas de ejemplo no se capturan ni persisten en el precosteo.

## Condicion de pago proporcional (2026-10-09)

La solicitud nueva define anticipo y contraentrega mediante un control proporcional: ambos siempre suman 100 %. El valor se conserva como condicion comercial legible en la cotizacion y propuesta; no es un costo ni altera el precosteo.

## Condicion de pago definida al crear la cotizacion (2026-10-09)

El control comercial no impone 50/50: inicia en 0 % de anticipo y 100 % de contraentrega. Al moverlo, ambos valores se complementan hasta 100 %. La cotizacion solo confirma exito cuando la escritura en la base de datos responde correctamente.

## Expediente comercial de la cotizacion (2026-10-14)

La ficha de la cotizacion incorpora una seccion **Expediente comercial** que conserva los soportes de la relacion con el cliente: solicitud original, planos, correos y soportes, orden de servicio y aprobacion del cliente. Cada soporte tiene tipo, nombre, fecha, responsable y su archivo o enlace.

El expediente es **aditivo y separado** de los documentos tecnicos (procedimiento de trabajo y matriz de riesgos): no los reemplaza, no participa de la conversion a obra y no altera el flujo de estados. Los archivos viven en el bucket privado `quote-commercial-documents` y se abren con URL firmada de corta duracion; tambien se admite un enlace externo (Drive, OneDrive, SharePoint) en lugar de archivo, nunca ambos. Cada alta, confirmacion de subida y eliminacion queda en `public.audit_logs`.

## Comparador de revisiones (2026-10-14)

Vista de **solo lectura** para contrastar dos revisiones de la misma cotizacion (por ejemplo R1 contra R2). Marca en ambar unicamente los campos que cambiaron y muestra en neutro los que se mantienen, para que el contexto siga siendo legible. Compara valor total, desglose de costeo, APU/actividades, alcance y notas, condiciones de pago, vigencia, plazo de entrega y fechas.

No crea revisiones ni permite editar: la foto de cada revision la toma un trigger al guardar la cotizacion, asi que el flujo actual de "Crear revision" queda intacto. Las revisiones anteriores a esta migracion no tienen foto historica y el comparador lo explica en pantalla en vez de inventar diferencias. Funciona en escritorio y movil sin desplazamiento horizontal de la pagina.

## Indicadores comerciales de Cotizaciones (2026-10-14)

Informes incorpora una vista de indicadores calculada sobre datos reales de `quotes` y `quote_history`: cantidad y valor ganado/perdido, tasa de adjudicacion, tiempo promedio por etapa, cotizaciones vencidas o sin seguimiento y motivos de perdida. Admite filtros por periodo, responsable y cliente. Es de solo lectura y cada consulta queda registrada en `public.audit_logs` con los filtros aplicados. Ruta propia: `/reports/cotizaciones`, aislada de la pantalla general de Informes.

## Dotacion por cargo, cotizacion y obra (2026-10-09)

La matriz de dotacion ahora conserva por articulo la cantidad, el valor y la frecuencia de reposicion en dias fisicos. Al configurar la cuadrilla de una cotizacion, el valor de dotacion se calcula por cargo con los dias fisicos estimados y se guarda dentro de la instantanea que consume el APU. En Proyectos > Personal de obra aparece Entrega de dotacion: el encargado escoge trabajador, tipo de movimiento y uno o varios articulos, por ejemplo dos uniformes y un casco, en un solo comprobante.

## Invitaciones, contacto e importación de inventario (2026-10-20)

**Empleados (R-007).** La ficha de Empleados incorpora una tarjeta de acceso al portal con el estado de la identidad de Supabase Auth. El administrador puede invitar por correo, vincular una cuenta existente y enviar un enlace de recuperación, sincronizar el rol base y la sede en `user_roles`, y actualizar el estado sin crear columnas nuevas. El detalle operativo y las variables de entorno están en [19 · Invitaciones, contacto e importación](19-invitacion-empleados-contacto-e-importacion.md).

**Portada (R-006).** El formulario de contacto ya no abre `mailto:`. Envía la solicitud a la Edge Function pública `contact-form`, que valida, aplica honeypot, trampa de tiempo, CORS y rate limit, y entrega por Resend al buzón corporativo. No persiste datos personales ni usa `localStorage`. Queda pendiente configurar los secretos, desplegar y probar una entrega real.

**Inventario (INV-011).** La ruta `/inventory/import` acepta CSV/XLSX de hasta 500 filas, muestra vista previa, resumen de errores y confirmación explícita. Cada fila válida crea un artículo nuevo con existencia de apertura usando la RPC existente y el JWT del usuario; el lote se registra en `audit_logs`. Es una operación de altas: no actualiza artículos existentes. La unicidad durable de SKU queda como riesgo INV-026 porque la base no tiene restricción única.

## Actualizacion 2026-10-20 - Conteo inicial colaborativo

Inventarios incorpora una jornada inicial colaborativa: fotografia de saldos en Supabase, avance persistido por articulo, responsable y fecha, hallazgos de articulos nuevos en borrador y conciliacion atomica al completar toda la bodega.
- **Integridad de consultas de inventario (2026-10-22):** las relaciones de existencias, articulos y Kardex se consultan por nombre de llave foranea para convivir con las llaves compuestas de aislamiento por empresa. Esto evita ambiguedades del API sin debilitar RLS ni modificar saldos.


## Dashboard ejecutivo — Bloque crítico (DASH-001 a DASH-005)

Actualizado el 2026-10-22. El Dashboard aplica una guarda de servidor por permisos efectivos y no serializa costos unitarios al cliente sin dashboard.financials.view. La etapa actual corrige permisos, visibilidad financiera, alertas durante la resolución de permisos, cálculo de ejecución sin tope artificial y validaciones de formularios. El rediseño, filtros e inteligencia gerencial quedan fuera de este bloque.


### Cierre operativo DASH-002 y DASH-003 (2026-10-22)

El Dashboard ahora comunica estados de carga, sin datos, datos parciales y error para sus indicadores; los estados parcial y error ofrecen reintento. El centro unificado de alertas en la barra global tambien permite reintentar una consulta fallida. La visualizacion del porcentaje conserva el sobrecosto real, pero limita solo el ancho visual de la barra a 100 %.

### Conteo fisico - carga paginada (2026-10-22)

La jornada de conteo carga las lineas y hallazgos en lotes de 100 registros, evitando que una primera pagina con relaciones anidadas exceda el timeout en bodegas grandes. El timeout de las RPC queda como respaldo controlado en una migracion pendiente de aplicar, no como sustituto de la paginacion.

### Dashboard ejecutivo - analitica etapa 1 (2026-10-22)

/dashboard incorpora cinco graficos con agregados reales protegidos: cotizaciones mensuales, estados de cotizacion, obras por estado, inventario critico y jornadas por dia. Cada panel indica periodo, enlace de origen y Sin datos. Costo real, avance y rentabilidad siguen bloqueados hasta verificar sus fuentes.


### Ajuste de jerarquia del Dashboard (2026-10-22)

Se retiraron Nuevo vale de salida y Solicitud de obra del encabezado ejecutivo. Son operaciones de Inventario y permanecen en su flujo especializado; el Dashboard prioriza indicadores, alertas y enlaces de consulta.


### Attendance Enterprise V2 (2026-10-22)

/attendance distingue Mi jornada del empleado y Consulta de jornada de supervision; estados pending, open, closed y needs_review se modelan explicitamente, con resumen previo al cierre, aviso al alcanzar 800 registros y acciones moviles de 44 px. No cambia RPC, RLS ni migraciones.


### Reestructuración de Personal y accesos, Mi cuenta y Configuración (2026-10-22)

Evolución de `/employees`, `/perfil` y `/settings` hacia una arquitectura modular corporativa (ADR-175, doc 20):
- **Personal y accesos (`/employees`):** Subdividido en cuatro vistas: Directorio de personal, Ficha del empleado, Cuentas e invitaciones, y Roles y permisos. Las asignaciones de rol y creaciones son atómicas vía RPC; las desactivaciones de empleados bloquean de inmediato todos los permisos en backend sin recurrir indebidamente a `user_roles`. Se protege la cuenta del último administrador.
- **Mi cuenta (`/perfil`):** Se traslada del menú lateral al menú de usuario del avatar. Conserva la ruta para compatibilidad y presenta información personal, estado de seguridad y permisos asignados en solo lectura.
- **Centro de configuración (`/settings`):** Transición a menú lateral categorizado: Empresa y sedes, Identidad corporativa, Parámetros comerciales, Costos laborales (tablas y dotación) y Seguridad y auditoría.


### Autoservicio del Empleado: Solicitud de Materiales, Herramientas y Dotación (REQ-OPERATIVO-01)

Acuerdo del 2026-10-22 (ADR-176). Extensión del Portal del Colaborador para digitalizar los pedidos de campo y erradicar solicitudes informales:
- **Casos de uso cubiertos:**
  1. **Materiales y Consumibles de Obra:** Solicitud directa de soldadura, discos de corte, tornillería, cables o insumos para un frente de trabajo o proyecto específico.
  2. **Herramientas en Custodia:** Solicitud de préstamo temporal de equipos para la jornada (taladros, pulidoras, equipos de medición).
  3. **Dotación y EPP:** Solicitud de reposición justificada por desgaste (botas, guantes, cascos, gafas, uniformes).
  4. **Novedades Laborales:** Justificación de asistencias, permisos y solicitud de certificados laborales.
- **Flujo y Reglas de Negocio:**
  - El empleado **no tiene visibilidad de costos unitarios, márgenes ni precios de compra**; la interfaz opera exclusivamente con unidades físicas.
  - Toda solicitud entra en estado `Pendiente de aprobación` y notifica al Supervisor de Obra o Residente a cargo.
  - El supervisor valida técnicamente y aprueba o ajusta la cantidad solicitada.
  - Una vez aprobada, la solicitud pasa a la bandeja de Bodega para emisión del vale de salida o generación de orden de compra si no hay stock disponible.
- **Punto de acceso previsto:** Pestaña *«Mis solicitudes»* dentro de **Mi cuenta** (`/perfil`) y vista adaptada para dispositivos móviles.

### Endurecimiento P0 de Personal, Mi cuenta y Configuración (2026-10-23)

Se eliminaron los fallbacks directos del navegador en `employees-workspace.tsx`: crear empleado, cambiar rol y activar/desactivar ahora dependen exclusivamente de las RPC atómicas. Las excepciones individuales de permisos pasan por `admin_set_employee_permission_override`. La configuración empresarial usa `save_company_settings` y `save_company_profile` con autorización por empresa y auditoría. La ruta de `company-branding` incorpora el id de la empresa y las políticas de Storage se limitan a administradores de esa empresa. La migración `20261023010000_admin_fix_security.sql` queda pendiente de aplicar y validar en Supabase.

### Fotografía o avatar por perfil (idea 2026-10-23)

Cada empleado puede subir su propia fotografía; si no lo hace, el sistema muestra un avatar por defecto asociado a su cargo (por ejemplo, una figura de soldador para un soldador). La foto se guarda en un bucket privado por empresa y empleado, con URL firmada y consentimiento explícito. El avatar por defecto es solo una ilustración de interfaz: no reemplaza la identificación formal ni la firma digital.

### Registro asistido por un compañero (idea 2026-10-23)

Cuando un empleado no tiene teléfono propio o lo olvidó, otro compañero autorizado puede registrar su jornada, conteo o actividad en su nombre desde el mismo dispositivo. La operación debe quedar registrada con dos identidades: quién digitó (`performed_by`) y a nombre de quién se hizo (`on_behalf_of`). No se implementa todavía; queda como extensión del Portal del Colaborador y de los flujos operativos con trazabilidad y confirmación posterior del titular o del supervisor.



- **Avatar laboral (2026-10-23):** al crear un empleado, Administración elige una colección visual inicial; el oficio se resuelve por job_title. Por ahora se muestra únicamente en Mi cuenta y en el reporte de actividades.

### Firma manuscrita personal en Mi cuenta (2026-10-23)

El empleado autenticado puede registrar y reemplazar su firma manuscrita desde `/perfil`. Se utiliza únicamente en confirmaciones operativas autorizadas y no sustituye la autenticación, la identificación formal ni las firmas institucionales. La persistencia se limita a un registro privado vinculado al empleado activo de la sesión y valida PNG en formato data URL hasta 800 KB antes de guardar.
- Conteos físicos: ficha de artículo propuesta durante el conteo, valoración inicial obligatoria para existencias positivas y lectura paginada segura; pendiente validación SQL controlada antes de aplicar en producción.

## Recuperación del repositorio local — 2026-10-23

- Se detectó corrupción de objetos históricos en la carpeta de trabajo original (`git fsck --full` con objetos faltantes).
- `origin/main` fue verificado como íntegro en el commit `29593c075406cf25fb1f65ca4c0298158e7605f4`.
- Se creó una copia de trabajo limpia en `C:\representaciones-figueroa-recovered`; a partir de este punto es la copia autorizada para continuar el desarrollo.
- La carpeta original se conserva como respaldo y no debe usarse para nuevos commits.
## 2026-10-23 — Actividades delegadas, firma y ajustes operativos

- Se aprobó el flujo de **actividad delegada**: quien registra queda identificado; la actividad queda en `pending_validation` y solo el trabajador beneficiario o un responsable con permiso puede confirmarla o rechazarla. No se crea ni altera una jornada definitiva por medio de un tercero.
- Se incorpora el catálogo de capacidades `attendance.delegated.request` y `attendance.team.review`. Las revisiones de asistencia dejan de depender de una lista fija de roles y consultan permisos efectivos.
- La migración `20261023060000_delegated_activity_validation.sql` crea la bitácora, índices, RLS y RPCs auditadas. Pendiente: aplicar y probar en Supabase antes de habilitar la interfaz productiva.
- El modal de conteo físico se reorganiza con encabezado y acciones fijos; solo el cuerpo se desplaza. En móvil ocupa el alto útil disponible.
- El modal de firma manuscrita se amplía para ocupar prácticamente toda la pantalla móvil y mantiene controles táctiles de 48 px.
- Configuración de empresa vuelve a usar `save_company_profile`, operación atómica para empresa y ajustes, en lugar de dos escrituras separadas que podían fallar parcialmente por RLS.
## 2026-10-23 — Matriz dinámica de permisos de empleados

La ficha de empleados ya no toma una lista estática del cliente para mostrar la matriz de permisos. Carga el catálogo real de `permissions`, lo agrupa por módulo y conserva el cálculo de permisos efectivos con rol base más excepciones auditadas. La escritura sigue pasando por `admin_set_employee_permission_override`; requiere aplicar previamente la migración `20261023010000_admin_fix_security.sql` en Supabase.
## 2026-10-23 — Actividades delegadas trazables en asistencia

- La asistencia incorpora un reporte provisional por compañero: identifica al autor, al trabajador beneficiario, el frente, la actividad y el motivo.
- El reporte no crea ni altera una jornada definitiva. Solo el beneficiario o un responsable con capacidad de revisión puede validarlo o rechazarlo.
- La pantalla ya no bloquea la llegada solo porque la lectura de la ficha falle; el servidor conserva la decisión y devuelve una causa accionable.
- Requiere aplicar en Supabase la migración `20261023060000_delegated_activity_validation.sql` antes de activar esta interfaz en producción.