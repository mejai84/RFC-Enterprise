---
estado: vigente
propietario: Producto y Líder de proyecto RFC Enterprise
ultima_actualizacion: 2026-10-07
audiencia: Dirección, Producto, Desarrollo y Operación
---

# Backlog y riesgos

> Actualización 2026-10-06: se reduce el riesgo de unidades inconsistentes en APU mediante selección normalizada; el catálogo mantiene nombres de consulta y persiste únicamente abreviaturas.

Este documento contiene **únicamente el trabajo pendiente y los riesgos abiertos**.
Lo ya resuelto se retiró de aquí y quedó registrado como decisiones en
[07 · Registro de decisiones](07-registro-de-decisiones.md).

<!-- Registro 2026-10-07: Los puntos de riesgo por operaciones locales en Obras se retiran al persistir personal, reaperturas, ajustes y catálogos. Permanece como dependencia controlada el préstamo desde Resumen hasta que el trigger de custodia esté aplicado. -->
<!-- Registro 2026-10-07: RFC Graphite queda limitado al sitio público de inicio; los módulos operativos no heredan tokens ni estilos globales de la landing. -->

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
| LAB-001 | El Registro de jornada se use como vigilancia y dañe la relación laboral | Alto | Media | El módulo está diseñado como declaración: sin lectura automática de ubicación, sin seguimiento en segundo plano y sin fotos obligatorias (ADR-108). La ubicación es un botón opcional que solo lee si el empleado lo pulsa, con consentimiento visible y sin obligatoriedad (ADR-110). **Pendiente:** acuerdo escrito de la empresa sobre el uso del módulo, sobre la finalidad de la ubicación declarada y sobre la consulta gerencial, y una regla interna de que `Sin declaración` es un dato operativo, nunca una acusación. Mientras no exista ese acuerdo, la consulta gerencial habilita solo a administrador, residente, auditor y gerencia. | Dirección / Talento humano |
| LAB-003 | La ubicación declarada se use como prueba fehaciente | Alto | Media | Las coordenadas viajan desde el navegador, por lo que son una **declaración del cliente** y no una atestación del dispositivo (ADR-110). **Pendiente:** regla interna que prohíba presentarlas ante un tercero como prueba de presencia, y requisito de que la empresa defina si necesita atestación por otro medio antes de exigir ubicación obligatoria. | Dirección / Talento humano |
| LAB-002 | Jornada abierta sin salida o corrección posterior | Medio | Media | Entrada, salida y tramos ya se modelan explícitamente. Al iniciar un día posterior, una jornada previa sin salida pasa a `needs_review`; el sistema no deduce ni inventa su hora final. **Pendiente:** flujo formal de solicitud/aprobación de correcciones por Talento Humano o responsable, con motivo y evidencia. | Producto / Talento humano |
| ALQ-004 | Interfaz de alquiler por múltiples líneas | Alto | Media | La BD agrega cabecera y líneas para una factura/entrega con varios equipos. Pendiente adaptar el formulario unitario a carrito, firma única y devolución parcial por ítem. | Desarrollo |

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
| APU-012 | Media | Compras y requisiciones desde líneas APU | Panel de faltantes y generación de la requisición al almacén implementados; falta alimentar el compromiso y el real desde compras, inventario y nómina |
| APU-009 | Media | Clasificación configurable | RFC, CSI, UniFormat o ICMS configurables; no se incorporan catálogos licenciados sin autorización |
| APU-010 | Media | Historial de precios y vigencias | Proveedores, ciudades o sedes y alerta de variación de materiales y equipos |
| APU-011 | Media | Cuadrillas reutilizables | Productividad presupuestada contra real, factor prestacional y horas extra |
| APU-013 | Baja | Control avanzado del APU | Órdenes de cambio, evidencias adjuntas, AIU, impuestos y contingencias configurables, con permisos finos de revisión, aprobación y exportación |
| APU-014 | Baja | Plantilla RFC con catálogos de apoyo | La exportación actual entrega una hoja oficial por actividad y puede reimportarse sin hojas auxiliares. Si Operación requiere volver a distribuir tablas maestras de materiales, salarios, dotación o transporte, se debe definir la fuente vigente y su régimen de actualización antes de agregarlas al libro. |
| REP-002 | Media | Informes por período y rentabilidad | Filtros por período, indicadores de rentabilidad real y permisos por rol para exportaciones sensibles |
| SITE-002 | Media | Envío directo de solicitudes web | Edge Function que envía la solicitud validada al buzón corporativo con proveedor transaccional y antispam |
| DOC-001 | Media | Manual de usuario al día | Regenerar el manual desde [15 · Manual de usuario](15-manual-de-usuario.md) para que incluya visitas múltiples, requisición desde visita técnica, auditoría del historial y búsqueda de inventario en el APU |
| QTE-013 | Baja | Expediente técnico con archivos | Cargue binario de planos y documentos a Supabase Storage; hoy solo se guarda el enlace |

## Última entrega verificada

- **2026-10-07**: firma institucional y representante legal passam a la base de datos, con interruptor por documento (ADR-115); valores por defecto de la propuesta aplicados al abrir cotización (ADR-116); Resumen armado según permisos, con tarjetas de alquileres y de mi jornada (ADR-117); menú lateral agrupado por dominio y plegable (ADR-118); semáforo de antigüedad con texto en cotizaciones (ADR-119); cambio de contraseña en modal y documento en es-CO (ADR-120); devolución de alquiler en modal que verifica la escritura (ADR-121); firma de entrega visible al reabrir, quitable y reemplazable, y presente en la factura (ADR-122).
- **2026-10-07**: importación APU de selección múltiple: el usuario marca una o varias hojas de actividad detectadas, puede seleccionar todas y ve por separado las hojas informativas excluidas con su motivo. Cada actividad seleccionada se crea como APU independiente para revisión antes de guardarse.
- **2026-10-07**: Registro de jornada (ADR-108, ADR-109, ADR-110): declaración de sitio y actividad con hora del servidor, alta por RPC, tabla inmutable, lectura restringida por RLS y consulta gerencial por día, semana o mes con filtros por empleado, obra y texto. Ubicación declarada opcional, solo por acción del empleado, sin lectura automática ni seguimiento en segundo plano.
- **2026-10-07**: evolución de jornada a entrada/salida y tramos (ADR-111): una entrada abre el primer tramo; cualquier cambio de actividad, frente, desplazamiento o pausa cierra el anterior y abre el siguiente atómicamente. La salida cierra ambos. Las jornadas olvidadas no se cierran con una hora ficticia: pasan a revisión al iniciar un día posterior.
- **2026-10-07**: documentación técnica de cotizaciones: procedimiento de trabajo y matriz de riesgos en bucket privado, control de versiones y observaciones del cliente; la conversión a obra queda bloqueada en la base de datos hasta la reaprobación de las dos versiones vigentes.
- **2026-10-07**: proyecto tipo Alquiler (ALQ-001) con periodo de entrega y devolución, cargos por extensión y mora, y total a facturar; persistencia real del alquiler rápido (ALQ-003) con tablas, bucket de adjuntos y firma del cliente; inlet del teléfono corregido. Sin reservas de `localStorage` como fuente de negocio.
- **2026-10-06**: conversión Cotización→Obra transaccional y atómica, historial con responsable tomado de la sesión, múltiples visitas técnicas con evidencia y requisición real, búsqueda de inventario en el APU conectada a Supabase, modales con cabecera y acciones fijas, y adaptación móvil de Obras y Proyectos.
