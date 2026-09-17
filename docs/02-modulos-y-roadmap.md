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
| `inventory` | Inventarios & Kardex | Operativo v0.4 | Catálogo, kardex separado, búsqueda por SKU/código y listas alfabéticas filtrables, alta de artículos con catálogos editables en el mismo modal, control de despachos y modelo de conteos, compras, ubicaciones, alertas y auditoría |
| `projects` | Costeo de Proyectos | Operativo v0.4 | Centro de costos, calendario de inicio/entrega estimada, estado de obra, presupuestos y control de sobrecostos |
| `equipment` | Equipos & Custodia | Operativo v0.1 | Préstamo y seguimiento de herramientas a cuadrillas y trabajadores por obra |
| `purchases` | Compras | Planeado | Sin implementación |
| `suppliers` | Proveedores | Planeado | Sin implementación |
| `contracts` | Contratos | Planeado | Sin implementación |
| `hr` | Talento humano | Planeado | Sin implementación |
| `apu` | APU | Planeado | Sin implementación |

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
- Los perfiles que ya tienen rol y empresa en Supabase se sincronizan con el directorio de empleados, preservando sus roles y sin duplicar fichas laborales existentes.
- El acceso ofrece recuperación por correo y cambio voluntario de contraseña. Supabase Auth administra las credenciales; la aplicación nunca las almacena.
- La administración de empleados usa acciones y modales para registrar fichas, editar datos y gestionar accesos; evita formularios permanentes que sobrecarguen la pantalla.
- El manual de usuario de RFC Enterprise documenta los procedimientos de acceso, inventario, movimientos, conteos, obras, informes, empleados y permisos.
