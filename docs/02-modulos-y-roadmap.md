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
| `core` | Administración | Operativo v0.3 | Directorio persistente de empleados, roles, permisos individuales, activación, auditoría, empresas, sedes y configuración |
| `site` | Sitio institucional | Operativo v0.2 | Portada corporativa ampliada, capacidades, enfoque de trabajo, imágenes sectoriales y formulario de solicitud pendiente de conexión a canal corporativo |
| `dashboard` | Dashboard Ejecutivo | Operativo v0.3 | Panel principal de obras, KPIs financieros consolidados, semáforos y accesos rápidos de almacén |
| `inventory` | Inventarios & Kardex | Operativo v0.4 | Catálogo, kardex separado, búsqueda por SKU/código, control de despachos y modelo de conteos, compras, ubicaciones, alertas y auditoría |
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
- `/movements` presenta únicamente el Kardex, sin mezclar catálogo, costos por obra ni alertas.
- Todo comprobante, remisión, informe imprimible o documento exportable debe usar el activo oficial `public/rfc-logo.svg` como membrete; no se emplean siglas tipográficas como sustituto.
- Las salidas se limitan a obras activas. El modelo de datos incorpora compras/recepciones, conteos físicos, ubicaciones detalladas, puntos de reorden, ajustes de presupuesto y auditoría.
