---
estado: vigente
propietario: Producto y Operaciones RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Operaciones, Almacén, Contabilidad y Desarrollo
---

# Ficha de Módulo: Costeo de Materiales por Obra y Control de Inventarios

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

- Buscar artículo presenta coincidencias en vivo por nombre, código, marca, categoría o ubicación.
- Seleccionar una coincidencia restaura filtros restrictivos para que el resultado se vea en el catálogo.
- La configuración de categorías y ubicaciones usa formularios alineados, con etiquetas e icono identificador.
<!-- Registro 2026-10-01: una obra creada desde Cotizaciones recibe el valor estimado de la oferta como presupuesto inicial, estado activo y fechas calculadas desde su plazo de ejecucion. -->
<!-- Registro 2026-10-01: el APU calcula cada parcial como cantidad x tarifa x rendimiento (materiales usan rendimiento 1), consolida subtotales por rubro y expone costo por unidad de obra. -->
<!-- Registro 2026-10-01: un APU creado desde Cotizaciones conserva quoteId y quoteCode; sus actividades actualizan los rubros directos de la cotizacion. -->
<!-- Registro 2026-10-01: al seleccionar una actividad del catalogo APU, la unidad de medida sugerida se aplica a la nueva actividad; las actividades personalizadas se crean con unidad editable. -->
<!-- Registro 2026-10-02: cada APU debe conservar identificador, cotizacion, revision, autor, fechas de creacion/modificacion y estado; las modificaciones futuras deben ser auditables. -->
<!-- Registro 2026-10-02: la exportacion no reconstruye el formato APU desde cero: parte de la plantilla oficial y reemplaza unicamente los datos autorizados, preservando anchos de columna, altos de fila, combinaciones, bordes, fuentes, formulas, areas de impresion y saltos de pagina. -->
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
