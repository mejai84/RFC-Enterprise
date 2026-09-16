---
estado: vigente
propietario: Producto y Líder de proyecto RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Producto, Desarrollo y Operación
---

# Backlog y riesgos

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
| CORE-002 | Alta | Autenticación y sesión con Supabase Auth | Terminado | Usuario administrador validado y confirmado en base de datos remota |
| VALE-001 | Media | Generación de Vales de Salida imprimibles (Remisión) | Terminado | Formato formal de remisión imprimible con firmas de entregado y recibido |
| REQ-001 | Media | Requisiciones de material desde frentes de obra | Terminado | Solicitud por residente de obra y aprobación por jefe de almacén |
| DEV-001 | Media | Devoluciones de material sobrante a bodega | Terminado | Reingreso de stock y reversión de costo asignado al proyecto |
| EQ-001 | Media | Módulo de equipos y custodia de herramientas | Terminado | Control de préstamo y devolución de herramientas por trabajador |
| QA-001 | Alta | Pruebas continuas y validación de build | Terminado | Validación estática `npm run build` con cero errores |
| INV-003 | Alta | Operaciones auditables de inventario | En implementación | Migración para ubicaciones, compras, conteos físicos, kardex con costos y auditoría bajo RLS |
| INV-004 | Media | Alertas y reportes operativos | En implementación | Punto de reorden, sugerencia de compra, consumo por obra, rotación, inmovilizado y valoración por grupo |

## Riesgos activos

| ID | Riesgo | Impacto | Probabilidad | Mitigación | Dueño |
| --- | --- | --- | --- | --- | --- |
| R-001 | Desconexión temporal de red en frentes de obra | Medio | Media | Persistencia local híbrida (`localStorage` + Supabase sync) | Desarrollo |
| R-002 | Despacho de materiales sin vale de entrega formal | Medio | Baja | Obligatoriedad del número de referencia / orden en el formulario | Almacén |
| R-003 | Desviación presupuestal inadvertida en obras | Alto | Media | Alertas visuales automáticas cuando la obra supera el 80% y 100% de materiales | Producto |
| R-004 | PII o secretos expuestos en código | Alto | Baja | Variables de entorno `.env.local` y claves seguras en Supabase | Operación |
| R-005 | Cambios locales no sincronizados con la base | Alto | Media | Aplicar la migración de operaciones y reemplazar los adaptadores locales por repositorios Supabase protegidos por RLS | Desarrollo |
