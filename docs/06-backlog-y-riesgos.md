---
estado: vigente
propietario: Producto y Líder de proyecto RFC Enterprise
ultima_actualizacion: 2026-10-06
audiencia: Dirección, Producto, Desarrollo y Operación
---

# Backlog y riesgos

> Actualización 2026-10-06: se reduce el riesgo de unidades inconsistentes en APU mediante selección normalizada; el catálogo mantiene nombres de consulta y persiste únicamente abreviaturas.

Este documento contiene **únicamente el trabajo pendiente y los riesgos abiertos**.
Lo ya resuelto se retiró de aquí y quedó registrado como decisiones en
[07 · Registro de decisiones](07-registro-de-decisiones.md).

## Riesgos abiertos

| ID | Riesgo | Impacto | Probabilidad | Mitigación pendiente | Dueño |
| --- | --- | --- | --- | --- | --- |
| COM-001 | El circuito de abastecimiento no cierra: falta el eslabón de compra | Alto | Alta | El APU costea materiales que pueden no existir en bodega y el flujo termina en la requisición al almacén. Falta un módulo de Compras/Proveedores que genere la orden, registre la entrada al inventario y permita recibir la factura. Circuito esperado: APU → obra → requisición → orden de compra → entrada al inventario → despacho a la obra. | Producto / Desarrollo |
| R-011 | Persistencia local remanente en módulos operativos | Alto | Media | Inventario, Obras, Movimientos, Requisiciones, Préstamos, Conteos, Resumen e Informes ya usan Supabase, al igual que la conversión Cotización→Obra. Quedan restos de escritura dual en **Alquiler Rápido** (`rfc_quick_rentals`) y en el **catálogo de transporte del APU** (`rfc_apu_transport_items`), además de lecturas de respaldo que deben declararse como caché. | Desarrollo |
| R-001 | Desconexión de red en frentes de obra | Medio | Media | Hoy no hay caché operativa: sin conexión el usuario ve un error explícito y no se pierde nada, pero tampoco puede capturar en campo. Evaluar cola de sincronización para lecturas y conteos. | Desarrollo / Operación |
| R-002 | Despacho de materiales sin soporte de entrega formal | Medio | Baja | El vale de entrega ya es obligatorio y firmable; falta exigir referencia de orden o factura cuando el material proviene de compra. | Almacén |
| R-003 | Desviación presupuestal inadvertida en obras | Alto | Media | Existen semáforos por obra y alertas al superar 80 % y 100 % del presupuesto de materiales; falta consolidarlas en el Resumen ejecutivo por proyecto. | Producto |
| R-005 | Cambios locales no sincronizados con la base | Alto | Baja | Se eliminó el respaldo local de negocio en los módulos operativos. Restablecer la alerta si vuelve a aparecer `localStorage` como confirmación de guardado. | Desarrollo |
| R-006 | Solicitudes de la portada sin canal de recepción real | Medio | Alta | El formulario solo prepara el correo del visitante. Falta una Edge Function con proveedor transaccional y protección antispam para que la solicitud llegue al buzón corporativo. | Dirección / Operación |
| R-007 | Empleado sin identidad de acceso al portal | Medio | Baja | La creación de ficha y el restablecimiento de contraseña ya crean la cuenta y su membresía. Falta el proceso de invitar altas desde el propio módulo. | Operación / Desarrollo |
| INV-025 | Unicidad global de códigos de préstamos | Medio | Media | `inventory_tool_loans.code` está declarado `unique` a nivel tabla; debe ser `unique (company_id, code)` para evitar colisiones entre empresas. | Desarrollo |
| INV-024 | Referencias generadas con contador del navegador | Medio | Media | Los traslados ya usan sufijo único. Persisten consecutivos calculados en el cliente (`VALE-AAAA-N` en despachos); deben resolverse en base de datos. | Desarrollo |
| INV-023b | Traslado de ubicación en dos pasos | Medio | Baja | `relocateProduct` registra el movimiento y luego actualiza `inventory_stock.location`; si el segundo paso falla queda el asiento sin el traslado. Envolver en una RPC transaccional. | Desarrollo |

## Entregas pendientes

| ID | Prioridad | Entrega | Criterio de aceptación resumido |
| --- | --- | --- | --- |
| COM-002 | Alta | Módulo de Compras y Proveedores | Catálogo de proveedores, orden de compra generada desde una requisición aprobada, recepción parcial y total, factura asociada y entrada automática al inventario con recálculo de costo promedio ponderado. Base de datos ya creada (ADR-093): `suppliers`, `supplier_products`, vista `item_suppliers_overview` y RPC `create_supplier`, `link_supplier_product`, `set_preferred_supplier_product`. Falta la interfaz |
| INV-009 | Alta | Reposición y sugerencia de compra | Punto de reorden por artículo, propuesta de compra consolidada y recepción parcial |
| TALL-001 | Alta | Orden de taller y remisión de entrega | Recepción de equipo, diagnóstico, trabajo ejecutado, repuestos, entrega con firma en documento institucional imprimible |
| INV-003 | Alta | Operaciones auditables de inventario | Cerrar la migración pendiente de compras y conteos bajo RLS con auditoría completa de responsables |
| INV-004 | Media | Alertas y reportes operativos | Consumo por obra, rotación, inmovilizado y valoración por grupo |
| INV-007 | Alta | Requisiciones y despacho con remisión firmada | Completar el circuito de aprobación y despacho firmado sobre Supabase |
| INV-010 | Media | Activos, QR y mantenimiento | Identificación por QR o código, serial, custodio, estado, garantía y evidencias |
| INV-011 | Media | Inteligencia e importación de inventario | Indicadores de rotación e inmovilizado, carga masiva con validación |
| ALQ-001 | Alta | Proyecto tipo Alquiler | Consecutivo `ALQ`, periodo de entrega y devolución, asignación de equipo, cargos por extensión o daños y enlace a facturación |
| ALQ-003 | Alta | Persistencia del alquiler rápido | Almacenamiento empresarial, adjuntos de cédula, fotos y firma, y facturación |
| APU-012 | Media | Compras y requisiciones desde líneas APU | Panel de faltantes y generación de la requisición al almacén implementados; falta alimentar el compromiso y el real desde compras, inventario y nómina |
| APU-009 | Media | Clasificación configurable | RFC, CSI, UniFormat o ICMS configurables; no se incorporan catálogos licenciados sin autorización |
| APU-010 | Media | Historial de precios y vigencias | Proveedores, ciudades o sedes y alerta de variación de materiales y equipos |
| APU-011 | Media | Cuadrillas reutilizables | Productividad presupuestada contra real, factor prestacional y horas extra |
| APU-013 | Baja | Control avanzado del APU | Órdenes de cambio, evidencias adjuntas, AIU, impuestos y contingencias configurables, con permisos finos de revisión, aprobación y exportación |
| REP-002 | Media | Informes por período y rentabilidad | Filtros por período, indicadores de rentabilidad real y permisos por rol para exportaciones sensibles |
| SITE-002 | Media | Envío directo de solicitudes web | Edge Function que envía la solicitud validada al buzón corporativo con proveedor transaccional y antispam |
| DOC-001 | Media | Manual de usuario al día | Regenerar el manual desde [15 · Manual de usuario](15-manual-de-usuario.md) para que incluya visitas múltiples, requisición desde visita técnica, auditoría del historial y búsqueda de inventario en el APU |
| QTE-013 | Baja | Expediente técnico con archivos | Cargue binario de planos y documentos a Supabase Storage; hoy solo se guarda el enlace |

## Última entrega verificada

- **2026-10-06**: conversión Cotización→Obra transaccional y atómica, historial con responsable tomado de la sesión, múltiples visitas técnicas con evidencia y requisición real, búsqueda de inventario en el APU conectada a Supabase, modales con cabecera y acciones fijas, y adaptación móvil de Obras y Proyectos.
