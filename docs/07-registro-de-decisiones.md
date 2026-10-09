

## 2026-10-08 — ADR-126: modelo de mano de obra y viáticos por obra
El cálculo de la mano de obra reproduce la hoja de cálculo del cliente, celda por celda, y se verificó contra el libro real de la obra Trampa Granjita (COT-113-2026). Coinciden el subtotal provisionado (Nivel 6: $350.000,04), las horas extra diurnas (2 h × 56), los dominicales (190% × 14) y el total del periodo ($133.294.498, $555.394 por día). Tres reglas quedan fijadas por ese lectura:

1. **El interés de cesantías es `cesantías × 12/360`** (Ley 52 de 1975). El rótulo «1%/cesanti» que aparece en el encabezado de la hoja oficial es una etiqueta equivocada: el 3,33% diario de las cifras es el valor correcto.
2. **La hora ordinaria es el salario día entre 7**, no entre 8. Es una decisión de la hoja y se conserva para que el número coincida.
3. **Hotel y alimentación son tarifa por día** y se multiplican por los días de alojamiento (90 en la hoja, no los 240 de la tabla). El resto de conceptos se digitan como total del periodo.

Los conceptos por obra **no se escriben en la tabla salarial**: son estimaciones del dueño y valen únicamente para la cotización que los guarda. La tabla oficial queda intacta y cada cotización es independiente de las demás. Al calcular, la cotización congela el resultado, de modo que actualizar la tabla después no mueve esa cotización.

Los días de la obra se calculan del plazo (fecha de inicio y finalización) y se pueden cambiar a mano. Cuando se escriben a mano, la interfaz avisa que está usando el valor escrito y deja ver cuántos días dio el plazo.

**Corrección de fondo:** `labor_rate_entries.total_daily_rate` solo sumaba las cuatro columnas base, sin provisiones ni horas extra, y ese número era el que alimentaba el APU. La mano de obra quedaba subestimada entre 32% y 49%. La migración recalcula el valor diario con el modelo completo; el Nivel 6 de OCENSA pasa de $327.843 a $461.865 por día.

**Anomalía señalada, no corregida:** la celda `AH = AF − AG` de la hoja oficial **resta** el 8% de salud y pensión en lugar de sumarlo. El motor lo reproduce tal cual para no desalinearse del Excel del cliente, pero conviene confirmarlo con él: si fuera un error de signo en su hoja, el total de cada nivel bajaría en ese 8%.

**Pendiente:** la columna DOTACIÓN existe en la hoja del cliente (hoja `dotacion`, $3.447.000 para 240 días, con 6 perfiles de cargo) y el modelo ya la acepta por puesto, pero falta confirmar su regla antes de offeredla como concepto editable. Queda registrado como MOB-002.

**Documentos de cliente:** el libro `COT-113-2026 ... TRAMPA GRANJITA.xlsx` se usó solo como referencia de lectura. No entra al repositorio, y `.gitignore` bloquea ahora cualquier hoja de cálculo, PDF o ZIP en `public/`, porque todo lo que está en esa carpeta se sirve por web y el documento contiene costos reales del cliente.---
estado: vigente
propietario: Equipo RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Desarrollo y Operación
---

# Registro de decisiones arquitectónicas y de producto

<!-- ADR-105 (Aceptada, 2026-10-07): el procedimiento de trabajo y la matriz de peligros, riesgos y controles son documentos técnicos sujetos a revisión del cliente. Se preparan durante Cotización en proceso y se envían junto con la propuesta. Si el cliente solicita cambios, la cotización pasa a Por modificar y se conserva la versión enviada, las observaciones y la nueva versión ajustada. La obra solo puede iniciarse después de que el cliente re-apruebe la versión vigente: entonces la cotización se confirma y se convierte en Obra. El flujo no permite usar una aprobación anterior después de una modificación. -->
<!-- ADR-106 (Aceptada, 2026-10-07): los documentos de ADR-105 viven en `quote_technical_documents`, no dentro de un JSON de cotización. Cada tipo tiene versiones inmutables, estado y observaciones; los archivos PDF/DOC/DOCX se almacenan en el bucket privado `quote-technical-documents` y se abren por URL firmada. La preparación, revisión y cambio de estado usan RPC autorizada; el RPC de conversión a obra verifica las dos versiones vigentes aprobadas, por lo que el navegador no puede omitir la condición. -->
<!-- ADR-107 (Aceptada, 2026-10-07): la importación APU permite selección múltiple explícita. Solo las hojas reconocidas como actividad aparecen con casilla; las auxiliares se listan aparte con el motivo de exclusión. Cada hoja marcada genera un APU independiente y conserva su propia revisión de líneas, evitando que un libro con varias actividades obligue a importar una por una o trate catálogos como APUs. -->

<!-- ADR-104 (Aceptada, 2026-10-07): `public/rfc-signature.png` es la firma institucional de Jorge Figueroa Castro, representante legal de RFC. Debe aparecer en los documentos donde la empresa emite, aprueba o entrega: impresión de APU, exportación XLSX de APU, propuestas comerciales, vales de salida y facturas de alquiler. No sustituye firmas personales requeridas por el flujo operativo, como la firma del cliente, residente, receptor de materiales o encargado de visita; esas firmas continúan capturándose y preservándose como evidencia propia. -->

<!-- ADR-103 (Aceptada, 2026-10-07): la exportación XLSX del módulo APU genera un solo libro con la hoja inicial `RESUMEN ACTUALIZADO` y una hoja por cada actividad del contexto abierto. El resumen consolida código, actividad, unidad, cantidad de obra, costo directo, ganancia y precio de venta, con totales. En el contexto de una cotización se exportan exclusivamente sus actividades; entrando al módulo sin cotización se exportan las actividades generales. Cada hoja de actividad usa la estructura oficial RFC: título, cantidad de obra y bloques independientes de equipos y herramientas, materiales, mano de obra y transporte, con las columnas Cant., Rend/Día, Tarifa/Día y Vr. Parcial. Los bloques tienen longitud variable, subtotales y costo directo por fórmula, para que el archivo se pueda revisar o reimportar sin depender de filas fijas. Las hojas auxiliares de catálogos, dotación o salarios no se incluyen porque no son APUs de una actividad. -->

<!-- ADR-102 (Aceptada, 2026-10-07): las cantidades y rendimientos del APU admiten decimales escritos con coma o con punto, y al salir del campo o tabular se presentan en formato colombiano con maximo dos decimales. Se evita deliberadamente `type="number"` para estos campos: el separador decimal que acepta ese control depende de la configuracion regional del navegador y del sistema, por lo que escribir 1,2345 no es confiable. Los valores se interpretan con una regla unica que resuelve ambos casos: si hay coma y punto, el ultimo separador que aparece es el decimal; si solo hay uno, se interpreta como decimal salvo que se repita, caso en el que se toma como separador de miles. Al confirmar se redondea a dos decimales para no arrastrar ruido binario en los calculos de costo, y las divisiones por cantidad se protegen contra cero o valores negativos para que nunca se produzca Infinity o NaN en el costo por unidad. -->
<!-- ADR-101 (Aceptada, 2026-10-07): el alcance de la lista de actividades depende de como se entra al modulo. Entrando desde una cotizacion, o desde el buscador que abre el contexto de una cotizacion, se muestran exclusivamente las actividades de esa cotizacion. Entrando directo a /apu sin quoteId se muestran unicamente las actividades generales, es decir las que no pertenecen a ninguna cotizacion, para que la vista general sea una bandeja de trabajo propia y no se confunda con la oferta de un cliente concreto. El buscador de la vista general permite localizar por codigo, cliente o nombre para abrir el contexto de la cotizacion correspondiente. -->
<!-- ADR-099 (Aceptada, 2026-10-07): los porcentajes de ganancia por rubro son parte del APU y por eso se persisten en Supabase, en la columna jsonb `apu_analyses.category_margins`. Antes solo existían en el navegador: al cambiar un porcentaje, guardar y salir del módulo, el valor se perdía y volvía al predeterminado, de modo que el precio de venta cotizado no era reproducible. Se guardan solo los rubros que difieren del valor por defecto del sistema; los demás se resuelven al calcular. Al leer se descartan claves desconocidas y valores no numéricos o fuera de rango, para que un dato corrupto no altere el cálculo de toda la actividad. -->

<!-- ADR-100 (Aceptada, 2026-10-07): un recurso que no existe en el catálogo se ingresa con un formulario propio, nunca con una ventana emergente del navegador. El formulario propone como nombre lo que el usuario ya había escrito en el buscador, pide la tarifa y, opcionalmente, unidad, cantidad y rendimiento diario para que la línea quede completa de una vez. Al aceptar, la línea se agrega a la actividad y el buscador del rubro queda en blanco: el usuario ve que el recurso entró y puede seguir buscando sin borrar nada a mano. El recurso queda solo en esa actividad hasta que se registre formalmente en el catálogo. -->


<!-- ADR-098 (Aceptada, 2026-10-07): los cuatro rubros del APU (equipos, materiales, mano de obra y transporte) son plegables de forma independiente. Plegado, cada rubro sigue mostrando su cantidad de recursos y su costo base, para que el valor de la actividad siga a la vista sin abrir las tablas. El estado plegado es una preferencia de interfaz y por eso se guarda en `localStorage`: es visual, no autoritativo, y no interviene en lo que se persiste en Supabase. El cuerpo plegado se retira del flujo con el atributo `hidden` en lugar de solo ocultarlo con estilos, para que su contenido no quede disponible para lectores de pantalla ni para el tabulador cuando el rubro está cerrado. Cada control declara `aria-expanded` y `aria-controls`. -->

<!-- ADR-097 (Aceptada, 2026-10-07): la ficha de una actividad y el resumen del presupuesto son dos cosas distintas y no se mezclan. Dentro de la ficha solo se muestra lo de esa actividad: precio de venta total, precio de venta por unidad, costo por unidad y su operación explícita costo total ÷ cantidad. El resumen que suma todas las actividades vive en una barra propia a nivel de módulo, arriba del listado. Se eliminó del resumen la "unidad ponderada" y el total de unidades: las actividades se miden en unidades distintas (und, m2, ml, gal) y sumarlas entre si no produce una cifra con significado tecnico. El resumen solo muestra cifras en pesos -costo directo, ganancia y precio de venta total- y cuantas actividades estan aun sin cotizar, para que se distingan las terminadas del trabajo en curso. -->

<!-- ADR-096 (Aceptada, 2026-10-07): el módulo de APUs es un punto de entrada autónomo y se entra a él limpio. El contexto de cotización viaja únicamente en la URL (`/apu?quoteId=…`) y solo existe cuando se llega desde la cotización; al navegar por el menú a `/apu` sin parámetros no hay contexto, se muestran todas las actividades de la empresa y no queda rastro de la última cotización trabajada. Para no depender de recordar la ruta de la cotización, el módulo incorpora una búsqueda por código del APU, nombre de la actividad y empresa que contrata o título de la cotización: cada actividad muestra en su lista y en la ficha a qué cotización pertenece, de modo que el origen es visible sin necesidad de un contexto pegado. La búsqueda ignora tildes y mayúsculas, admite varios términos a la vez y muestra el contador de coincidencias. La edición de una actividad sigue condicionada al estado de su cotización: solo es editable si la cotización está enestimating o revision_requested. -->

<!-- ADR-095 (Aceptada, 2026-10-07): el costo por unidad de una actividad es el costo directo total dividido por la cantidad de la obra de esa actividad, y se presenta de forma explícita como la operación `costo total ÷ cantidad = costo por unidad` junto al precio de venta por unidad. Antes el valor ya se calculaba pero aparecía como una línea secundaria bajo el total, lo que lo hacía pasar desapercibido; además, como las actividades se crean con cantidad 1, el costo por unidad coincidía con el total y parecía que la división no ocurría. Por eso la cifra es ahora una tarjeta propia y, cuando la cantidad es 1 o no está definida, se advierte explícitamente que el costo por unidad no es confiable hasta registrarla. -->

<!-- ADR-094 (Aceptada, 2026-10-07): el APU puede importarse desde el mismo libro que exporta el sistema, pero nada se escribe en la base de datos hasta que el usuario revisa una vista previa. El libro se lee íntegramente en el navegador (`ArrayBuffer` + ExcelJS cargado de forma diferida) y nunca se sube a ningún servidor: el archivo del cliente no sale del equipo. La lectura no es posicional: se localiza la fila de encabezados buscando la celda "RECURSO" y se interpretan los rótulos de cada rubro, de modo que insertar filas, dejar filas en blanco, reordenar columnas o cambiar mayúsculas y tildes en los títulos no rompe la importación. Una cantidad puede llegar en texto ("1,5 m3", "12 und") o con formato colombiano; se interpreta el número y, si no es posible, la línea se marca en vez de inventarse un valor. Las filas de subtotal, resumen y encabezado no se toman como recursos. Toda línea sin cantidad se muestra marcada en la vista previa y el usuario decide de forma explícita si entra con cantidad 1 para ajustarla después o si queda fuera del APU; nunca se descarta en silencio ni se importa en cero sin avisar. Si el parcial del archivo no coincide con cantidad × tarifa dentro del 1 %, se advierte y se usa el cálculo del sistema. El código del archivo solo se respeta si no está repetido en el sistema; si lo está, se genera el consecutivo normal. -->

<!-- ADR-093 (Aceptada, 2026-10-07): un artículo puede tener varios proveedores y solo uno preferido. Se modela la relación en `supplier_products` (empresa, proveedor, artículo, precio, unidad de compra, plazo, mínimo a pedir), no una columna `supplier_id` en `inventory_items`: así se comparan precios entre opciones y se cambia el proveedor de cabecera sin perder el historial. La unicidad del preferido no se deja en manos del código sino en un índice único parcial sobre `(company_id, item_id) WHERE is_preferred`, de modo que la base de datos garantiza la regla aunque dos sesiones compitan; por eso toda promoción de preferencia retira primero el título del anterior y solo después escribe el nuevo. El NIT es único por empresa, no global: el mismo tercero puede facturar a dos compañías. Un proveedor no se elimina si tiene artículos vinculados, se desactiva, para no destruir el historial de compras; el bloqueo es un disparador, no una regla del cliente. La vista `item_suppliers_overview` es de solo lectura con `security_invoker`, para que las políticas RLS de las tablas base sigan aplicando. -->

<!-- ADR-083 (Aceptada, 2026-10-06): las unidades de actividad APU usan un combobox local, accesible y filtrable. Cada opción muestra nombre y símbolo, pero la entidad guarda solamente el símbolo técnico para mantener consistencia en cantidades, costos, impresiones y exportaciones. -->

<!-- ADR-092 (Aceptada, 2026-10-07): dar de baja un recurso por deterioro, daño, vencimiento, pérdida u obsolescencia es una operación autorizada y auditable, no un ajuste manual de inventario. La baja se registra en `inventory_writeoffs` mediante RPC `security definer` con `search_path` fijo: valida rol de administrador/responsable de inventario, bloquea la existencia con `for update`, calcula el valor al costo vigente y verifica que las existencias cubran la cantidad, de modo que el saldo nunca queda negativo. Si el valor supera el umbral configurado por empresa en `inventory_writeoff_policies` (por defecto $5.000.000), la baja queda `pending_approval` y no descuenta nada hasta que un administrador la autoriza; por debajo del umbral se aplica de inmediato. La aplicación inserta un movimiento `adjustment_out` referenciado con el código de la baja y reutiliza el disparador del kardex, de forma que el descuento y su valorización pasan por la misma única vía auditada que el resto del inventario. El actor se toma de la sesión en el servidor, nunca del navegador. La evidencia fotográfica se guarda en el bucket privado `writeoff-evidence` y se sirve con URL firmada de corta duración. Solo un administrador puede cambiar el umbral. -->

<!-- ADR-090 (Aceptada, 2026-10-06): el APU es un presupuesto de materiales, no un consumo. Un recurso puede costearse aunque hoy tenga cero existencia en bodega; la interfaz muestra la existencia en ámbar como dato informativo, nunca como error, y explica que el material se compra o ingresa al inventario y se despacha a la obra al ejecutarse. El circuito de abastecimiento previsto es: APU → conversión a obra → requisición al almacén → orden de compra → entrada al inventario → despacho a la obra. El módulo de Compras/Proveedores queda pendiente (COM-01) porque sin él el circuito no cierra. -->
<!-- ADR-091 (Aceptada, 2026-10-06): el responsable de cada cambio en el historial de cotizaciones lo determina Supabase a partir de la sesión (`auth.uid()` → `profiles.display_name`) mediante la RPC `save_quote_with_history`, nunca el valor enviado por el navegador. Así cualquier empleado autenticado queda correctamente registrado y no se puede atribuir un cambio a otra persona. -->
<!-- ADR-085 (Aceptada, 2026-10-06): la persistencia operativa de RFC Enterprise es obligatoria en Supabase. `localStorage` puede conservar preferencias de interfaz o caché no autoritativa, pero jamás confirma altas, ediciones, movimientos, conteos, préstamos, requisiciones, obras, cotizaciones o documentos. Cada módulo se migra a un repositorio con errores visibles cuando la base no esté disponible. -->
<!-- ADR-086 (Aceptada, 2026-10-06): el alta de inventario se resuelve con una RPC transaccional con autorización explícita. La función exige sesión y rol administrador/responsable de inventario para la empresa; crea artículo, existencia y movimiento de apertura sin exponer llaves privilegiadas al navegador. -->
<!-- ADR-087 (Aceptada, 2026-10-06): Resumen ejecutivo e Informes son lectores de Supabase. Sus indicadores se calculan a partir de datos persistidos; un navegador sin conexión no inventa ni restaura cifras operativas. -->
<!-- ADR-088 (Aceptada, 2026-10-06): los préstamos de herramientas se persisten por empresa, sede, obra y existencia en `inventory_tool_loans`; creación, devolución y anulación confirman la respuesta de Supabase antes de actualizar la interfaz. -->
<!-- ADR-084 (Aceptada, 2026-10-06): el rol laboral se asigna al crear la ficha. La membresía `user_roles`, exigida por RLS, se crea o repara en el flujo administrativo que crea/reestablece la cuenta Auth, usando la misma empresa, sede y rol; no se presentan permisos ficticios antes de existir una cuenta de acceso. -->
<!-- ADR-089 (Aceptada, 2026-10-06): la conversión Cotización→Obra persiste en Supabase en orden estricto: 1) crear `projects`, 2) actualizar `quotes` con project_id/project_code/status in_execution, 3) insertar `quote_history`. Si un paso falla, la UI no confirma nada localmente y se muestra el error; no se usa localStorage para obras, cotizaciones ni historial. El consecutivo `OBRA-YYYYMMDD-N` se calcula desde los códigos reales de cada empresa y se valida con el constraint `unique(company_id, code)`. -->
<!-- ADR-083 (Aceptada, 2026-10-06): Cotizaciones y sus cambios de estado se comparten por empresa mediante `quotes` y `quote_history` en Supabase. El navegador solo conserva una caché de contingencia, nunca la confirmación de negocio. Toda alta usa UUID y toda cuenta sin membresía recibe un error accionable. -->

## ADR-073 · Identidad legible de la obra de origen comercial

**Fecha:** 2026-10-02
**Estado:** Aceptada

El consecutivo de obra conserva el formato operativo `OBRA-AAAAMMDD-##`. Cuando nace de una cotización, el nombre de la obra inicia con el código efectivo de la cotización (incluida la revisión), mientras se guardan `sourceQuoteId` y `sourceQuoteCode` para un enlace seguro y navegable.

El enlace comercial hacia Obras utiliza `projectId` en la URL para abrir la ficha concreta; el retorno utiliza `sourceQuoteId`. La referencia se muestra como control de navegación, no como texto informativo secundario.

Para compatibilidad de datos existentes, una obra también resuelve su cotización de origen al encontrar una cotización cuyo `projectId` o `projectCode` coincide con ella.

Las acciones operativas de Obras y Proyectos disponen de ayuda contextual breve y visible mediante foco, cursor o toque, sin ocultar las etiquetas funcionales.

## ADR-074 · APU persistente con edición por estado comercial

**Fecha:** 2026-10-02
**Estado:** Aceptada

El APU es evidencia de la estimación y nunca se oculta por un cambio de pipeline. Solo los estados `estimating` y `revision_requested` permiten crear, editar, guardar o eliminar APUs. En estados posteriores se abre en consulta para preservar la propuesta enviada; una nueva revisión restablece la edición.

## ADR-075 · Proyecto como entidad general; alquiler como tipo

**Fecha:** 2026-10-02
**Estado:** Aceptada

`Proyecto` es la entidad transversal creada al adjudicar una cotización. `Obra`, `Mantenimiento` y `Alquiler` son tipos de proyecto. El alquiler tendrá consecutivo `ALQ`, control de periodo, equipo en custodia y cargos adicionales antes de facturar.

## ADR-076 · Alquiler rápido para clientes particulares

**Fecha:** 2026-10-02
**Estado:** Aceptada

El alquiler de corta duración no exige cotización ni APU. Se registra mediante un comprobante operativo `ALQ-RAP`, con cliente, teléfono, documento, periodo, tarifa, garantía, accesorios y estado. Al entregar, descuenta una unidad disponible; al devolver, registra novedades/cargo adicional y la restaura.

## ADR-077 · Informes por propósito de decisión

**Fecha:** 2026-10-02
**Estado:** Aceptada

Los informes se clasifican en Gerenciales, Operativos y Financieros para que cada usuario encuentre el indicador requerido sin conocer la estructura técnica de los módulos. La versión inicial consulta datos locales y deja para la fase de permisos el control de acceso y exportación.

## ADR-078 · Navegación uniforme para módulos internos

**Fecha:** 2026-10-02
**Estado:** Aceptada

Las rutas de módulos internos se renderizan dentro de `DashboardShell`. Ningún módulo operativo puede abrir como página aislada, pues debe preservar navegación, sesión, alertas y diseño adaptable del portal.

Este registro conserva decisiones que afectan el rumbo del producto. Una decisión no se elimina: si cambia, se agrega una nueva entrada que indique cuál reemplaza.

## ADR-079 · Jornadas periódicas de conteo físico

**Fecha:** 2026-10-05
**Estado:** Aceptada

La carga inicial y los conteos posteriores comparten la entidad `physical_counts`, pero la interfaz obliga a abrir una jornada explícita y elegir su alcance antes de aceptar cantidades. El cierre compara conteo contra saldo de sistema y genera ajustes auditables; no sobrescribe existencias sin dejar movimiento, motivo y sesión vinculada.

## ADR-001 · Monolito modular

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** RFC Enterprise crecerá a múltiples procesos, pero está en una etapa inicial donde varios despliegues y repositorios independientes añadirían complejidad innecesaria.

**Decisión.** Mantener una aplicación Next.js con límites explícitos entre `core`, `shared`, `modules` y `app`.

**Consecuencia.** La entrega es simple de desplegar, pero los límites de importación deberán revisarse en cada cambio. Si un dominio requiere escalar de forma autónoma en el futuro, se tomará una nueva decisión documentada.

---

## ADR-002 · Usuario no es trabajador

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** La cuenta que ingresa al ERP y el expediente de una persona empleada tienen ciclos de vida distintos.

**Decisión.** Modelar usuarios de plataforma por separado de trabajadores del futuro módulo de Talento Humano.

**Consecuencia.** Una persona empleada podrá tener o no una cuenta de usuario, y la identidad no quedará acoplada a contratos, nómina o datos laborales.

---

## ADR-003 · Permisos por código, no por banderas de interfaz

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** Banderas como `isAdmin` o `isAlmacenista` no escalan para varios módulos y responsabilidades.

**Decisión.** Definir roles compuestos por permisos con códigos estables, por ejemplo `core.users.manage` e `inventory.movements.create`.

**Consecuencia.** La versión actual sólo define la base de Core; antes de flujos reales habrá que completar permisos por módulo y aplicarlos del lado servidor.

---

## ADR-004 · Datos semilla y persistencia híbrida

**Fecha:** 2026-09-15 (Actualizada 2026-09-16)  
**Estado:** Aceptada

**Contexto.** Se requería operar con el catálogo completo de 1,191 productos reales de RFC garantizando fluidez tanto en entornos locales como conectados a Supabase.

**Decisión.** Normalizar el catálogo completo como base reactiva con persistencia local (`localStorage`) sincronizable con el backend de Supabase.

---

## ADR-005 · Autenticación Supabase Auth

**Fecha:** 2026-09-16
**Estado:** Aceptada

**Contexto.** Se requería un sistema de autenticación seguro, validado en servidor, con tokens JWT y recuperación de credenciales.

**Decisión.** Adoptar Supabase Auth gestionado con `@supabase/ssr` e identidades verificadas por correo.

---

## ADR-007 · Confirmación y Preservación Obligatoria de Documentación

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Para evitar pérdida de contexto o desviaciones de alcance, todo acuerdo, modelo de datos y diseño funcional debe ser registrado inmediatamente en la carpeta `docs/`.

**Decisión.** Exigir la confirmación explícita de archivos guardados y un resumen de acuerdos al usuario en cada iteración del asistente AI.

---

## ADR-008 · Rediseño del Dashboard Principal y Extensiones Operativas de Inventario

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Se necesitaba elevar la visibilidad del estado financiero de los proyectos desde la pantalla principal (`/dashboard`) y proveer formatos de remisión imprimibles, requisiciones de obra, custodia de herramientas y devoluciones de sobrantes.

**Decisión.** 
1. Rediseñar `/dashboard` como un **Panel Ejecutivo de Obras y Materiales**, mostrando métricas consolidadas, semáforos de avance presupuestal por proyecto y accesos a operaciones de almacén.
2. Implementar vales de salida imprimibles (remisión con espacio de firmas para archivo físico o PDF).
3. Añadir la gestión de requisiciones de frente de obra, custodia de herramientas entregadas a trabajadores y devoluciones de material sobrante a bodega.

---

## ADR-009 · Módulo y Ruta Dedicada de Proyectos / Obras (/projects)

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** El usuario requiere una vista específica y profunda para inspeccionar la Ficha de Obra completa: materiales e insumos gastados por proyecto, herramientas en custodia y requisiciones de frente de trabajo.

**Decisión.** Crear la ruta dedicada `/projects` con navegación en la barra lateral del portal y la vista `ProjectsWorkspace` para la inspección detallada de obras, presupuestos y kardex de insumos imputados.

---

## ADR-010 · Niveles de Empleado (RBAC), Visibilidad de Dashboard y Separación de Rutas

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Se detectaron dos necesidades clave:
1. En la barra de navegación lateral se seleccionaban simultáneamente "Inventarios" y "Movimientos" porque ambos apuntaban a `/inventory` y compartían el mismo icono.
2. Es indispensable formalizar la jerarquía de roles de empleados (RBAC) y la matriz de qué información puede ver cada nivel en el Dashboard y la plataforma.

**Decisión.**
1. **Separación de rutas de navegación:**
   - `/dashboard`: Panel Ejecutivo, Inteligencia de Costos y Saludo Contextual (Icono `grid`).
   - `/projects`: Ficha de Obras, Centros de Costo y Materiales Gastados (Icono `building`).
   - `/inventory`: Catálogo de 1,191 insumos, niveles de stock y ajuste de mínimos (Icono `boxes`).
   - `/movements`: Kardex general de entradas, salidas por obra, devoluciones y remisiones (Icono `arrows`).
2. **Matriz de 5 Niveles de Empleado y Visibilidad:**
   - **Nivel 1: Administrador / Gerencia General**: Acceso total, finanzas en COP, presupuestos globales, ranking de materiales costosos, auditoría y parametrización.
   - **Nivel 2: Ingeniero Residente / Director de Obra**: Fichas de sus obras a cargo, avance presupuestal de su obra, aprobación de requisiciones y custodia de herramientas. No ve finanzas corporativas globales.
   - **Nivel 3: Jefe de Almacén / Bodeguero**: Prioridad en alertas de stock crítico bajo mínimo, requisiciones pendientes, emisión de vales/remisiones y control de préstamos de herramientas.
   - **Nivel 4: Maestro de Obra / Cuadrilla**: Solicitudes rápidas de materiales desde frente de obra, consulta de herramientas recibidas y registro de sobrantes.
   - **Nivel 5: Auditor / Contador de Costos**: Kardex valorizado, remisiones históricas, auditoría de consumos y balances financieros sin modificación física de inventario.
3. **Paneles de Inteligencia en Dashboard:** Top 5 materiales más costosos despachados, gráfico comparativo de gasto por obra, tabla de stock crítico bajo mínimo, saludo contextual y sistema de notificaciones toast.

---

## ADR-011 · Calendario operativo de proyectos

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Decisión.** Cada obra registra fecha de inicio, fecha estimada de finalización y estado (`pending`, `active`, `on_hold`, `completed`). La base de datos impide fechas finales anteriores al inicio y protege los registros con RLS para miembros autorizados de la empresa.

La edición inicia con un selector visual de obras y abre el formulario únicamente para la obra elegida. Los ajustes de presupuesto se mantienen como una acción financiera separada para auditar su historial.

---

## ADR-012 · Operaciones auditables de inventario

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Decisión.** Inventarios centraliza ubicaciones detalladas, recepciones de compra, conteos físicos con aprobación, puntos de reorden, movimientos valorizados, ajustes presupuestales y registros de auditoría en Supabase. Una salida exige una obra activa; los datos se protegen con RLS por empresa y roles de inventario.

**Consecuencia.** El script `20260916_inventory_operations.sql` debe aplicarse en Supabase antes de habilitar la sincronización de escritura en producción.

**Extensión.** La creación de un artículo incluye su cantidad y costo iniciales y produce un movimiento de entrada, evitando existencias sin trazabilidad.

---

## ADR-013 · Portada institucional orientada a proyectos

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Contexto.** El sitio institucional requería explicar con mayor claridad la oferta de RFC y reemplazar los teléfonos visibles por un mecanismo de contacto más apropiado para solicitudes de proyecto.

**Decisión.** Ampliar la portada con capacidades verificables de arquitectura e ingeniería, estructuras metálicas, mantenimiento y paisajismo; un enfoque de trabajo; recursos visuales de Caucasia y operación petrolera industrial; y un formulario de solicitud sin publicar teléfonos.

**Consecuencia.** El formulario conserva sus campos, pero su botón de envío permanece inactivo hasta definir un correo corporativo receptor o una integración segura con Supabase. No se almacenarán datos de contacto en el navegador.

---

## ADR-014 · Directorio laboral y permisos por empleado

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** Administrar a cada empleado mediante una ficha laboral separada de su identidad de Supabase Auth. La ficha admite activación, uno o más roles y excepciones de permiso explícitas (`grant` o `revoke`), registradas bajo RLS y auditoría.

**Consecuencia.** Un administrador puede preparar el acceso de un empleado antes de que este tenga cuenta. Para enviar la invitación y enlazar la ficha con Auth se requiere configurar en servidor el secreto administrativo de Supabase; nunca se expone en el navegador.

---

## ADR-015 · Identidad visual oficial en documentos operativos

**Fecha:** 2026-09-17  
**Estado:** Aceptada

**Decisión.** Los vales de salida, remisiones, informes imprimibles y futuros comprobantes utilizan el archivo oficial `public/rfc-logo.svg` en el membrete. El formato no publica números telefónicos de contacto.

**Consecuencia.** Cualquier nuevo generador de PDF o impresión debe reutilizar este activo y no recrear el logo con texto o una imagen alternativa.

---

## ADR-016 · Acceso institucional al portal de empleados

**Fecha:** 2026-09-17  
**Estado:** Aceptada

**Decisión.** La cabecera de la portada pública incluye el enlace visible “Portal de empleados”, dirigido a `/login`; permanece disponible en móvil y escritorio sin competir con la llamada de contacto comercial.

---

## ADR-017 · Identidad de sesión y canal de solicitudes

**Fecha:** 2026-09-17  
**Estado:** Aceptada

**Decisión.** La cabecera del portal consulta el perfil de la sesión autenticada y muestra su `display_name` y rol, sin usar un nombre fijo. El formulario institucional prepara un correo con los datos de la solicitud para `rfcsas094@gmail.com`, sin publicar teléfonos ni persistir los datos en el navegador.

**Pendiente acordado.** Implementar en una fase posterior el envío directo mediante Edge Function de Supabase y un proveedor de correo transaccional. Las claves del proveedor residirán solo en secretos de Supabase; el formulario público deberá usar validación, límite de solicitudes y protección antispam.

---

## ADR-018 · Cierre de sesión y cambio de usuario

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** La cabecera del portal incorpora una acción visible para cerrar la sesión de Supabase y volver a `/login`. Esto permite que otra persona use el mismo equipo sin reutilizar la sesión anterior.

---

## ADR-019 · Catálogos buscables durante el alta de inventario

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** El formulario de nuevo artículo inicia sin categoría, marca, unidad ni ubicación preseleccionadas y usa sugerencias filtrables para esos valores. Categoría, unidad y ubicación son obligatorias; la marca conserva “Sin marca” como opción explícita. Si el valor no existe, el usuario puede crearlo y seleccionarlo en el mismo campo, sin abrir otra página ni perder lo ya diligenciado.

**Consecuencia.** La ubicación seleccionada se guarda directamente en el artículo. Los catálogos muestran primero las opciones existentes ordenadas alfabéticamente y evitan entradas repetidas por mayúsculas o acentos.

---

## ADR-020 · Unidades de compra y consumo

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** Los artículos nuevos registran una unidad de consumo, una presentación de compra y un factor de conversión. La cantidad y el costo capturados corresponden a la presentación recibida; existencias y costo unitario se calculan en la unidad de consumo.

**Ejemplo.** Tres cajas de 100 tornillos se registran como 300 unidades disponibles; cada despacho puede descontar una o varias unidades.

---

## ADR-021 · Manual de usuario operativo

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** RFC Enterprise cuenta con un manual paso a paso para los roles operativos y administrativos. Cubre acceso, catálogo, unidades de compra y consumo, movimientos, ajustes físicos, conteos, proyectos, informes, empleados y permisos.

**Consecuencia.** El manual debe actualizarse cuando se aprueben nuevos módulos o cambien los procesos de operación.

---

## ADR-022 · Informes operativos interactivos

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** Informes consolida inventario, Kardex, stock crítico y ejecución por obra con filtros de categoría y obra, indicadores, gráficos SVG responsivos, CSV e impresión con identidad RFC. Los datos se leen de la operación local actual para reflejar los movimientos del portal.

---

## ADR-023 · Flujo de requisiciones y sincronización del directorio

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** Los maestros y residentes generan requisiciones dentro de la obra; el almacén las recibe como pendientes, confirma las cantidades disponibles y emite el despacho y su Kardex. Los perfiles existentes que ya poseen empresa y rol se incorporan al directorio de empleados mediante una sincronización idempotente, sin alterar su rol ni duplicar registros.

**Consecuencia.** El indicador de requisiciones pendientes solo aumenta cuando una solicitud ha sido enviada desde una obra. El directorio representa tanto empleados creados desde administración como usuarios ya habilitados para el portal.

---

## ADR-024 · Recuperación y cambio de contraseña

**Fecha:** 2026-09-17
**Estado:** Aceptada

**Decisión.** El inicio de sesión incluye recuperación por correo con enlace de un solo uso y el portal ofrece cambio voluntario con confirmación de la clave actual. Las operaciones se ejecutan mediante Supabase Auth y las credenciales no se persisten en tablas de negocio.

**Consecuencia.** Debe configurarse la URL de retorno de producción en Supabase Auth y un servicio SMTP de producción para una entrega confiable de los correos.

---

## ADR-025 · Tipificación y código automático de proyectos

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** Al dar de alta un proyecto, el usuario selecciona `obra`, `mantenimiento` u `otro`. La aplicación calcula y muestra, sin permitir su edición, un código con el prefijo del tipo y un consecutivo de dos dígitos por fecha de inicio: `OBRA-AAAAMMDD-##`, `MANT-AAAAMMDD-##` u `OTRO-AAAAMMDD-##`.

**Consecuencia.** El tipo y el código quedan asociados al proyecto en la persistencia local actual. Los datos que no pueden inferirse de forma fiable —nombre, cliente, ubicación, presupuesto y fecha estimada— continúan siendo diligenciados por el usuario.

---

## ADR-026 · Formato de captura para valores monetarios COP

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** Los campos de presupuestos, costos y ajustes monetarios conservan internamente una cadena numérica para sus cálculos. Al perder foco, muestran el valor como pesos colombianos sin decimales —por ejemplo, `$500.000`— y al recibir foco se presentan nuevamente para edición numérica.

**Consecuencia.** La aplicación reduce errores de lectura en formularios sin modificar los valores almacenados o las operaciones de cálculo.

---

## ADR-027 · Asignación de empleados a proyectos

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** El formulario de alta de obras se limita a los datos de la obra. Después de crear y seleccionar el proyecto, una pestaña Personal de obra consulta el directorio de empleados activos. El usuario elige una persona, la agrega a una lista visible y puede retirarla si se asignó por error. La ficha del proyecto conserva y muestra el personal asignado.

**Consecuencia.** La asignación queda en la persistencia local actual del módulo de proyectos. Su relación transaccional en Supabase se incorporará con la migración operativa de Proyectos.

---

## ADR-028 · Fechas de despacho y de entrega real de obra

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** La fecha y hora del despacho se capturan automáticamente al confirmar la salida y quedan en el movimiento de inventario y la remisión. La fecha real de entrega o finalización se solicita al marcar la obra como finalizada; se valida contra la fecha de inicio, pero puede ser anterior a la fecha estimada.

**Consecuencia.** Se diferencia la evidencia operativa de cada entrega de insumos del hito de cierre de la obra. Reabrir una obra elimina la fecha real de entrega anterior y exige una nueva fecha estimada.

---

## ADR-029 · Custodia de herramientas por obra

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** Las herramientas y equipos se asignan desde existencias disponibles a una persona previamente incluida en Personal de obra. El préstamo registra responsable, fecha de salida automática, fecha prevista y observaciones. La devolución se confirma con fecha y hora automática y un estado: buen estado o con novedad/dañada.

**Consecuencia.** Asignar una herramienta disminuye la disponibilidad en una unidad. Devolverla en buen estado repone esa unidad; una devolución dañada conserva el registro de novedad y no repone la disponibilidad hasta su revisión. Una asignación activa registrada por error puede anularse explícitamente, eliminando su custodia y reponiendo la unidad.

---

## ADR-030 · Clasificación operativa de artículos y búsqueda de custodia

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** El sistema clasifica los artículos del catálogo a partir de su grupo, categoría y nombre en Material/Insumo, Herramienta, Equipo o Dotación/EPP. El catálogo permite filtrar por esta clasificación. El registro de custodia solo presenta Herramientas y Equipos disponibles y ofrece búsqueda por nombre, código, marca o categoría antes de seleccionarlos.

**Consecuencia.** Los consumibles, materiales y elementos de protección no aparecen en la asignación de herramientas. Las herramientas que estén ubicadas en Bodega o en Herramientas de trabajadores se pueden encontrar y custodiar bajo la misma regla.

---

## ADR-031 · Orden operativo de pestañas de obra

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** Las pestañas de la ficha de obra se ordenan como Materiales e insumos, Herramientas en custodia, Personal de obra, Requisiciones y Ajustes de presupuesto. Este último queda al final como información de consulta. Cada pestaña usa un icono SVG asociado a su función.

**Consecuencia.** La interfaz refleja la consulta y gestión habitual de una obra, prioriza los costos y custodia operativa, y evita iconos dependientes de emojis o de la plataforma.

---

## ADR-032 · Búsqueda visible y formularios alineados en Inventario

**Fecha:** 2026-09-18
**Estado:** Aceptada

**Decisión.** La búsqueda del catálogo ofrece una lista de coincidencias mientras se escribe. Al seleccionar una coincidencia, se restablecen filtros de grupo, tipo, existencias, ubicación y categoría para mostrar el artículo. Los formularios de categorías y ubicaciones usan una grilla específica que evita que los botones cubran los campos; Configuración incorpora un icono SVG.

**Consecuencia.** Los artículos se encuentran aunque un filtro previo no tenga resultados. La configuración mantiene etiquetas visibles y controles utilizables en escritorio y dispositivos táctiles.

---

## ADR-033 · Suite de Endurecimiento de Seguridad y Transición a Next.js SSR

**Fecha:** 2026-09-21  
**Estado:** Aceptada

**Contexto.** El proyecto operaba con exportación puramente estática (`output: "export"`), lo que impedía la ejecución de middleware de borde, el refresco de cookies de sesión en servidor, el uso de cabeceras HTTP de seguridad dinámicas y el funcionamiento de API routes transaccionales (`/api/employees/password-reset`). Además, la auditoría integral de seguridad identificó bypasses potenciales en login sin Supabase, ausencia de redirección forzada en Server Components, contraseñas débiles y datos personales en bundle cliente.

**Decisión.**
1. **Transición a SSR en Next.js**: Remover `output: "export"` para habilitar el motor Serverless en Vercel.
2. **Middleware de Borde (`src/middleware.ts`)**: Proteger rutas `/dashboard`, `/inventory`, `/projects`, `/movements`, `/employees`, `/counts` y `/reports`, redirigiendo automáticamente a `/login` si no hay sesión activa y refrescando cookies `@supabase/ssr`.
3. **Autenticación Estricta en Servidor**: Modificar `requireAuthenticatedUser()` para invocar `redirect("/login")` inmediatamente en lugar de retornar valores nulos pasivos.
4. **Endurecimiento de Login**: Eliminar bypass demo sin Supabase, erradicar credenciales hardcoded por defecto y limpiar logs con correos o errores internos.
5. **Headers de Seguridad y CDN**: Configurar HSTS preload, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff y Referrer-Policy en `next.config.ts` y `vercel.json`.
6. **Hardening de API Route**: Añadir validación estricta de UUID y contraseña, control de tasa (rate limiting a 5 req/min) y registro en `audit_logs`.
7. **Políticas de Base de Datos y Supabase**: Elevar longitud mínima a 10 caracteres con complejidad, requerir confirmación por correo, limitar frecuencia a 60s, fijar timeouts de sesión a 8h por inactividad y 24h absoluto, deshabilitar auto-exposición de tablas y S3, e incorporar `pg_temp` al `search_path` de funciones `private`.

**Consecuencia.** La aplicación se alinea con los estándares de seguridad empresarial requeridos antes de producción, salvaguarda las rutas privadas contra accesos anónimos y garantiza la trazabilidad auditable de operaciones sensibles.

---

## ADR-034 · Adopción de Framework de Pruebas E2E y Validación de Escenarios de Negocio

**Fecha:** 2026-09-22  
**Estado:** Aceptada

**Contexto.** A medida que los módulos de Inventario, Movimientos, Proyectos y Empleados crecen en complejidad, realizar pruebas manuales dispersas en pantalla no asegura la integridad de los flujos críticos (control de acceso, consistencia de inventario, filtros y presupuestos).

**Decisión.**
1. Adoptar **Playwright** (`@playwright/test`) como estándar de pruebas E2E e integración de interfaz siguiendo las guías de `playwright-best-practices`.
2. Estructurar las pruebas bajo el directorio `tests/e2e/` con soporte para reportes visuales y de lista en consola (`npm run test:e2e`).
3. Validar el control de acceso en rutas protegidas, la navegación corporativa y los formularios interactivos de cada módulo.

**Consecuencia.** El equipo cuenta con un mecanismo profesional, repetible y automatizado para validar el comportamiento del ERP antes de despliegues y prevenir regresiones en la experiencia de usuario y seguridad.

---

## ADR-035 · Módulo de Cotizaciones, Embudo Comercial (Kanban) y Trazabilidad Operativa

**Fecha:** 2026-10-01  
**Estado:** Aceptada

**Contexto.** La recepción de solicitudes por correo (planos, visitas de obra, cotizaciones APU) no contaba con un canal operativo centralizado dentro del ERP. Los requerimientos corrían el riesgo de perderse entre correos y mensajes, sin seguimiento de tiempos de respuesta, responsables ni enlace directo hacia la creación del proyecto de obra una vez adjudicado.

**Decisión.**
1. **Módulo Desacoplado `quotes`**: Crear el dominio comercial en `src/modules/quotes/` con contrato público en `index.ts`.
2. **Ciclo de Vida de 12 Estados Operativos**:
   - `received`: 📥 Recibido (llegó correo/solicitud).
   - `in_review`: 🔎 En revisión (análisis de planos, alcance y requisitos).
   - `estimating`: 📝 Cotización en proceso (APU, materiales, cuadrilla y precios).
   - `sent`: 📤 Cotización enviada al cliente.
   - `awaiting_response`: ⏳ Esperando respuesta del cliente (con alerta automática si >3 días sin gestión).
   - `revision_requested`: 🔄 Por modificar (ajustes solicitados por el cliente).
   - `confirmed`: ✅ Trabajo confirmado (aprobación / orden de servicio).
   - `in_execution`: 🚧 En ejecución (obra iniciada en frentes de trabajo).
   - `work_completed`: 📋 Trabajo terminado (ejecución física finalizada).
   - `billing_pending`: 💰 Pendiente facturación / pago (actas o trámite contable).
   - `closed`: 🟢 Cerrado (finalizado integralmente).
   - `lost`: ❌ No adjudicado (no aprobada o cancelada).
3. **Tablero Kanban Interactivo & Vista Tabular**:
   - Vista Kanban con tarjetas arrastrables/desplazables con badges de estado, valores formateados en COP, origen de correo, responsable y alerta de estancamiento.
   - Alternancia ágil a vista de Tabla con búsqueda en vivo, filtros por estado y ordenamiento.
   - Modal de detalle con historial cronológico auditable (`quote_history`), cambio de estado con notas explicativas y vinculación a proyecto.
4. **Consecutivo Estandarizado RFC**: Formato exacto compuesto: `COT-{numero_consecutivo_automatico}-{año_actual}-{nombre_empresa}-{obra}` (ej. `COT-001-2026-OCENSA-CHIMENEA_CCM`), garantizando unicidad, indexación y correspondencia directa con nombres de archivos y expedientes físicos.
5. **Esquema de Base de Datos y RLS**:
   - Tablas `public.quotes` y `public.quote_history` en Supabase con políticas RLS de lectura y escritura para personal autorizado.
6. **Protección de Rutas**: Registro en `src/core/modules/catalog.ts` y protección SSR en `src/proxy.ts` (`/quotes`).

**Evolución e Ideas Acordadas para Próximas Fases:**
- **Pre-costeo / Estimación Paramétrica**: Desglose rápido de Materiales (vinculados al catálogo de 1,191 insumos), Cuadrillas/Mano de obra y Equipos/Maquinaria para generar el APU.
- **Conversión 1-Click a Proyecto (`/projects`)**: Creación automática de la ficha de obra con su centro de costos, presupuesto y fechas al pasar a estado confirmado o en ejecución.
- **Control de Versiones y Revisiones (R0, R1, R2)**: Trazabilidad de ajustes solicitados por el cliente sin perder la cotización original.
- **Semáforo de Vencimiento de Ofertas**: Validez comercial en días con alertas antes del vencimiento por variación de precios de insumos.
- **Registro de Visita Técnica Previa**: Acta de inspección de campo, fotos y levantamiento preliminar antes de cotizar.
- **Exportación de Propuesta Económica en PDF**: Generación membretada lista para enviar al cliente.

**Consecuencia.** La empresa estandariza el flujo comercial desde la recepción del correo hasta el cierre de obra, garantizando cero solicitudes extraviadas, alertas de seguimiento comercial oportunas y enlace directo al módulo de costeo de proyectos.

---

## ADR-036 · Pre-costeo Paramétrico, Trazabilidad de Revisiones (R1/R2), Conversión 1-Click y Propuesta Formal en PDF

**Fecha:** 2026-10-01  
**Estado:** Aceptada

**Contexto.** El módulo de cotizaciones v0.1 requería capacidades avanzadas para adaptarse a la operativa real de ingeniería y construcción de RFC: desglosar costos preliminares antes de adjudicar, gestionar solicitudes de descuento o cambios de alcance sin perder la oferta previa, alertar sobre ofertas comerciales que expiran por volatilidad de insumos, planificar inspecciones en campo y emitir la oferta formal membretada lista para el cliente.

**Decisión.**
1. **Pre-costeo Paramétrico de 3 Rubros**:
   - Modelar `costBreakdown` con: Materiales e insumos, Mano de obra/cuadrillas, Equipos y maquinaria, Transporte/fletes e Imprevistos/AIU.
   - Cálculo automático del valor estimado total y visualización compacta en tarjetas Kanban.
2. **Control de Versiones y Revisiones (R0, R1, R2...)**:
   - Atributo `revision` que añade el sufijo `-R1`, `-R2` al consecutivo base.
   - Flujo de creación de revisión con captura de motivo justificado para preservar la trazabilidad de negociaciones con clientes.
3. **Conversión 1-Click a Obra / Proyecto**:
   - Enlace directo con el módulo `/projects`: botón en cotizaciones confirmadas que genera el código de obra (`OBRA-AAAA-MM-DD-XX`), vincula el identificador y traslada el valor comercial como presupuesto oficial de la obra.
4. **Semáforo de Vigencia Comercial**:
   - Parámetro `validityDays` y cálculo de fecha de caducidad.
   - Etiquetas dinámicas en tarjetas y tabla: *Vigente*, *Vence pronto* (<= 5 días) y *Vencida*.
5. **Inspección Técnica en Campo Previa**:
   - Registro de estado de visita (pendiente/realizada), fecha programada, ingeniero inspector y acta de hallazgos.
6. **Propuesta Comercial Membretada Imprimible en PDF**:
   - Vista modal membretada con identidad institucional de Representaciones Figueroa Castro S.A.S. (Caucasia, Antioquia), alcance, desglose económico, condiciones comerciales y firmas autorizadas de ambas partes con reglas `@media print`.

**Consecuencia.** La empresa cuenta con una suite integral de estimación, negociación y contratación que conecta las oportunidades comerciales con la ejecución física y el control presupuestal de obras.



<!-- ADR-037 (Aceptada, 2026-10-01): Cotizaciones usa layout propio con requireAuthenticatedUser() y DashboardShell. Consecuencia: conserva navegacion lateral, encabezado, respuesta movil y control de acceso sin duplicar interfaz. -->
<!-- ADR-038 (Aceptada, 2026-10-01): el Kanban muestra todas las etapas operativas de cierre. Consecuencia: las cotizaciones en Trabajo terminado y Pendiente pago se localizan sin cambiar a la vista de lista ni depender de filtros. -->
<!-- ADR-039 (Aceptada, 2026-10-01): el arreglo de columnas Kanban se deriva de `quoteStatuses`. Consecuencia: cualquier nuevo estado oficial queda visible en el tablero y no se desincroniza de los selectores. -->
<!-- ADR-040 (Aceptada, 2026-10-01): la conversion de cotizacion a obra escribe en el repositorio persistente de Proyectos y conserva `projectId` y `projectCode` en la cotizacion. -->
<!-- ADR-041 (Aceptada, 2026-10-01): APU es un modulo de negocio independiente que consume el contrato publico de Inventarios para cotizar recursos sin duplicar el catalogo. -->
<!-- ADR-042 (Aceptada, 2026-10-01): el flujo principal de APU inicia dentro del detalle de una cotizacion. Consecuencia: los APUs se identifican con quoteId/quoteCode y consolidan automaticamente el pre-costeo de esa oferta. -->
<!-- ADR-043 (Aceptada, 2026-10-01): APU mantiene un catalogo semilla de actividades reutilizables y permite crear actividades personalizadas. Consecuencia: la operacion no queda limitada a una lista cerrada. -->
<!-- ADR-044 (Aceptada, 2026-10-02): los APUs seran documentos consultables y versionables; consultar, modificar y exportar se resolvera mediante permisos independientes. La asignacion concreta a roles se definira posteriormente. -->
<!-- ADR-045 (Aceptada, 2026-10-02): las salidas APU se generan desde plantillas maestras suministradas por el usuario. El XLSX debe preservar exactamente estructura y presentacion; el PDF comercial se ajustara tras comparar varias muestras reales. -->
<!-- ADR-046 (Aceptada, 2026-10-02): el formato comercial PDF oficial parte del patron comun observado en COT-116, COT-119, COT-121 y COT-128. Se reutilizan `rfc-logo.svg` y la firma real como activos; no se recrea ni se simula la firma. -->
<!-- ADR-047 (Aceptada, 2026-10-02): el tabulador salarial deja de ser únicamente código embebido y se persiste en `public.apu_labor_positions`, aislado por empresa y protegido con RLS. APU consume este catálogo mediante su repositorio y solo recurre a la copia local cuando Supabase no está disponible. -->
<!-- ADR-048 (Aceptada, 2026-10-02): los cambios de un APU en el editor se consideran pendientes hasta pulsar `Guardar APU`; la interfaz confirma hora y código guardado. Editar o eliminar actúa únicamente sobre el APU seleccionado, nunca sobre todos los APUs de la cotización. -->
<!-- ADR-049 (Aceptada, 2026-10-02): la navegación lateral del Dashboard se puede contraer solo en escritorio para liberar área de trabajo. La elección se guarda en el navegador; bajo 980px prevalece el drawer móvil completo y accesible. -->
<!-- ADR-050 (Aceptada, 2026-10-02): un APU es una entidad persistente y versionable. Cada guardado genera una versión con sus líneas y total directo; el análisis conserva la versión vigente, y borrar desde UI lo archiva en vez de destruir su trazabilidad. -->
<!-- ADR-051 (Aceptada, 2026-10-02): el presupuesto de obra adopta una estructura BOQ: cada APU guardado puede ser una línea de presupuesto de una obra, con cantidad contractual, costo unitario, presupuesto total e imputaciones comprometidas/reales. -->
<!-- ADR-052 (Aceptada, 2026-10-02): la clasificación de actividades queda preparada como campo extensible y configurable; cualquier catálogo CSI, UniFormat o ICMS se importará únicamente con licencia/datos autorizados. -->
<!-- ADR-053 (Aceptada, 2026-10-02): el historial de Supabase es la fuente operativa de despliegue y debe coincidir con `supabase/migrations`. Cuando el esquema existente carezca de historial, se verifica primero su presencia y luego se marca como aplicado sin reejecutar DDL; las migraciones aplicadas por la plataforma se renombran localmente a su versión remota. -->
<!-- ADR-054 (Aceptada, 2026-10-02): una línea APU manual representa un costo presupuestado, no un alta de inventario. Solo las líneas seleccionadas desde el catálogo conservan referencia de inventario; el maestro se crea mediante su proceso formal para evitar stock, costo o SKU ficticios. -->
<!-- ADR-055 (Aceptada, 2026-10-02): los catálogos extensos dentro de APU usan búsqueda progresiva y resultados acotados, no selectores nativos. Consecuencia: la interacción mantiene el contexto de la actividad, es usable con teclado/táctil y no desborda el formulario. -->
<!-- ADR-056 (Aceptada, 2026-10-02): el estado inicial de cotizaciones consolida directamente los APUs existentes en el inicializador de estado reactivo perezoso (lazy initializer) eliminando efectos sincronos en cascada. Los componentes de seleccion buscables implementan atributos ARIA completos (aria-controls, aria-expanded, aria-selected) y sincronizacion en render sin efectos reactivos secundarios. -->
<!-- ADR-057 (Aceptada, 2026-10-02): los buscadores de actividades, mano de obra y recursos en APU aplican normalización canónica de caracteres (NFD) para suprimir diacríticos/tildes y dividen las entradas en tokens. La coincidencia en el nombre del elemento tiene prelación estricta sobre grupos o resúmenes de funciones, eliminando falsos positivos en los que aparecían cargos o actividades no relacionadas. -->
<!-- ADR-058 (Aceptada, 2026-10-02): el rubro de Transporte en APU se respalda en un catálogo maestro editable (`apu_transport_items`) estructurado según Odoo Fleet y logística industrial. Cada línea de transporte asignada a un APU guarda una instantánea independiente (snapshot) de su tarifa y unidad. Por diseño arquitectónico, cualquier edición posterior de precios en el maestro solo aplica a nuevos análisis; los APUs históricos, cerrados o en ejecución permanecen financieramente inmutables. -->
<!-- ADR-059 (Aceptada, 2026-10-02): cada APU seleccionado expone un botón "🖨️ Imprimir APU" que abre un modal (ApuPrintModal) con formato institucional A4 que incluye logo RFC, metadatos, 4 tablas de costo por categoría, resumen de costo directo/unitario y zona de firmas. El @media print oculta la interfaz de la aplicación y solo renderiza la hoja A4, permitiendo exportar a PDF desde el navegador. -->
<!-- ADR-060 (Aceptada, 2026-10-02): el selector de obra/proyecto para vincular APUs al presupuesto BOQ fusiona tres fuentes en orden de prioridad: proyectos remotos de Supabase, proyectos almacenados en localStorage (`rfc_inventory_projects`) y proyectos semilla (`initialProjects`). Esto garantiza que el dropdown nunca esté vacío, incluso offline o antes de crear proyectos en la base de datos. En modo local sin companyId, el vínculo BOQ se persiste en localStorage (`rfc_apu_boq_items`). -->
<!-- ADR-056 (Aceptada, 2026-10-02): el flujo comercial de una solicitud es Recibido (radicar correo y adjuntos), En revisión (validar alcance, planos, requisitos y visita) y Cotización en proceso (crear/ajustar APU y propuesta). El APU no se edita antes de esa etapa salvo que se devuelva Por modificar. -->
<!-- ADR-061 (Aceptada, 2026-10-02): el Dashboard es una consola ejecutiva modular, no solo de inventario. Consolida lecturas locales de Cotizaciones, APUs y Obras y ofrece enlaces de acción; no duplica sus datos ni sus reglas de negocio. -->
<!-- ADR-062 (Aceptada, 2026-10-02): los aliases de Inventario son metadatos de búsqueda. Se comparan con normalización de tildes y por tokens, pero el resultado conserva siempre nombre, SKU y unidad técnicos para impedir ambigüedad operativa. -->
<!-- ADR-063 (Aceptada, 2026-10-02): las acciones de persistencia APU deben comunicar explícitamente el resultado y su destino. No se presenta un guardado local como si fuera una confirmación de base de datos. -->
<!-- ADR-064 (Aceptada, 2026-10-02): las alertas del Dashboard se derivan de los datos de sus módulos y no duplican estados. Cada alerta expresa origen, causa, prioridad y un enlace para atenderla; solo las alertas críticas o de advertencia usan animación, compatible con reducción de movimiento. -->
<!-- ADR-065 (Aceptada, 2026-10-02): una vista previa extensa debe desplazar su propio contenido y conservar una salida disponible arriba y abajo. Los controles se excluyen de la impresión final. -->
<!-- ADR-066 (Aceptada, 2026-10-02): las ayudas contextuales exponen la regla operativa junto al control que la requiere. En Cotizaciones son accesibles por cursor, foco de teclado y toque; no dependen exclusivamente del hover. -->
<!-- ADR-067 (Aceptada, 2026-10-02): cada estado oficial del pipeline comercial posee una explicación contextual propia en su columna Kanban. La ayuda indica la acción esperada, no solo una definición nominal. -->
<!-- ADR-068 (Aceptada, 2026-10-02): toda propuesta comercial impresa debe incluir el valor en cifra y en letras en mayúsculas con la leyenda PESOS COLOMBIANOS M/L; la leyenda se calcula del total presentado en esa versión. -->
<!-- ADR-069 (Aceptada, 2026-10-02): para evitar redundancia visual, la línea VALOR A PAGAR muestra únicamente el valor en letras. Las notas comerciales se administran en la ficha de la cotización y se ubican debajo de esa leyenda al imprimir. -->
<!-- ADR-070 (Aceptada, 2026-10-02): las notas comerciales usan saltos de línea como delimitador de filas de impresión. La interfaz lo indica junto al campo para que el usuario controle el resultado documental. -->
<!-- ADR-071 (Aceptada, 2026-10-02): la conversión de Cotización a Obra persiste identificador y código de oferta de origen en la obra. La ficha resuelve también enlaces históricos por projectId/projectCode y retorna al detalle de Cotizaciones mediante parámetro quoteId. -->
<!-- ADR-072 (Aceptada, 2026-10-02): la trazabilidad de cotizaciones se representa como línea de tiempo; cada evento conserva responsable, fecha, transición y nota como unidades visuales separadas. -->
<!-- ADR-080 (Aceptada, 2026-10-05): la ficha de artículo permite capturar valores nuevos de categoría, marca, modelo, referencia, unidad, presentación y ubicación escribiéndolos directamente. El valor solo se reutiliza como sugerencia después de quedar respaldado por un artículo guardado; evita catálogos huérfanos y permite la carga inicial sin salir del flujo. -->
<!-- ADR-081 (Aceptada, 2026-10-05): la evolución de Inventario inicia por el ciclo compartido requisición de obra → aprobación/despacho → remisión firmada → devolución. Las bajas, compras/reposición, activos/QR y analítica se construyen sobre ese mismo Kardex y no como registros paralelos. -->
<!-- ADR-082 (Aceptada, 2026-10-05): toda reparación de taller se documentará como una orden de servicio con recepción y remisión de entrega firmadas. El documento registra activo/equipo, serial, tercero u obra, diagnóstico, trabajo ejecutado, repuestos, notas, quien entrega y quien recibe. Si se utilizan repuestos de RFC, su consumo se imputa mediante Kardex al número de orden; el equipo de un tercero no ingresa como existencia propia. -->
<!-- ADR-101 (Aceptada, 2026-10-07): la importación Excel de APU trata cada hoja de actividad reconocida como un APU independiente y excluye hojas auxiliares de catálogos, dotación, salarios y resúmenes. Los rubros y sus columnas se detectan por rótulos normalizados, no por posiciones ni cantidades fijas de filas; el usuario selecciona una actividad y revisa sus recursos antes de importarla. -->
<!-- ADR-106 (Aceptada, 2026-10-07): un proyecto de tipo Alquiler se costea por periodo, no por consumo de materiales. Las condiciones economicas (tarifa diaria, cargo por dia de extension, mora por dia de retraso y condiciones particulares) viven en columnas propias de `projects` y solo aplican a ese tipo; el presupuesto de materiales deja de ser obligatorio porque un alquiler no despacha insumos. La entrega del equipo es la fecha de inicio y la devolucion pactada es la fecha estimada de fin, de modo que no se inventan campos paralelos: la devolucion real se registra en la fecha real de entrega y al cerrarse el proyecto se recalculan dias facturados, dias de extension, dias de mora y el total a facturar. El calculo vive en el dominio (`computeRentalPeriod`) y no en la interfaz, para que la cifra sea la misma en el formulario, en la ficha y en el reporte. El tipo de proyecto se deduce del prefijo del consecutivo al releerlo de la base de datos, para que un alquiler no vuelva a aparecer como otro tipo. -->
<!-- ADR-107 (Aceptada, 2026-10-07): el alquiler rapido se persiste unicamente en Supabase. Las tablas `quick_rentals` y `quick_rental_attachments` y el bucket privado `rental-attachments` se crean con RLS por empresa y con escritura restringida al responsable de inventario; ninguna escritura cae en `localStorage` como respaldo, porque una reserva local no es una confirmacion y se pierde al cambiar de equipo. Cuando la firma del cliente no puede guardarse, la entrega queda registrada pero el aviso dice que la firma NO se guardo, junto con el motivo: un exito parcial jamas se comunica como exito completo. Para subir la firma se convierte el data URL del lienzo a Blob en memoria, porque el navegador rechaza `fetch()` sobre URLs `data:`. La empresa y la sede del usuario se leen de `user_roles`, que es donde viven, y no de `profiles`, que no las tiene. -->
<!-- ADR-108 (Aceptada, 2026-10-07): el Registro de jornada es una declaracion del empleado, no un seguimiento. El sistema no captura GPS, coordenadas, mapas, ubicacion automatica ni rastreador en segundo plano, y no exige fotografias. Lo que si queda respaldo es lo que el propio trabajador declara y quien lo declara: sitio o frente, actividad, obra asociada y la hora del servidor. La pantalla lo dice de forma explicita para que la herramienta se lea como un respaldo laboral y no como vigilancia. El alto se hace por RPC en modo security definer: el navegador no inserta, la hora la asigna Postgres con now(), y el empleado, la empresa y la sede se derivan de la sesion y de employees.profile_id, de modo que nadie puede registrar a otra persona, cambiar de empresa ni putting una hora propia. No existe permiso de actualizacion ni de borrado para el cliente, y un disparador de la base impide modificar o eliminar una declaracion incluso desde el servidor: un borrado por retencion legal exigiria una migracion que deshabilite el disparador de forma explicita y auditada. La declaracion es inmutable porque su valor esta en ser fiel al momento en que se ocurrio. -->
<!-- ADR-109 (Aceptada, 2026-10-07): la consulta gerencial de jornada es de solo lectura y la resuelve Postgres en el periodocola del servidor, no el navegador. La funcion list_work_check_ins es security invoker, de modo que respeta las politicas RLS: un empleado recibe unicamente sus propias declaraciones y solo los perfiles administrador, residente, auditor y gerencia reciben las del equipo. El dia y la hora se derivan con checked_in_at at time zone America/Bogota para que el filtro Dia, Semana o Mes coincida con el calendario del RFC y no con el huso del equipo del usuario. Los filtros de empleado, obra y texto viajan como parametros a esa misma funcion y el detalle por empleado llega agrupado por dia local. La ausencia de una declaracion se muestra como informacion con la etiqueta Sin declaracion, jamas como color unico ni como señalamiento: el estado siempre lleva texto. La interfaz evita deliberadamente el lenguaje de vigilancia y habla de declaracion, sitio reportado y actividad reportada. -->
<!-- ADR-110 (Aceptada, 2026-10-07): modifica ADR-108. La prohibicion absoluta de ubicacion se levanta; lo que se mantiene es la prohibicion del rastreo. La geolocalizacion existe como boton opcional del Registro de jornada y solo ocurre cuando la persona lo pulsa: una lectura, en ese momento, con la hora del servidor, y sin permiso automatico ni vigilancia en segundo plano. El texto de consentimiento se muestra siempre y declara que la ubicacion no es obligatoria y que el registro vale igual sin ella; si el permiso se deniega o el GPS esta apagado, la pantalla lo explica y ofrece escribir el sitio con palabras, sin dejar el formulario en estado invalido. Para mostrar el nombre del lugar, el servidor de RFC consulta OpenStreetMap desde una ruta propia en lugar de dejar salir al navegador a un tercero, porque el CSP solo permite conexiones propias y asi queda un unico punto de salida auditable. Las coordenadas son una declaracion del cliente y no una atestiguacion del dispositivo: se conservan como tal y no deben presentarse ante un tercero como prueba de que alguien estuvo en un lugar. Cambiar la politica de opcional a obligatoria es modificar una constante del dominio, ATTENDANCE_MAP_REQUIREMENT; la rama ya esta implementada y probada, y activarla exige el acuerdo escrito del riesgo LAB-001. Con este cambio tambien se ajusto la Permissions-Policy del sitio: declaraba geolocation=() y hacia inutilizable el boton en todas las paginas. -->
<!-- ADR-111 (Aceptada, 2026-10-07): una jornada deja de ser una colección de declaraciones aisladas y pasa a tener entrada, salida y tramos consecutivos. `workdays` representa un único día local por empleado y `workday_segments` representa trabajo, desplazamiento o pausa. Las tres acciones se ejecutan por RPC: iniciar crea día y tramo; cambiar bloquea la jornada, cierra el único tramo abierto y crea el nuevo en la misma transacción; finalizar cierra tramo y jornada. Los eventos `work_check_ins` se conservan como bitácora inmutable compatible con la consulta ya publicada. La hora y fecha de negocio se resuelven en Postgres con America/Bogota. Si falta salida, no se fabrica una hora: al iniciar un día posterior el día anterior queda `needs_review`, pendiente de corrección con motivo. La ubicación, cuando el empleado la comparte voluntariamente, se asocia solo al acto que la originó; no existe seguimiento continuo. -->
<!-- ADR-115 (Aceptada, 2026-10-07): un alquiler rápido es un documento de entrega y cobro, no un único equipo. `quick_rental_orders` conserva cliente, período, firma, estado y consecutivo; `quick_rental_order_items` conserva equipos, cantidades, tarifa, depósito, devolución, condición y recargo por línea. Una factura se consolida sobre la cabecera, pero los equipos se devuelven independientemente. Los registros unitarios existentes se mantienen como histórico. -->
<!-- ADR-112 (Aceptada, 2026-10-07): los permisos efectivos tienen una sola fuente, la funcion `my_effective_permissions()` de la base de datos, que compone rol laboral, membresia antigua y excepciones individuales. El menu, la guarda de ruta y cada vista consultan esa misma funcion: no se mantienen listas de roles escritas en el cliente, porque dos fuentes de verdad terminan contradiciendose. La ocultacion del menu es una comodidad, la guarda de ruta impide escribir la URL y Saltar al modulo permitido, y las RLS de cada tabla siguen siendo la barrera real sobre los datos. Mientras los permisos se resuelven no se oculta nada, para que el menu no aparezca completo y luego se retire a medias. -->
<!-- ADR-113 (Aceptada, 2026-10-07): los permisos de cada rol operativo se reemplazan por completo en lugar de acumularse. La siembra anterior solo agregaba y dejo permisos antiguos: el operario de campo conservaba `projects.view` e `inventory.catalog.view`, por lo que le aparecian obras e inventarios en el menu. Cada rol operativo tiene ahora una lista cerrada: el operario solo registra su jornada; el maestro registra jornada y crea requisiciones; el bodeguero lleva inventario, kardex, despachos y jornada; el ingeniero residente lleva cotizaciones, APU, obra y consulta de su equipo; el auditor consulta sin modificar; la gerencia lleva la operacion completa sin administrar usuarios ni roles. El administrador recibe APU por rol y no por excepciones individuales, para que un administrador nuevo no dependa de que alguien le cree filas a mano. -->
<!-- ADR-114 (Aceptada, 2026-10-07): un maestro de obra no ve el modulo Proyectos & Obras en el menu, pero si puede elegir la obra desde el formulario de jornada. Es deliberado: decir en que obra se estuvo trabajando es parte del respaldo de la jornada y no acceso al centro de costos. Ocultar esa lista debilitaria el registro sin trazer ninguna proteccion, porque las RLS de obras ya permiten a cualquier miembro de la empresa leerlas y quien no debe ver costos no los ve por el permiso del modulo. Lo que today no existe es la visibilidad de solo los proyectos asignados al maestro: cuando se implemente, esa restriction debe ir en la base de datos y no en el menu. -->
<!-- ADR-115 (Aceptada, 2026-10-07): la firma institucional y el nombre del representante legal salen de la base de datos, no del codigo. Antes cada documento tenia escrito `/rfc-signature.png` y el nombre repetido como texto en seis lugares: cambiar la firma obligaba a recompilar y dos copias del nombre podian quedar distintas. Ahora viven en `company_settings`, bajo la clave `branding`, con la imagen en el bucket `company-branding` y un interruptor por tipo de documento para decidir en cuales aparece. Esta firma es la de la empresa y no reemplaza la firma del cliente, del residente ni del receptor, que siguen guardandose como evidencia propia. El archivo que habia en el repositorio era tinta blanca sobre fondo negro, de modo que imprimia como un cuadro negro: se invirtio a tinta negra sobre blanco. -->
<!-- ADR-116 (Aceptada, 2026-10-07): los valores por defecto de la propuesta se guardan en la empresa y se aplican al abrir una cotizacion nueva. Vigencia, plazo de entrega y condiciones de pago venian escritos dentro del formulario, asi que se repetian en cada oferta y dos cotizaciones podian salir con condiciones distintas. Ahora se editan una vez en Configuracion y llegan al formulario; lo que el usuario cambie en la cotizacion sigue mandando sobre el valor por defecto. Los demas parametros economicos, IVA, anticipo, descuento maximo, retencion y valor en letras, quedan disponibles y se iran aplicando a medida que se necesiten. -->
<!-- ADR-117 (Aceptada, 2026-10-07): el Resumen se arma segun los permisos efectivos de quien mira. Antes toda persona que llegaba al dashboard veía presupuesto total, gasto real, saldo disponible y el conteo de cotizaciones, APU y obras, aunque fueran un operario que solo registra su jornada. Ahora los indicadores financieros requieren `dashboard.financials.view` y las tarjetas de cotizaciones, APU y obras se muestran solo si el modulo correspondiente esta abierto. Se suman dos tarjetas por modulo: los alquileres de equipos, con los activos y las devoluciones vencidas, y la jornada de la propia persona. La composicion vive en la pagina y no dentro de un modulo, porque el resumen es el unico lugar donde se cruzan modulos. -->
<!-- ADR-118 (Aceptada, 2026-10-07): la barra lateral agrupa los modulos por dominio pero no los une. Comercial agrupa Cotizaciones y APU; Obras, Proyectos, Registro de jornada y Alquiler; Bodega, Inventarios, Movimientos y Conteos; Administracion, Empleados, Mi perfil y Configuracion. Cada modulo sigue siendo su propia pantalla y su propia ruta: agrupar es solo orden. Un bloque con un solo modulo visible se muestra suelto, sin rotulo, porque el titulo no aportaria nada; y si a una persona solo le corresponde un modulo en toda la aplicacion no ve ningun encabezado. El bloque de la pagina actual nunca se pliega y el estado de los bloques se recuerda como preferencia visual. -->
<!-- ADR-119 (Aceptada, 2026-10-07): la antiguedad de una cotizacion se muestra como un semaforo con texto, no solo como un color. Antes un borde ambar de cuatro pixeles se encendia cuando la cotizacion llevaba mas de tres dias en «esperando respuesta», lo cual dejaba fuera el caso real de una propuesta enviada que nadie responde y de una que lleva semanas sin enviarse. Ahora `quoteStaleness` mide los dias desde el ultimo movimiento que dejo la cotizacion en un estado de espera, marca en amber a los tres dias y en rojo a los siete, y escribe cuantos son. El color acompana al texto y nunca lo sustituye. El mismo criterio aplica en la lista y en el tablero. -->
<!-- ADR-120 (Aceptada, 2026-10-07): cambiar la contrasena ocurre en un modal dentro de la ficha personal y no en otra pagina. Antes era un enlace de texto que sacaba a la pantalla de restablecimiento, mezclando recuperacion y cambio, y se perdia el contexto. El modal pide la contrasena actual, la nueva y su repeticion, aplica las mismas reglas de la pagina existente —minimo diez caracteres con mayusculas, minusculas, numeros y simbolos— y se confirma o se cancela sin navegar. El documento se declara `es-CO` para que los controles nativos del navegador, como elegir archivo o el calendario, aparezcan tambien en espanol. -->
<!-- ADR-121 (Aceptada, 2026-10-07): la devolucion de un alquiler se registra en un modal con confirmacion explicita, y no en cuadros de texto del navegador. Antes pedia el cargo adicional y el estado recibido con dos `window.prompt` encadenados, sin posibilidad de revisar lo escrito ni de cancelar sin perder lo tecleado. El modal muestra el equipo, el cliente y la devolucion prevista, pide el estado al recibir y el cargo, y solo cierra al confirmar. Ademas la escritura ahora revisa el error: antes se anunciaba «cerrado» aunque la actualizacion fallara y el equipo se liberaba igual. Un cierre que no se guardo no libera el equipo. -->
<!-- ADR-122 (Aceptada, 2026-10-07): al reabrir la firma de una entrega se ve la que ya estaba capturada, y se puede dejar como esta, quitarla o reemplazarla. El lienzo se abria vacio, de modo que no habia forma de decidir, y el boton «Limpiar» solo borraba el dibujo sin borrar la firma guardada, porque solo tocaba el lienzo. Ahora la firma previa se pinta en el lienzo al abrir, el boton de limpiar borra de verdad y hay una accion explicita para conservarla sin cambios. La firma se recupera del almacenamiento privado mediante una URL firmada, de modo que la factura de alquiler la muestre tambien despues de recargar la pagina. -->
<!-- ADR-123 (Aceptada, 2026-10-07): las mutaciones de obra que alteran más de un dato se ejecutan en una transacción de base de datos. Reabrir conserva motivo, fecha previa y nueva fecha; ajustar presupuesto actualiza el presupuesto y añade su historial de forma indivisible. Personal de obra se modela en `project_employees`, con empresa y empleado validados; el cliente no fabrica identificadores ni declara éxito hasta que Supabase responde. -->
<!-- ADR-124 (Aceptada, 2026-10-07): categoría, ubicación y responsable de Kardex son datos maestros y operativos persistentes, no arreglos de pantalla. Las categorías se almacenan por empresa, las ubicaciones usan el maestro estructurado existente y el responsable queda en el movimiento de inventario. -->
<!-- ADR-125 (Aceptada, corregida 2026-10-07): Graphite es el lenguaje visual del sitio público de inicio, no de los módulos operativos. El lienzo público es casi negro, las superficies se separan con bordes grafito de 1 px, la jerarquía se apoya en blanco suave y gris niebla, y el naranja queda reservado a atención o enlaces. Las acciones principales son monocromas; el movimiento se reduce prácticamente por completo con `prefers-reduced-motion` y no condiciona ninguna operación. -->

## 2026-10-08 — Ubicación y trazabilidad de tablas salariales
Se acuerda que la administración se hace en **Configuración → Costos y tablas salariales**, no dentro del APU. Al crear una cotización se elige una tabla vigente y el sistema guarda una instantánea de sus componentes; actualizar la tabla después no altera costos históricos.


## 2026-10-08 — Introducción de la portada
La ruta pública `/` presenta el símbolo RFC de carga durante un mínimo de dos segundos antes de revelar la portada. Las rutas internas conservan sus loaders propios y no reciben esta demora.

## 2026-10-08 — Viáticos por desplazamiento en mano de obra
Hotel y transporte operativo se modelan como viáticos de desplazamiento, separados del auxilio legal de transporte. Por defecto aplican a Conductor y Capataz, porque se desplazan a los frentes de obra; los demás cargos locales no los reciben. Cada línea del APU podrá registrar una excepción justificada cuando el proyecto lo requiera.

## 2026-10-08 � Costeo salarial por cargo y vi�ticos

Los cargos del APU se resuelven desde la tabla salarial elegida en la cotizaci�n. Cada cargo toma el valor de su nivel dentro de esa tabla y queda congelado al guardar la oferta. Hotel y transporte operativo son vi�ticos de desplazamiento: Capataz y Conductor los reciben por defecto; cualquier otro cargo exige una justificaci�n que queda dentro de la instant�nea de la cotizaci�n. Los dem�s conceptos de la obra se calculan por separado del auxilio legal de transporte.

## 2026-10-08 � Consulta de tablas salariales

Abrir una tabla salarial vigente muestra un detalle de solo consulta con nivel, puestos asociados y cada componente del valor diario. La vista interna y la exportaci�n utilizan el mismo conjunto de datos para que el usuario pueda comprobar valores antes de usarlos en una cotizaci�n.

## 2026-10-08 � Total diario oficial de tablas salariales

El campo `Total d�a` de una tabla salarial es un dato documental de su fuente (por ejemplo, el PDF de OCENSA), no un valor que RFC recalcula ni reemplaza con provisiones o recargos. La consulta, exportaci�n y APU consumen exactamente ese valor por nivel; los c�lculos particulares de una obra se registran por separado y nunca alteran la tabla oficial.


### 2026-10-08 - Niveles oficiales y cargos son entidades distintas

Un nivel salarial conserva ?nicamente los importes publicados por la empresa fuente. Los cargos se registran como relaciones independientes hacia ese nivel, por empresa, tabla y vigencia. Esto permite que un Nivel 1 tenga todos sus puestos sin repetir ni modificar salario, auxilios o total documental.

La exportaci?n de una tabla contiene la hoja de valores por nivel y una hoja `Cargos por nivel`. Para APU, el cargo seleccionado determina el nivel de referencia; los c?lculos particulares del contratista se aplican en una capa de costeo/snapshot separada y jam?s sobrescriben la fuente oficial. Esta decisi?n aclara y reemplaza cualquier redacci?n anterior que indicara que el APU consume de forma definitiva el total documental sin dicha capa de c?lculo.


<!-- 2026-10-08: Correction: the 68 OCENSA positions are the pre-existing mapped catalogue, not a verified complete transcription of all own-activity positions. Complete the OCENSA own-position map only from its official role-to-level annex; do not infer it from CENIT or ODC. Official source views exclude provisions and extra-hour references. -->

<!-- 2026-10-08: A job title is reusable across companies, but its salary mapping is never global. labor_rate_roles is scoped by company_id, labor_rate_table_id and labor_rate_entry_id, so the same title may map to a different level and official value for each company, contract/version and validity period. -->

<!-- 2026-10-08: Salary tables uploaded for each company are documentary source data and mandatory inputs to the contractor calculation model. They are not standalone APU final costs: RFC preserves published values, then derives project/APU cost in a separate auditable snapshot without modifying the source table. -->

## 2026-10-08 ? Costeo laboral contractual por cotizaci?n

La tabla salarial de cada cliente queda como fuente documental inmutable. La cotizaci?n define una ?nica tabla contractual visible ?por ejemplo, `OCENSA ? 2026?2027`? y, dentro de ella, una escala aplicable (`propias` o `no propias`). Las escalas pueden permanecer separadas internamente porque sus valores por nivel son distintos, pero no deben presentarse al usuario como dos tablas OCENSA independientes.

Antes de gestionar APU, la cotizaci?n debe guardar un costeo laboral: plazo, d?as laborables, jornada/recargos, cuadrilla, vi?ticos y conceptos operativos. Cada componente declara si integra IBC, prestaciones y parafiscales; no se replica ciegamente la f?rmula hist?rica de Excel. El APU consume el costo diario congelado del cargo en esa cotizaci?n, nunca el total oficial documental como costo final. La unidad operativa preferida es `jornales por unidad`; si se presenta rendimiento, se rotula como `unidades por jornada` y se convierte expl?citamente.

## 2026-10-08 ? L?mite del m?dulo de costeo


<!-- ADR-137 2026-10-09: El video de soldadura de la portada se reproduce en movil, silenciado y en linea. El parallax se limita a pantallas amplias; prefers-reduced-motion prevalece. -->

+<!-- ADR-138 2026-10-09: la 404 usa una composicion estructural animada en CSS, sin dependencia de video ni librerias pesadas. La preferencia de movimiento reducido la detiene. -->

## ADR-139 - Parametros laborales nacionales configurables

**Decision (2026-10-09):** los porcentajes de costo laboral no se duplican por empresa. Se administran como catalogo nacional en `labor_cost_parameters`, porque son reglas generales del modelo comercial que pueden cambiar con la normativa. Cada fila define codigo, etiqueta, tasa, base de calculo, efecto, divisor, estado y descripcion.

**Consecuencias:** las tablas salariales de cada empresa continuan aportando salarios y auxilios documentales; el calculo comercial consume el catalogo nacional. Un cambio recalcula costos vigentes en BD y las cotizaciones nuevas guardan los parametros dentro de su instantanea para preservar trazabilidad historica.

## ADR-140 - Separacion entre dotacion estimada y dotacion entregada

**Decision (2026-10-09):** la dotacion se gestiona en dos capas. La matriz de cargo y los perfiles reutilizables alimentan el costo comercial del APU; las entregas al trabajador se registran despues, contra una obra aprobada, y producen el unico movimiento que afecta inventario.

**Consecuencias:** no se descuenta bodega al cotizar. El mismo oficio puede compartir perfil entre empresas, pero una tabla salarial o un cargo puede conservar una excepcion. Cada articulo declara su ciclo de reposicion para evitar amortizar casco, botas y consumibles con el mismo numero de dias.

## ADR-141 - Estimado inicial opcional separado del APU

**Decision (2026-10-09):** el precosteo se conserva como estimado opcional y plegable, no como fuente automatica del precio final. Sirve para respuesta rapida, viabilidad y preparacion de cuadrilla; el APU validado por actividad conserva la autoridad para el costo tecnico definitivo.

**Consecuencias:** una cotizacion puede crearse sin estimado. Cuando se usa, queda trazabilidad de ambos momentos y sus diferencias se emplean para control comercial.

## ADR-142 - Variables independientes de jornada para costeo APU

**Decision (2026-10-09):** el costeo laboral diferenciara jornada ordinaria programada, dias fisicos de trabajo, dias calendario remunerados y horas efectivas de produccion. La referencia actual de RFC es 42 horas semanales de lunes a viernes; la productividad inicial de estaciones OCENSA es 5,333 horas/dia y queda configurable por actividad/frente.

**Consecuencias:** el factor presupuestal 7/5 solo puede aplicarse cuando la tarifa diaria no haya incorporado ya el descanso remunerado. Equipos y transporte usan sus propias unidades de cobro y no reciben dicho factor automaticamente.

## ADR-143 - Dias remunerados separados de dias fisicos en el precosteo

**Decision (2026-10-09):** el precosteo propone dias fisicos de lunes a viernes y dias remunerados como dias fisicos x 7/5. El usuario puede editar el resultado por festivos, novedades o porque la tarifa contractual ya incluye descansos.

**Consecuencias:** el costo de personal usa dias remunerados; horas extras, rendimiento y disponibilidad real usan dias fisicos. Hotel, transporte operativo y equipos no reciben el factor automaticamente.

**Ajuste ADR-143 (extras):** dias fisicos no generan por si solos horas extra. El precosteo inicia extras diurnas, nocturnas y dominicales en cero; solo se costean las horas que el responsable registre conforme al turno planeado.

## ADR-144 - Fechas opcionales en el precosteo

**Decision (2026-10-09):** las fechas no son requisito para precostear una cotizacion. La entrada principal es la estimacion de dias fisicos; las fechas se usan de forma opcional para programacion y solo entonces proponen lunes a viernes y dias remunerados.

**Consecuencias:** la duracion tecnica definitiva debe nacer de cantidades, rendimientos y cuadrillas por actividad dentro del APU, no de una fecha inventada al abrir la cotizacion.
