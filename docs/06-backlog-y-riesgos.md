<!-- COM-001 mitigado 2026-10-20: Compras ya convierte requisiciones en órdenes y permite recepción total/parcial con entrada transaccional a inventario. Falta validar la primera operación real y completar proveedor/factura como proceso operativo. -->
<!-- INF-004 / ALQ-004 resueltos 2026-10-20: Informes de inventario ya calcula consumo por obra, rotación, inmovilizado y valoración por grupo sobre Supabase. El alquiler rápido ya es un documento multi-línea con disponibilidad persistida, una firma y devolución parcial por ítem. R-011 se reduce al catálogo de transporte del APU, que deja de escribir localStorage y migra una sola vez. -->
<!-- UX-ALERT-001 resuelto 2026-10-19: las alertas dejaron de depender de que Resumen estuviera montado. La campana global consulta la fuente persistida, respeta permisos por modulo y distingue un fallo de carga de un conteo real en cero. -->
<!-- APU-015 actualizado 2026-10-13: la duracion por actividad ya se calcula y se congela por version desde cantidad/rendimiento de cuadrilla. Pendiente: consolidar las duraciones de varios APUs segun secuencia y frentes paralelos. -->
<!-- R-006, R-007 e INV-011 actualizados 2026-10-20: el formulario de la portada ya tiene Edge Function con Resend, honeypot, trampa de tiempo y rate limit; Empleados ya invita, vincula cuentas existentes y muestra el estado de la identidad; Inventario ya tiene carga CSV/XLSX con vista previa, errores, confirmación y auditoría. Falta configurar secretos/proveedor, probar la entrega real y resolver la unicidad durable de SKU. -->
<!-- INV-003 / INV-023b actualizados 2026-10-21: se aplicó la migración 20261021153000 con RPCs transaccionales, libro mayor, idempotencia, restricciones compuestas y RLS por empresa/sede. Los traslados ya son una sola transacción y las escrituras directas de stock/movimientos quedaron revocadas. Persisten los datos históricos sin actor ni saldo y la conciliación de los 1.182 movimientos previos. -->
---
estado: vigente
propietario: Producto y Líder de proyecto RFC Enterprise
ultima_actualizacion: 2026-10-21
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
| R-011 | Persistencia local remanente en módulos operativos | Medio | Baja | Inventario, Obras, Movimientos, Requisiciones, Préstamos, Conteos, Resumen e Informes usan Supabase. **Alquiler rápido** no tiene clave local activa y su flujo multi-línea lee la bodega persistida. **Catálogo de transporte del APU**: `rfc_apu_transport_items` dejó de escribirse; solo se lee una vez para importar códigos ausentes y se elimina tras una importación exitosa (ADR-159). Quedan lecturas de respaldo en `rfc_apus`, `rfc_quotes` y `rfc_inventory_projects`, fuera del alcance de esta entrega; deben declararse como caché y no como confirmación de guardado. | Desarrollo |
| R-001 | Desconexión de red en frentes de obra | Medio | Media | Hoy no hay caché operativa: sin conexión el usuario ve un error explícito y no se pierde nada, pero tampoco puede capturar en campo. Evaluar cola de sincronización para lecturas y conteos. | Desarrollo / Operación |
| R-002 | Despacho de materiales sin soporte de entrega formal | Medio | Baja | El vale de entrega ya es obligatorio y firmable; falta exigir referencia de orden o factura cuando el material proviene de compra. | Almacén |
| R-003 | Desviación presupuestal inadvertida en obras | Alto | Media | Existen semáforos por obra y alertas al superar 80 % y 100 % del presupuesto de materiales; falta consolidarlas en el Resumen ejecutivo por proyecto. | Producto |
| R-005 | Cambios locales no sincronizados con la base | Alto | Baja | Se eliminó el respaldo local de negocio en los módulos operativos. Restablecer la alerta si vuelve a aparecer `localStorage` como confirmación de guardado. | Desarrollo |
| R-006 | Entrega real del formulario de la portada | Medio | Media | La Edge Function `contact-form` ya valida, filtra spam y entrega por Resend. **Pendiente operativo:** configurar `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` y `CONTACT_ALLOWED_ORIGIN`, desplegar la función y hacer una prueba de entrega real. El rate limit es en memoria por isolate; para una protección durable se necesita un almacén compartido (R-008). | Dirección / Operación |
| R-007 | Entrega de la invitación de empleados | Medio | Media | Empleados ya invita por correo, vincula cuentas existentes con enlace de recuperación, sincroniza la membresía y muestra el estado de la identidad. **Pendiente operativo:** configurar SMTP y redirect URLs en Supabase Auth, definir `NEXT_PUBLIC_SITE_URL` y validar la entrega con un buzón real. No hay columnas nuevas de invitación: el estado se deriva de Auth. | Operación / Desarrollo |
| INV-025 | Unicidad global de códigos de préstamos | Medio | Media | `inventory_tool_loans.code` está declarado `unique` a nivel tabla; debe ser `unique (company_id, code)` para evitar colisiones entre empresas. | Desarrollo |
| INV-024 | Referencias generadas con contador del navegador | Medio | Media | Los traslados ya usan sufijo único. Persisten consecutivos calculados en el cliente (`VALE-AAAA-N` en despachos); deben resolverse en base de datos. | Desarrollo |
| INV-026 | Unicidad durable de SKU en inventario | Medio | Media | `inventory_items.sku` no tiene restricción única; la migración 20261021153000 solo agregó un índice normalizado no único y la importación/alta deduplican en aplicación. Dos solicitudes concurrentes o una carga externa todavía pueden duplicar el código. Requiere migración coordinada con el propietario de datos y limpieza previa de los SKU repetidos del inventario inicial. | Desarrollo / Operación |
| INV-028 | Libro mayor histórico incompleto | Medio | Alta | Los 1.182 movimientos anteriores a 2026-10-21 son `adjustment_out`, con costo cero, mismo instante y `created_by = NULL`; no tienen saldo antes/después. No se inventaron actores ni fechas. La base no puede reconstruirlos sin una fuente externa: conciliar contra la carga inicial y no usarlos como evidencia de auditoría hasta completar esa revisión. | Operación / Desarrollo |
| R-008 | Rate limit de contacto solo en memoria | Medio | Media | La Edge Function limita por IP y globalmente dentro de cada isolate; al escalar o reciclar instancias el límite se reinicia. Para una protección durable, conectar un almacén compartido (Redis/Upstash o tabla de Supabase) en una migración coordinada. Mientras tanto, Resend y el buzón corporativo conservan sus propios límites. | Desarrollo / Operación |
| LAB-001 | El Registro de jornada se use como vigilancia y dañe la relación laboral | Alto | Media | El módulo está diseñado como declaración: sin lectura automática de ubicación, sin seguimiento en segundo plano y sin fotos obligatorias (ADR-108). La ubicación es un botón opcional que solo lee si el empleado lo pulsa, con consentimiento visible y sin obligatoriedad (ADR-110). **Pendiente:** acuerdo escrito de la empresa sobre el uso del módulo, sobre la finalidad de la ubicación declarada y sobre la consulta gerencial, y una regla interna de que `Sin declaración` es un dato operativo, nunca una acusación. Mientras no exista ese acuerdo, la consulta gerencial habilita solo a administrador, residente, auditor y gerencia. | Dirección / Talento humano |
| LAB-003 | La ubicación declarada se use como prueba fehaciente | Alto | Media | Las coordenadas viajan desde el navegador, por lo que son una **declaración del cliente** y no una atestación del dispositivo (ADR-110). **Pendiente:** regla interna que prohíba presentarlas ante un tercero como prueba de presencia, y requisito de que la empresa defina si necesita atestación por otro medio antes de exigir ubicación obligatoria. | Dirección / Talento humano |
| LAB-002 | Jornada abierta sin salida o corrección posterior | Medio | Media | Entrada, salida y tramos ya se modelan explícitamente. Al iniciar un día posterior, una jornada previa sin salida pasa a `needs_review`; el sistema no deduce ni inventa su hora final. **Pendiente:** flujo formal de solicitud/aprobación de correcciones por Talento Humano o responsable, con motivo y evidencia. | Producto / Talento humano |
| INF-001 | La rotación no es un costo de ventas contable | Medio | Media | El índice usa unidades salidas ÷ existencia actual porque no hay snapshots históricos de existencias. **Pendiente:** si Contabilidad necesita rotación contable, guardar existencias por periodo o calcular un promedio ponderado con los movimientos. Mientras tanto la pantalla declara la limitación. | Producto / Desarrollo |
| ALQ-005 | Dos entregas simultáneas compiten por el mismo equipo | Medio | Baja | La disponibilidad se recalcula justo antes de insertar, pero la validación y la escritura no son una sola transacción. **Pendiente:** RPC transaccional que bloquee la línea de bodega y cree cabecera + líneas en una operación. | Desarrollo |
| ALQ-006 | Cabecera creada sin líneas si falla la segunda escritura | Medio | Baja | La cabecera y las líneas se insertan en dos pasos porque la política de escritura no permite borrar. Si el segundo paso falla, el documento queda visible sin equipos. **Pendiente:** mover la creación a una RPC transaccional o habilitar un borrado lógico de cabeceras incompletas. | Desarrollo |

## Entregas pendientes

| ID | Prioridad | Entrega | Criterio de aceptación resumido |
| --- | --- | --- | --- |
| COM-002 | Alta | Módulo de Compras y Proveedores | Catálogo de proveedores, orden de compra generada desde una requisición aprobada, recepción parcial y total, factura asociada y entrada automática al inventario con recálculo de costo promedio ponderado. Base de datos ya creada (ADR-093): `suppliers`, `supplier_products`, vista `item_suppliers_overview` y RPC `create_supplier`, `link_supplier_product`, `set_preferred_supplier_product`. Falta la interfaz |
| INV-009 | Alta | Reposición y sugerencia de compra | Punto de reorden por artículo, propuesta de compra consolidada y recepción parcial |
| TALL-001 | Alta | Orden de taller y remisión de entrega | Recepción de equipo, diagnóstico, trabajo ejecutado, repuestos, entrega con firma en documento institucional imprimible |
| INV-003 | Alta | Operaciones auditables de inventario | Migración de libro mayor aplicada 2026-10-21 (RPCs, idempotencia, restricciones, RLS y auditoría); falta conciliar el histórico y validar la operación real de compras/conteos bajo RLS. |
| INV-007 | Alta | Requisiciones y despacho con remisión firmada | Completar el circuito de aprobación y despacho firmado sobre Supabase |
| INV-010 | Media | Activos, QR y mantenimiento | Identificación por QR o código, serial, custodio, estado, garantía y evidencias |
| INV-011 | Media | Importación masiva de inventario | Pantalla `/inventory/import`, contrato CSV/XLSX, vista previa, errores, confirmación explícita y auditoría implementados (2026-10-20). **Pendiente:** prueba con un archivo real de operación, validación de la primera carga y definición de la política de SKU duplicado con Operación. La importación es de altas y no actualiza artículos existentes. |
| APU-012 | Media | Compras y requisiciones desde líneas APU | Panel de faltantes y generación de la requisición al almacén implementados; falta alimentar el compromiso y el real desde compras, inventario y nómina |
| APU-009 | Media | Clasificación configurable | RFC, CSI, UniFormat o ICMS configurables; no se incorporan catálogos licenciados sin autorización |
| APU-010 | Media | Historial de precios y vigencias | Proveedores, ciudades o sedes y alerta de variación de materiales y equipos |
| APU-011 | Media | Cuadrillas reutilizables | Productividad presupuestada contra real, factor prestacional y horas extra |
| APU-013 | Baja | Control avanzado del APU | Órdenes de cambio, evidencias adjuntas, AIU, impuestos y contingencias configurables, con permisos finos de revisión, aprobación y exportación |
| APU-014 | Baja | Plantilla RFC con catálogos de apoyo | La exportación actual entrega una hoja oficial por actividad y puede reimportarse sin hojas auxiliares. Si Operación requiere volver a distribuir tablas maestras de materiales, salarios, dotación o transporte, se debe definir la fuente vigente y su régimen de actualización antes de agregarlas al libro. |
| APU-015 | Baja | La ficha de cotización detecta APU en `localStorage` | `quotes-workspace.tsx` decide si una cotización ya tiene APU leyendo `rfc_apus` del navegador, no la base (ADR-155). Con los APU ya centralizados, ese chequeo debe resolverse con `listApuAnalyses()` una sola vez en la pantalla, en lugar del respaldo local. |
| REP-002 | Media | Informes por período y rentabilidad | Filtros por período, indicadores de rentabilidad real y permisos por rol para exportaciones sensibles |
| SITE-002 | Media | Envío directo de solicitudes web | Edge Function implementada; **pendiente** desplegar, configurar secrets, limitar CORS al dominio real y hacer una prueba de entrega con el buzón corporativo |
| DOC-001 | Media | Manual de usuario al día | Regenerar el manual desde [15 · Manual de usuario](15-manual-de-usuario.md) para que incluya visitas múltiples, requisición desde visita técnica, auditoría del historial y búsqueda de inventario en el APU |
| QTE-013 | Baja | Expediente técnico con archivos | Cargue binario de planos y documentos a Supabase Storage; hoy solo se guarda el enlace |

| BUSQ-001 | Media | Buscador de módulos y accesos en la barra lateral | En la barra lateral aparece una caja de búsqueda (o atajos directos a secciones internas como «Tablas salariales») que filtra por nombre y lleva directo al módulo, sin tener que abrir Configuración y recorrer hasta el destino. |

| VIA-001 | Media | Viáticos de desplazamiento en mano de obra | Decidido y documentado (ADR en 07 y ficha en 09), **aún no construido**. Hotel y transporte operativo se cobra como viático, separado del auxilio legal de transporte, solo en obras por fuera de la sede y solo para Conductor y Capataz; los demás cargos se contratan en la región de la obra. El monto entra al costo del APU. Cada línea puede registrar una excepción justificada. |


| MOB-001 | Alta | Modal de mano de obra por obra (Cotización nueva) | Al crear una cotización, un modal carga la tabla salarial vigente del cliente y permite digitar los valores que se estiman solo para esa obra. Las columnas de la tabla se muestran recalculadas en vivo, igual que la hoja de cálculo del usuario, y el resultado (costo diario por puesto y nivel) queda congelado en esa cotización. Nada se escribe en la tabla oficial ni en otras cotizaciones. |
| MOB-002 | Media | Valores de reposicion de la dotacion por concepto | La regla de cálculo ya existe (ADR-148, ADR-149): la reposición nace en cero y se proyecta a las veces que quepan en el año. Falta que el usuario defina, concepto por concepto, cada quantos días se repone. |
| MOB-003 | Media | Valor del equipo y costo de alquiler dentro del APU de la obra | El usuario necesita incluir el valor del equipo y el costo de alquiler de las obras en el análisis. Falta definir si es una línea propia del APU o concepto del proyecto. |

- **2026-10-08**: mano de obra y viáticos por obra (ADR-126). Motor de cálculo verificado contra el libro real de la obra Trampa Granjita: provisioned, horas y dominicales coinciden al peso. Modal «Mano de obra de esta obra» en cotización nueva, con plazo que calcula los días, conceptos digitables de la obra, desglose en vivo y total congelado en esa cotización. Se corrige la subestimación del 32% al 49% en el valor diario de los cargos. Se bloquean en `.gitignore` los documentos de cliente dentro de `public/`.
- **2026-10-08**: asistente de importación de tablas salariales con vista previa y mapeo de columnas, montado en Configuración › Costos y tablas salariales.

- **2026-10-13**: dotación sin el supuesto de los 240 días (ADR-150). Los 2.699 registros de `labor_role_dotacion` quedan con `replacement_days` en cero y la nota de que el valor venía heredado. La matriz de configuración muestra "Días de reposición" con icono de ayuda, y el total de la fila proyecta las entregas del año en vez de callarlas. Se corrigió el texto centrado de las ayudas, que venía centered en todos los módulos.

- **2026-10-19**: lectura única de los APU en pantallas de consulta (ADR-155). El Resumen ejecutivo y el informe de APU ya no leen `apu_analyses` en crudo: usan `listApuAnalyses()` del módulo APU, que mapea `quote_id`/`quote_code`, filtra por la empresa activa y excluye archivados. Se corrige el indicador "APUs vinculados a cotizaciones", que mostraba 0 aunque una cotización tuviera análisis, y las alertas falsas de "requiere APU". También se corrige un `useEffect` que devolvía `boolean` en su limpieza.

## Última entrega verificada

- **2026-10-21**: reparación del libro mayor de inventario (ADR-165): RPCs transaccionales para movimientos, traslados, mínimos y altas con apertura; revocación de escrituras directas; idempotencia por empresa; saldo antes/después; trigger único de Kardex; préstamos de herramientas con movimiento; RLS por empresa/sede con códigos nuevos; paginación completa en lecturas; eliminación del costo ficticio de $25.000. Migración `20261021153000` aplicada y validada con pruebas revertidas; los conteos de datos no cambiaron (1.191 artículos/existencias y 1.182 movimientos).
- **2026-10-20**: informes de consumo por obra, rotación, inmovilizado y valoración por grupo sobre Supabase, con periodo configurable y CSV (ADR-158, INF-001). Alquiler rápido multi-línea con disponibilidad contra bodega persistida, una firma, factura consolidada y devolución parcial por ítem (ADR-160, ALQ-005). El catálogo de transporte del APU deja de escribir `rfc_apu_transport_items`; migra una sola vez los códigos ausentes y elimina la clave tras una importación exitosa (ADR-159).
- **2026-10-07**: firma institucional y representante legal passam a la base de datos, con interruptor por documento (ADR-115); valores por defecto de la propuesta aplicados al abrir cotización (ADR-116); Resumen armado según permisos, con tarjetas de alquileres y de mi jornada (ADR-117); menú lateral agrupado por dominio y plegable (ADR-118); semáforo de antigüedad con texto en cotizaciones (ADR-119); cambio de contraseña en modal y documento en es-CO (ADR-120); devolución de alquiler en modal que verifica la escritura (ADR-121); firma de entrega visible al reabrir, quitable y reemplazable, y presente en la factura (ADR-122).
- **2026-10-07**: importación APU de selección múltiple: el usuario marca una o varias hojas de actividad detectadas, puede seleccionar todas y ve por separado las hojas informativas excluidas con su motivo. Cada actividad seleccionada se crea como APU independiente para revisión antes de guardarse.
- **2026-10-07**: Registro de jornada (ADR-108, ADR-109, ADR-110): declaración de sitio y actividad con hora del servidor, alta por RPC, tabla inmutable, lectura restringida por RLS y consulta gerencial por día, semana o mes con filtros por empleado, obra y texto. Ubicación declarada opcional, solo por acción del empleado, sin lectura automática ni seguimiento en segundo plano.
- **2026-10-07**: evolución de jornada a entrada/salida y tramos (ADR-111): una entrada abre el primer tramo; cualquier cambio de actividad, frente, desplazamiento o pausa cierra el anterior y abre el siguiente atómicamente. La salida cierra ambos. Las jornadas olvidadas no se cierran con una hora ficticia: pasan a revisión al iniciar un día posterior.
- **2026-10-07**: documentación técnica de cotizaciones: procedimiento de trabajo y matriz de riesgos en bucket privado, control de versiones y observaciones del cliente; la conversión a obra queda bloqueada en la base de datos hasta la reaprobación de las dos versiones vigentes.
- **2026-10-07**: proyecto tipo Alquiler (ALQ-001) con periodo de entrega y devolución, cargos por extensión y mora, y total a facturar; persistencia real del alquiler rápido (ALQ-003) con tablas, bucket de adjuntos y firma del cliente; inlet del teléfono corregido. Sin reservas de `localStorage` como fuente de negocio.
- **2026-10-06**: conversión Cotización→Obra transaccional y atómica, historial con responsable tomado de la sesión, múltiples visitas técnicas con evidencia y requisición real, búsqueda de inventario en el APU conectada a Supabase, modales con cabecera y acciones fijas, y adaptación móvil de Obras y Proyectos.

- **Pendiente de evolución — importación de tablas salariales:** los formatos de clientes no son homogéneos. La primera entrega permite crear tabla y cargos manualmente; la próxima debe añadir asistente de importación con vista previa y mapeo de columnas, sin interpretar automáticamente hojas informativas.


- **SAL-002 � Importaci�n documental de salarios:** Excel se importa con selecci�n de hoja, mapeo y vista previa. PDF y Word quedan como fuente documental hasta implementar extracci�n asistida con confirmaci�n obligatoria; no se debe publicar una tabla inferida autom�ticamente.

- **SAL-003 � Consulta verificable:** la tabla salarial vigente debe poder revisarse dentro de la aplicaci�n con los mismos componentes que se exportan; la exportaci�n no es la �nica forma de auditar los valores.

- **SAL-004 � Fuente oficial:** el Total d�a de cada nivel se preserva tal como aparece en el documento fuente. Cualquier c�lculo espec�fico de una cotizaci�n debe conservarse como instant�nea separada, sin sobrescribir la tabla salarial.


### SAL-005 - Trazabilidad completa de cargos por nivel

Mitigado el 2026-10-08: el riesgo de cotizar un cargo con un nivel incompleto se reduce mediante el cat?logo oficial asociado a cada tabla. Cualquier fuente futura con cargos no estructurados debe pasar por revisi?n de mapeo antes de quedar disponible para APU; nunca se inferir? el nivel solo por similitud de nombre.


<!-- 2026-10-08: Correction: the 68 OCENSA positions are the pre-existing mapped catalogue, not a verified complete transcription of all own-activity positions. Complete the OCENSA own-position map only from its official role-to-level annex; do not infer it from CENIT or ODC. Official source views exclude provisions and extra-hour references. -->

<!-- 2026-10-08: A job title is reusable across companies, but its salary mapping is never global. labor_rate_roles is scoped by company_id, labor_rate_table_id and labor_rate_entry_id, so the same title may map to a different level and official value for each company, contract/version and validity period. -->

<!-- 2026-10-08: Salary tables uploaded for each company are documentary source data and mandatory inputs to the contractor calculation model. They are not standalone APU final costs: RFC preserves published values, then derives project/APU cost in a separate auditable snapshot without modifying the source table. -->

### SAL-006 ? Costeo contractual e IBC configurable

En implementaci?n. Riesgo a evitar: usar como f?rmula legal universal el Excel hist?rico de OCENSA, que no incluye todos los conceptos en su base de salud/pensi?n. Cada concepto de remuneraci?n debe conservar su tratamiento de IBC, prestaciones y parafiscales con vigencia y soporte; los costos operativos (hotel, agua, EPP y m?dico) se separan de la n?mina.

<!-- Alcance SAL-006: el c?lculo es comercial para cotizaci?n y APU, no liquidaci?n de n?mina ni declaraci?n PILA. -->

<!-- WEB-012 mitigado 2026-10-09: el video esencial de taller tambien carga en movil; conserva area reservada y movimiento reducido cuando el usuario lo solicita. -->

+<!-- WEB-013 mitigado 2026-10-09: las URL inexistentes ya no muestran una pagina generica; ofrecen recuperacion clara, controles visibles y movimiento reducible. -->

### SAL-007 - Revision de parametros laborales nacionales

Mitigado tecnicamente el 2026-10-09: los porcentajes dejaron de depender de constantes del codigo y ya se persisten en la base de datos con control de acceso. Riesgo operativo residual: antes de modificar o agregar un parametro, un responsable debe validar su vigencia, base y efecto para el modelo comercial. El modulo estima APU/cotizaciones; no liquida nomina ni sustituye PILA.

### DOT-001 - Completar perfiles y vinculos con inventario

En progreso. La base ya permite perfiles reutilizables, excepciones por cargo y entregas reales. Antes de usarla masivamente se debe revisar la matriz de cada cargo, asociar cada concepto con su articulo de inventario y completar el catalogo salarial OCENSA desde su fuente oficial.

### COT-014 - Separacion entre estimado y APU definitivo

Mitigado el 2026-10-09: el estimado comercial y la planeacion de cuadrilla son opcionales y plegables. Riesgo residual: antes de emitir la oferta final el responsable debe revisar la variacion frente a los APUs terminados; no se debe copiar un estimado como valor definitivo sin esa revision.

### APU-014 - Confundir jornada legal, remuneracion y produccion

Abierto. El modelo futuro debe impedir que 42 horas semanales, el factor presupuestal de dias remunerados y las horas efectivas productivas se mezclen o se apliquen dos veces. Para OCENSA, 5,333 horas productivas/dia es un supuesto editable; no se debe tratar como jornada legal ni como regla universal.

### APU-014 - Confundir jornada legal, remuneracion y produccion

Mitigado parcialmente el 2026-10-09: el precosteo separa dias fisicos, dias remunerados, alojamiento y horas productivas. Riesgo residual: festivos y turnos especiales aun requieren ajuste manual; no se deben inferir pagos o recargos fuera de reglas contractuales vigentes.

**Control APU-014 (extras):** las horas extra y dominicales del precosteo inician en cero. El responsable debe ingresarlas con base en la programacion real; se elimina el prorrateo automatico de referencias historicas que podia crear extras inexistentes.

**APU-015 - Fechas como requisito prematuro:** mitigado el 2026-10-09. El precosteo permite costear con dias fisicos estimados sin fechas; el calendario es opcional. Pendiente: calcular automaticamente la duracion por actividad a partir de cantidades, rendimientos y cuadrillas dentro del APU.

### COT-015 - Confundir fechas comerciales y de ejecucion

Mitigado el 2026-10-09: la fecha de recepcion se captura separada de la fecha maxima para entregar cotizacion. Esta ultima es opcional y no determina la duracion de obra. Se retira del modelo cualquier dato de horas productivas usado solo como ejemplo contextual.

### COT-016 - Condiciones de pago inconsistentes

Mitigado el 2026-10-09: anticipo y contraentrega se ajustan en un unico control que mantiene el total en 100 %. Riesgo residual: condiciones distintas (hitos, retenciones o pagos por acta) requieren una modalidad comercial futura; no se deben simular con un porcentaje simple.

### COT-017 - Confirmacion de pago sin persistencia

Mitigado el 2026-10-09: la nueva cotizacion guarda por RPC antes de cerrar el formulario o confirmar exito. Si falla la base de datos, informa el error y no presenta el registro como guardado.

### DOT-002 - Frecuencias reales y puesta en uso de dotacion

Mitigado funcionalmente el 2026-10-09: 240 dias deja de ser el divisor fijo del APU. Cada articulo por cargo expone su frecuencia de reposicion en dias fisicos y el valor se calcula por la duracion estimada de la obra. Riesgo residual: los perfiles heredados que aun tengan 240 deben revisarse articulo por articulo antes de emitir una cotizacion; ese numero es un dato editable, no una norma de RFC.

<!-- 2026-10-14: Importación APU con rubros paralelos. Las hojas de actividad no se excluyen solo por mostrar varias categorías en columnas paralelas; se procesa cada bloque y se conserva el nombre de hoja con signos como < y -. -->

<!-- 2026-10-14: La lista lateral de APUs permite abrir una actividad con clic y reorganizarla por arrastre. El orden es una preferencia visual local; incorpora botones Subir/Bajar como alternativa al arrastre. -->

### COT-018 - Expediente comercial sin estructura tipica de clientes

Mitigado el 2026-10-14: los soportes del cliente (solicitud, planos, correos, orden de servicio, aprobacion) se registran con tipo, nombre, fecha, responsable y archivo privado o enlace externo. Riesgo residual: mientras el registro exista solo en el formulario de la ficha, los expedientes previos a esta entrega no tienen respaldo estructurado y deben migrarse a mano si la auditoria los pide.

### COT-019 - Comparar revisiones sin historial historico

Riesgo abierto, aceptado el 2026-10-14: `quotes.revision` es un contador que se sobrescribe, asi que no habia instantanea de R0/R1 anteriores. La foto se toma desde la migracion en adelante mediante trigger al guardar. Mientras eso, el comparador solo puede confrontar revisiones posteriores a la entrega y lo explica en pantalla; no inventa diferencias para cerrar el hueco.

### COT-020 - Motivos de perdida dependientes de notas libres

Riesgo abierto el 2026-10-14: los motivos de perdida se extraen de la nota con la que la cotizacion pasa a "No adjudicado". Si el cierre se registra sin nota, el motivo no existe y el bloque de indicadores lo explica como falta de datos. Si el volumen de cotizaciones perdidas crece, conviene un campo estructurado de motivo; no se agrega ahora para no tocar el flujo de estados.

### COT-021 - Integracion pendiente de los paneles en la ficha

Pendiente el 2026-10-14: `CommercialFileSection` y `RevisionComparator` estan listos y exportados, pero la ficha (`quotes-workspace.tsx`) no los monta todavia, por acuerdo explicito para evitar ediciones concurrentes. Hasta que se integren, las tres mejoras existen en codigo, migraciones y documentacion, pero no son visibles en la pantalla de Cotizaciones.


## INV-029 - Validacion operativa posterior al despliegue de Inventario y Kardex

Pendiente de validacion con una sesion real y sin crear movimientos: confirmar que Escape cierra el modal de movimiento, que el foco no sale del dialogo con Tab y que vuelve al disparador al cerrar; confirmar tambien que pestana, filtros, busqueda y pagina sobreviven recarga, atras/adelante y enlaces copiados. La aprobacion final requiere revisar con usuarios autorizados y datos productivos reales antes de declarar el flujo listo para operacion.
## INV-027 - Movimientos durante jornada fisica abierta

La conciliacion se detiene si una existencia cambio desde la fotografia de la jornada. Operacion debe pausar movimientos de bodega o reiniciar/revisar la jornada despues de una recepcion, despacho o ajuste.


## DASH-CRIT-001 — Referencias y conciliación de devoluciones pendientes de cierre en base de datos

El formulario del Dashboard dejó de aceptar devoluciones sin obra seleccionada y rechaza cantidades vacías o no positivas. Aún se requiere una migración revisada con datos reales para generar consecutivos de vales exclusivamente en servidor y comprobar, por existencia y obra, que una devolución no exceda las salidas imputadas. No se ejecuta esa migración ni se alteran datos productivos dentro de este bloque sin revisión de la regla financiera.


## DASH-CRIT-001 — Mitigación implementada, pendiente de aplicación controlada

Actualizado el 2026-10-22: la migración supabase/migrations/20261022210000_dashboard_movement_integrity.sql genera referencias MOV-AAAA-##### bajo bloqueo transaccional por empresa/año y rechaza devoluciones sin obra, de otra empresa o por encima de la salida neta de esa existencia en la obra. Permanece pendiente su validación en una base de ensayo y posterior aplicación aprobada; no se ejecutó en producción.


## DASH-CRIT-002 - Validacion de despliegue pendiente

La implementacion cliente del Dashboard cubre estado, reintento y alertas. El error de sintaxis de counts-workspace.tsx fue corregido al restaurar la paginacion explicita del conteo fisico. Antes de despliegue debe probarse con una jornada grande y aplicar de forma controlada la migracion de timeout correspondiente, junto con DASH-CRIT-001.

## DASH-CRIT-003 - Aplicacion pendiente de metricas ejecutivas

La interfaz de graficos requiere aplicar 20261022195857_executive_dashboard_metrics.sql en una base de ensayo y validar los agregados con datos reales y RLS antes de produccion.


## DASH-UX-001 - Limites del centro de control

El encabezado ejecutivo no contiene acciones de bodega. Las operaciones de salida y requisicion se ejecutan desde Inventario; esto evita que perfiles gerenciales reciban acciones que no corresponden a su contexto.


## ATT-001 - Jornada cerrada en solo lectura y estados explicitos

Resueltos los estados de jornada cerrada y needs_review, el selector mensual y el aviso de limite de 800 registros. Pendiente revisar metricas gerenciales si la consulta llega al limite.
