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
| UI-003 | Baja | Orden e iconografía de pestañas de obra | Terminado | Materiales, herramientas, personal, requisiciones y ajustes informativos al final, con iconos SVG por función |
| UI-004 | Media | Búsqueda y configuración de catálogo | Terminado | Formularios sin solapamientos, icono de configuración y búsqueda de artículos con coincidencias en vivo |
| SEC-001 | Crítica | Endurecimiento integral de seguridad v1.0 | Terminado | Proxy/Middleware SSR, cookies de sesión, headers HTTP, RLS hardening, política de contraseñas y rate limiting |
| QTE-001 | Alta | Tablero Kanban y pipeline de cotizaciones v0.1 | Terminado | 12 estados operativos, vista Kanban y lista, filtros, badges de estado, consecutivo `COT-AAAA-###`, modal detallado con historial y notas |
| QTE-002 | Media | Persistencia Supabase y conversión a Obra/Proyecto | Terminado | Tablas `quotes` y `quote_history` con RLS, enlace con proyectos existentes y cálculo de estancamiento (>3 días) |

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

