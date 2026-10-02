---
estado: vigente
propietario: Producto y Desarrollo RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Producto y Desarrollo
---

# Módulos y roadmap

## Módulos de la plataforma

| Código | Módulo | Estado | Alcance actual |
| --- | --- | --- | --- |
| `core` | Administración | Operativo v0.4 | Directorio persistente de empleados, roles, permisos individuales, activación, auditoría, empresas, sedes, sesión y cierre de sesión |
| `site` | Sitio institucional | Operativo v0.4 | Portada corporativa ampliada, capacidades, enfoque de trabajo, imágenes sectoriales, acceso superior al portal de empleados y formulario que prepara el correo para el canal corporativo |
| `dashboard` | Dashboard Ejecutivo | Operativo v0.4 | Panel principal e informes funcionales con filtros, KPIs, gráficos SVG accesibles, exportación CSV, impresión y análisis de inventario, Kardex, stock crítico y obras |
| `quotes` | Cotizaciones & Pipeline | Operativo v0.2 | Tablero Kanban y lista, consecutivo `COT-###-AAAA-EMPRESA-OBRA`, pre-costeo por 3 rubros (Materiales, Cuadrillas, Equipos), control de revisiones (R1/R2), inspección técnica en campo, semáforo de vigencia comercial, conversión 1-click a obra y propuesta membretada imprimible en PDF |
| `inventory` | Inventarios & Kardex | Operativo v0.4 | Catálogo, kardex separado, búsqueda por SKU/código y listas alfabéticas filtrables, alta de artículos con catálogos editables en el mismo modal, control de despachos y modelo de conteos, compras, ubicaciones, alertas y auditoría |
| `projects` | Costeo de Proyectos | Operativo v0.4 | Centro de costos, tipo de proyecto, código consecutivo automático, asignación de empleados, calendario de inicio/entrega estimada, estado de obra, presupuestos y control de sobrecostos |
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
- Persistencia híbrida local e integración con identidad Supabase.

## Entrega acordada: Operaciones de inventario v0.4

- El registro de entrada parte sin artículo preseleccionado; la selección se realiza por nombre, SKU o código de barras.
- Inventario permite dar de alta un artículo nuevo y registra su existencia inicial como entrada de Kardex.
- El alta de artículos permite buscar o crear, sin abandonar el formulario, categorías, marcas, unidades y ubicaciones; la opción elegida queda aplicada al artículo creado.
- Cada artículo nuevo define unidad de consumo, presentación de compra y equivalencia. El stock inicial y el costo unitario se calculan en la unidad de consumo.
- `/movements` presenta únicamente el Kardex, sin mezclar catálogo, costos por obra ni alertas.
- Todo comprobante, remisión, informe imprimible o documento exportable debe usar el activo oficial `public/rfc-logo.svg` como membrete; no se emplean siglas tipográficas como sustituto.
- Pendiente del sitio institucional: sustituir el enlace `mailto:` por envío directo desde una Edge Function de Supabase con proveedor transaccional, validación y protección antispam.
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
