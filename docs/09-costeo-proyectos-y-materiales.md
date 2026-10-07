---
estado: vigente
propietario: Producto y Operaciones RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Operaciones, Almacén, Contabilidad y Desarrollo
---

# Ficha de Módulo: Costeo de Materiales por Obra y Control de Inventarios

> Actualización 2026-10-06: el APU ofrece un catálogo filtrable de unidades de medida. La actividad guarda la abreviatura normalizada (`und`, `kg`, `m²`, `m³`, `L`, `HH`, etc.) para que el costeo y sus documentos usen una sola convención.

<!-- Registro 2026-10-06: en móvil las fichas de proyecto, sus métricas, pestañas y tablas de historial se ajustan a una sola columna o contenedor interno, sin forzar desplazamiento horizontal de la pantalla. -->
<!-- Registro 2026-10-06: los valores de cantidad, rendimiento por día y tarifa de las líneas APU admiten decimales escritos con coma o punto. El total de costo y venta se recalcula al confirmar el campo y se conserva en la nueva versión del APU. -->

## Trazabilidad cotización–obra

Cada obra creada desde una cotización conserva el identificador y código de cotización de origen. El consecutivo propio de la obra permite su operación y costeo; el nombre incorpora el código comercial para que el equipo reconozca inmediatamente el expediente que la originó.

La ficha de obra conserva una acción visible de regreso a la cotización de origen. Esto permite consultar el alcance comercial antes de registrar consumos, costos o avances de obra.

Las obras creadas antes del vínculo bidireccional conservan el acceso cuando la cotización ya contiene su código o identificador de obra.

Las ayudas del módulo explican el propósito de despacho, ajustes presupuestales, selección de obra y consulta por pestañas, reduciendo errores de operación durante el costeo.

El APU de una cotización enviada, confirmada o en ejecución se conserva como línea base consultable. Los costos reales y ajustes posteriores se registran en la obra/BOQ; cualquier cambio de la oferta comercial exige una nueva revisión de cotización.

Para alquileres, el APU o tarifa cubre equipo, tiempo de uso, transporte, operador y otros conceptos pactados. El proyecto de tipo Alquiler deberá relacionar el equipo con su entrega/devolución y registrar días, horas, daños o extensiones como cargos facturables.

El alquiler rápido usa una tarifa diaria y garantía sin crear proyecto ni cotización. La disponibilidad del activo se descuenta durante el alquiler y se repone únicamente al registrar devolución; los extras por daños, faltantes o tiempo adicional se dejan registrados para su cobro posterior.

Los informes financieros consolidan el costo de inventario, gasto por proyecto, APU y alquileres; los operativos muestran kardex, stock crítico y custodia. Esta separación permite revisar el costo estimado y la operación sin mezclar controles de naturaleza diferente.

El flujo de alquiler rápido se accede dentro del mismo dashboard operativo para conservar los accesos a Inventarios, Proyectos, Informes y demás controles relacionados.

## Unidad de compra vs. unidad de consumo

Las entradas pueden recibirse en una presentación comercial y consumirse en una unidad menor. Cada nuevo artículo guarda la presentación, su equivalencia y su costo; el inventario valoriza y descuenta en la unidad de consumo. Ejemplo: una caja de 100 tornillos a COP 50.000 ingresa 100 unidades a COP 500 cada una.

Este documento define la arquitectura funcional, el modelo de datos y los flujos operativos para el **costeo de materiales por obra, gestión de kardex y control de despachos** en RFC Enterprise.

---

## 1. Propósito y Objetivo

Permitir a **Representaciones Figueroa Castro S.A.S.** conocer en tiempo real el costo exacto de los materiales consumidos en cada obra, proyecto o servicio de mantenimiento (metalmecánica, obras civiles, electricidad, paisajismo), controlando la ejecución presupuestal y evitando sobrecostos o desabastecimiento en frentes de trabajo.

---

## 2. Capacidades Funcionales

### A. Dashboard Ejecutivo de Proyectos y Costos
- **Vista Consolidada de Obras**: Panel principal en `/dashboard` con KPIs financieros globales (Presupuesto total contratado, Gasto real en materiales, Saldo disponible en COP, Semáforo presupuestal global).
- **Tarjetas Dinámicas por Proyecto**: Visualización de avance presupuestal por obra (`OBRA-2026-01`, `MANT-2026-04`, `OBRA-2026-02`) con barras de progreso codificadas en colores (Verde < 80%, Amarillo 80–100%, Rojo > 100%).
- **Acceso Directo a Operaciones de Almacén**: Accesos rápidos desde el dashboard para despachar material, emitir vales de salida, gestionar requisiciones de obra y controlar préstamo de herramientas.

### B. Centro de Costos por Obra / Proyecto
- **Entidad Obra / Proyecto**: Tipo (`obra`, `mantenimiento` u `otro`), código único generado automáticamente (`OBRA-20260918-01`, `MANT-20260918-01` u `OTRO-20260918-01`), Nombre, Cliente contratante, Ubicación, Presupuesto asignado de materiales ($ COP), fecha de inicio, entrega estimada y Estado (`pending`, `active`, `completed`, `on_hold`). El consecutivo es independiente por tipo y fecha de inicio.
- **Captura de valores COP**: presupuestos, costos de compra, costos unitarios y ajustes se muestran con `$` y puntos de miles al abandonar el campo, sin alterar el valor numérico usado en cálculos y persistencia.
- **Personal de obra**: después de crear y seleccionar el proyecto, la pestaña Personal de obra permite elegir un empleado activo, agregarlo a la lista y retirarlo si se seleccionó por error. La asignación conserva la identidad, nombre y cargo mostrados para consulta en la ficha de la obra.
- **Valorización en Tiempo Real**: Cada salida de almacén se asocia a una obra destino. El sistema calcula:
  $$\text{Costo del Despacho} = \text{Cantidad Despachada} \times \text{Costo Unitario Promedio}$$
- **Indicadores Financieros por Proyecto**:
  - Presupuesto de materiales.
  - Gasto acumulado en materiales entregados.
  - Saldo presupuestal disponible.
  - Porcentaje de ejecución presupuestal con semáforo visual.
  - Historial de despachos y vales de salida asociados.
  - Historial de ajustes presupuestales con fecha, responsable autenticado, motivo y valor aplicado.

### C. Vales de Salida Imprimibles (Remisión de Almacén)
- **Formato Oficial de Entrega**: Generación interactiva e imprimible (`@media print`) del Vale de Salida con el logo oficial `public/rfc-logo.svg`, folio consecutivo, cliente, obra destino, ítems entregados valorizados y áreas de firma para el Almacenista y el Residente de Obra.

### D. Requisiciones de Material desde Frente de Obra
- **Flujo Solicitud → Despacho**: Registro de solicitudes formalizadas por los maestros o residentes de obra. Almacén aprueba y procesa automáticamente el despacho descontando stock e imputando el costo.

### E. Devolución de Material Sobrante
- **Reintegro a Bodega**: Registro de reingreso de materiales no utilizados en obra con reversión del costo imputado al proyecto y restitución del stock disponible.

### F. Custodia y Préstamo de Herramientas a Cuadrillas
- **Control de Equipos**: Registro de préstamos de herramientas menores y mayores (pulidoras, soldadores, taladros, equipos de seguridad) a trabajadores con fecha de entrega, estado del equipo y fecha de devolución.

### G. Operación de inventario y abastecimiento
- **Ubicación trazable**: bodega, pasillo, estante, nivel y contenedor por existencia.
- **Alta de artículos**: el almacenista crea equipos, herramientas, insumos o dotación con SKU, unidad, ubicación, costo, mínimo y una entrada inicial automática en Kardex.
- **Recepción de compra**: proveedor, factura y costo unitario de la entrada.
- **Conteo físico**: cantidad de sistema versus cantidad contada, motivo, responsable y aprobación antes del ajuste.
- **Reorden y reportes**: mínimo, cantidad sugerida, consumo por obra, rotación, inventario sin movimiento y valoración por grupo.
- **Regla de despacho**: sólo una obra en estado `active` puede recibir una salida de materiales.

---

## 3. Modelo de Dominio y Entidades Extendidas

```typescript
export type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  location: string;
  budget: number; // Presupuesto en COP
  status: "active" | "completed" | "on_hold";
  createdAt: string;
};

export type InventoryMovement = {
  id: string;
  productId: string;
  productName?: string;
  type: "entry" | "exit" | "adjustment" | "return";
  quantity: number;
  unit?: string;
  unitCost: number; // Costo unitario en COP
  totalCost: number; // Cantidad * Costo unitario
  occurredAt: string;
  reference: string; // N° Vale / Remisión / Factura
  projectId?: string; // Obra de destino
  projectName?: string;
  responsible?: string;
  notes?: string;
};

export type MaterialRequisition = {
  id: string;
  code: string;
  projectId: string;
  projectName: string;
  requestedBy: string;
  items: Array<{ productId: string; productName: string; quantity: number; unit: string }>;
  status: "pending" | "approved" | "rejected" | "dispatched";
  createdAt: string;
};

export type ToolLoan = {
  id: string;
  toolId: string;
  toolName: string;
  workerName: string;
  projectId: string;
  projectName: string;
  loanDate: string;
  returnDate?: string;
  status: "active" | "returned" | "damaged";
  notes?: string;
};
```

---

## 4. Estado de Fases de Extensión

1. **Vales de Salida Imprimibles (PDF/Print)**: ✅ Implementado en UI con vista previa de Remisión Oficial y soporte de impresión.
2. **Requisiciones de Material desde Frente de Obra**: ✅ Implementado en Dashboard e Inventario con flujo de aprobación.
3. **Devoluciones de Material Sobrante**: ✅ Implementado con reajuste de costo de obra y reposición de stock.
4. **Custodia de Herramientas y Equipos**: ✅ Implementado con módulo de préstamos a trabajadores y trazabilidad por obra.

---

## 5. Fechas operativas y cierre

- La fecha y hora de cada despacho se generan automáticamente y acompañan el movimiento de salida y la remisión imprimible.
- La fecha estimada de finalización es una proyección de planeación; no se usa para fechar un despacho.
- Al finalizar la obra, el usuario registra la fecha real de entrega. Puede ser anterior a la estimada, pero no anterior al inicio de la obra.

## 6. Custodia de herramientas y equipos

- La obra puede recibir herramientas y equipos únicamente desde existencias disponibles en Dotación o Herramientas de trabajadores.
- Cada asignación se asocia a una persona de Personal de obra y reduce una unidad disponible.
- La devolución registra automáticamente fecha y hora. Cuando se declara una novedad o daño, la herramienta no se devuelve a disponibilidad hasta su revisión.
- El botón Asignar herramienta abre el registro de custodia; una asignación activa errónea puede anularse y devuelve la unidad a disponibilidad.
- La selección usa una búsqueda por nombre, código, marca o categoría y solo lista activos reutilizables clasificados como Herramienta o Equipo.

## 7. Clasificación del catálogo

- Materiales e insumos: artículos consumibles que se despachan y se cargan al costo de la obra.
- Herramientas y equipos: activos reutilizables que se asignan temporalmente a una persona y se controlan por custodia.
- Dotación/EPP: elementos de protección y uniformes, diferenciados de las herramientas para evitar asignaciones incorrectas.

## 8. Navegación de la ficha de obra

- El orden de consulta es: Materiales e insumos, Herramientas en custodia, Personal de obra, Requisiciones y Ajustes de presupuesto al final como información de consulta.
- Cada pestaña usa un icono SVG funcional para facilitar la identificación rápida en pantalla y dispositivos táctiles.

## 9. Usabilidad del catálogo de inventario

## Registro de jornada y frentes de costo

- La jornada laboral conserva la relación operativa con la obra o proyecto sin convertirla en un sistema de vigilancia: una persona inicia y finaliza su jornada, y registra tramos de trabajo, desplazamiento o pausa.
- Cada tramo puede asociarse a una obra y un frente. Al cambiar de frente se cierra el tramo previo y comienza el siguiente; esto permite posteriormente contrastar horas declaradas por frente con el consumo y costo del proyecto, sin asumir que son horas liquidadas de nómina.
- La ubicación es evidencia voluntaria y puntual del registro, nunca un requisito para imputar una actividad o costo y nunca seguimiento en segundo plano.

## Alquiler rápido con varios equipos

- Una entrega se registra con una cabecera por cliente y varias líneas de equipo. La factura consolida sus líneas y cada equipo conserva su propia tarifa, garantía, recargo y devolución.

- Buscar artículo presenta coincidencias en vivo por nombre, código, marca, categoría o ubicación.
- Seleccionar una coincidencia restaura filtros restrictivos para que el resultado se vea en el catálogo.
- La configuración de categorías y ubicaciones usa formularios alineados, con etiquetas e icono identificador.
<!-- Registro 2026-10-01: una obra creada desde Cotizaciones recibe el valor estimado de la oferta como presupuesto inicial, estado activo y fechas calculadas desde su plazo de ejecucion. -->
<!-- Registro 2026-10-01: el APU calcula cada parcial como cantidad x tarifa x rendimiento (materiales usan rendimiento 1), consolida subtotales por rubro y expone costo por unidad de obra. -->
<!-- Registro 2026-10-01: un APU creado desde Cotizaciones conserva quoteId y quoteCode; sus actividades actualizan los rubros directos de la cotizacion. -->
<!-- Registro 2026-10-01: al seleccionar una actividad del catalogo APU, la unidad de medida sugerida se aplica a la nueva actividad; las actividades personalizadas se crean con unidad editable. -->
<!-- Registro 2026-10-02: cada APU debe conservar identificador, cotizacion, revision, autor, fechas de creacion/modificacion y estado; las modificaciones futuras deben ser auditables. -->
<!-- Registro 2026-10-07: la exportación APU produce un libro XLSX RFC con la hoja inicial RESUMEN ACTUALIZADO y una hoja por actividad del contexto actual. El resumen consolida cantidades y valores de costo directo, ganancia y venta. Cada actividad conserva la estructura operativa oficial: título, cantidad de obra, bloques dinámicos de equipos/herramientas, materiales, mano de obra y transporte, parciales y subtotales por fórmula. Las hojas de catálogos, salarios y dotación no viajan en el archivo porque no representan una actividad costeadora. -->
<!-- Registro 2026-10-07: la importación de libros APU expone las hojas de actividad como selección múltiple con casillas y crea un APU por cada hoja elegida. Catálogos, resúmenes, dotación, salarios y hojas sin estructura APU se muestran como informativas/excluidas con su motivo; nunca se convierten automáticamente en actividades costeables. -->
<!-- Registro 2026-10-07: la firma institucional de Jorge Figueroa Castro acompaña las hojas exportadas del APU y su impresión. Las aprobaciones o recibidos de cliente, residente y personal de obra siguen siendo firmas independientes del documento operativo. -->
<!-- Registro 2026-10-07: la aprobación de procedimiento y matriz de riesgos es condición previa para iniciar la obra. Un cambio solicitado por el cliente invalida la aprobación previa hasta que se envíe y apruebe una nueva versión; la versión aprobada queda asociada a la cotización confirmada y a la obra resultante. -->
<!-- Registro 2026-10-07: `quote_technical_documents` conserva el procedimiento y la matriz por tipo, versión, archivo, estado, observaciones y responsables. El almacenamiento es privado y las URLs de descarga son firmadas. El procedimiento de conversión Cotización→Obra exige que ambos documentos más recientes estén aprobados; no basta con que una versión anterior lo hubiera estado. -->
<!-- Registro 2026-10-02: la propuesta comercial presenta los rubros consolidados del APU como filas, calcula subtotal e IVA del 19 por ciento y muestra el total en el bloque economico de la plantilla A4. -->
<!-- Registro 2026-10-02: cada línea de mano de obra puede referenciar `apu_labor_positions`; guarda identificador, código, nivel y tipo de actividad, y toma como tarifa el total diario vigente (salario básico más auxilios aplicables). La tarifa queda editable en el APU para ajustes justificados de una cotización concreta. -->
<!-- Registro 2026-10-02: el catálogo inicial contiene 68 cargos del documento salarial suministrado. Actividades propias tienen vigencia 2026-07-01 a 2027-06-30 y actividades no propias 2026-01-01 a 2026-12-31. -->
<!-- Registro 2026-10-02: guardar persiste el conjunto actualizado de APUs del dispositivo y confirma el APU seleccionado; eliminar filtra solo su identificador y conserva los demás análisis vinculados a la misma cotización. -->
<!-- Registro 2026-10-02: el módulo APU conserva accesible su espacio de trabajo cuando el usuario contrae la navegación lateral del Dashboard; el contenido permanece fluido y no se modifica el drawer móvil. -->
<!-- Registro 2026-10-02: el APU se guarda como cabecera persistente, versión y líneas de recurso. Cada versión conserva costo directo y el detalle de cantidades, rendimientos, tarifas y referencias de inventario/mano de obra. -->
<!-- Registro 2026-10-02: un ítem BOQ vincula una versión APU a una obra con cantidad contractual y presupuesto. Las entradas de control se clasifican como comprometidas o reales, permitiendo calcular presupuesto, compromiso, real y variación sin alterar la línea base. -->
<!-- Registro 2026-10-02: la persistencia de cotizaciones está desplegada en Supabase y queda disponible para enlazar versiones APU/BOQ a la oferta comercial sin depender solo del almacenamiento local. -->
<!-- Registro 2026-10-02: los recursos no registrados se incluyen como líneas manuales en una versión APU y quedan auditables por nombre, unidad, cantidad, rendimiento y tarifa, sin generar saldo de existencias. -->
<!-- Registro 2026-10-02: la selección de recursos de inventario en APU se realiza por búsqueda de nombre, SKU, categoría o marca y presenta seis resultados como máximo; todos los demás siguen disponibles mediante refinamiento de búsqueda. -->
<!-- Registro 2026-10-02: los catálogos de actividades, cargos de mano de obra y recursos en APU operan bajo búsqueda normalizada insensible a tildes (NFD) y tokenizada; el ordenamiento prioriza coincidencias en el nombre del ítem frente a su categoría o resumen descriptivo. -->
<!-- Registro 2026-10-02: el rubro de Transporte cuenta con un catálogo editable clasificado en carga pesada (cama baja 30T/50T, cama alta planchón), volquetas (sencilla 7m³, dobletroque 15m³), transporte de personal (buseta 28p, van 15p), livianos 4x4 (camioneta platón, camión 3.5T) y logística fluvial/carrotanques. Al incorporar un transporte a un APU, la línea almacena su tarifa congelada (`daily_rate`) y unidad; la actualización de precios en el maestro nunca recalcula ni distorsiona costos de APUs completados o cerrados en el historial. -->

<!-- Registro 2026-10-02: el APU toma como entrada el expediente técnico validado en revisión; en Cotización en proceso se elabora el presupuesto y, tras aceptación, su versión aprobada alimenta el BOQ base de obra. -->
<!-- Registro 2026-10-02: los recursos de Inventario pueden declarar aliases de consulta. Al seleccionar desde APU se mantiene la referencia al producto y tarifa técnica; el alias solo facilita encontrarlo cuando el cliente usa una denominación distinta. -->
<!-- Registro 2026-10-02: el resumen ejecutivo visibiliza la continuidad Recibido/Revisión -> Cotización en proceso -> APU -> Obra, y resalta ofertas en costeo que no tienen aún análisis asociado. -->
<!-- Registro 2026-10-02: un APU guarda con retroalimentación de estado: progreso mientras se crea la versión, confirmación verde cuando la base acepta la versión y aviso diferenciado cuando la persistencia es solo local. -->
<!-- Registro 2026-10-02: el control de costeo se vigila desde el Centro de Atención: cotizaciones vencidas/estancadas o sin APU, recursos bajo mínimo, requisiciones sin despacho y obras en 80% o sobre el 100% de presupuesto se priorizan para actuación. -->
<!-- Registro 2026-10-02: la previsualización imprimible del APU conserva acceso continuo a imprimir/cerrar y añade cierre al pie; el documento completo puede revisarse mediante scroll antes de exportar a PDF. -->
<!-- Registro 2026-10-02: la ayuda de estados informa que el APU se construye o modifica en Cotización en proceso y Por modificar, luego la confirmación convierte la oferta a la fase de Obra. -->
<!-- Registro 2026-10-02: las columnas del pipeline indican su acción de control: en proceso elabora APU, por modificar ajusta análisis, confirmada convierte a Obra y ejecución registra costos/recursos. -->
<!-- Registro 2026-10-02: al exportar/imprimir la propuesta, el total económico se representa simultáneamente como COP numérico y como valor en letras en mayúsculas terminado en PESOS COLOMBIANOS M/L. -->
<!-- Registro 2026-10-02: el total numérico se mantiene en la tabla económica; la leyenda inferior expresa solo el valor en letras. Notas comerciales editables se imprimen debajo de dicha leyenda. -->
<!-- Registro 2026-10-02: notas debajo del valor en letras se separan por renglón: cada salto de línea registrado se convierte en una fila imprimible individual. -->
<!-- Registro 2026-10-02: cada obra adjudicada mantiene referencia a su cotización fuente; desde la ejecución se retorna al detalle comercial para consultar alcance, propuesta, valor y condiciones que originaron el presupuesto. -->
<!-- Registro 2026-10-02: las revisiones y cambios del flujo comercial se consultan en una línea de tiempo separada, permitiendo auditar con claridad quién cambió el estado, cuándo y con qué nota. -->
<!-- Registro 2026-10-05: se implementan márgenes de ganancia diferenciados por rubro en el APU (Materiales, Mano de obra, Equipos y Transporte). El APU calcula el Costo Directo Real para abastecimiento y nómina, calcula la Ganancia Estimada ponderada y consolida el Precio de Venta Comercial Final tanto para cotización como para la propuesta imprimible. -->
## Persistencia de inventario y costo (2026-10-06)

Las entradas y salidas se insertan en el Kardex de Supabase. El disparador de base actualiza las existencias y, cuando corresponde, aplica el costo promedio ponderado. La interfaz solo actualiza su estado después de recibir confirmación; no se considera guardado un cambio en memoria o navegador.

Las requisiciones se emiten mediante `create_inventory_requisition`, que conserva la obra, el solicitante y la instantánea de cantidad/unidad/costo de cada existencia solicitada.

La conversión Cotización→Obra deja persistida la obra en `projects` con su presupuesto y fechas, y la cotización queda enlazada (`project_id`) con trazabilidad en `quote_history`. El costo de materiales se sigue calculando por los despachos del Kardex vinculados a la obra, sin escrituras locales.

### Integridad operativa de obra (2026-10-07)

Las asignaciones de personal se guardan por obra y empleado. Una reapertura registra motivo, fecha real previa y nueva fecha estimada junto con el cambio de estado. Los ajustes actualizan el presupuesto y su historial en una misma transacción y no permiten dejarlo por debajo del costo acumulado del Kardex. Las líneas de requisición se consultan siempre desde `inventory_requisition_lines`, por lo que la ficha de obra no presenta solicitudes vacías después de recargar.

La presentación de costos, Kardex, requisiciones y fichas de obra conserva el sistema visual operativo del portal; la identidad Graphite se limita al sitio público de inicio y no altera estos módulos.
