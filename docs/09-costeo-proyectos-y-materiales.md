---
estado: vigente
propietario: Producto y Operaciones RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Operaciones, Almacén, Contabilidad y Desarrollo
---

# Ficha de Módulo: Costeo de Materiales por Obra y Control de Inventarios

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
- **Entidad Obra / Proyecto**: Código único (`OBRA-2026-01`), Nombre, Cliente contratante, Ubicación, Presupuesto asignado de materiales ($ COP), fecha de inicio, entrega estimada y Estado (`pending`, `active`, `completed`, `on_hold`).
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
