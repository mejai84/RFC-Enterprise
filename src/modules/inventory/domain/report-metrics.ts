/* ─────────────────────────────────────────────────────────────
 * Módulo Inventarios – Métricas de informes
 *
 * Funciones puras y tipadas que alimentan los informes de consumo por
 * obra, rotación, stock inmovilizado y valoración por grupo. Se separan
 * de la pantalla para poder validarlas con TypeScript y reutilizarlas.
 *
 * Los datos de entrada deben venir de Supabase (movimientos, existencias
 * y proyectos persistidos). No hay catálogos semilla ni localStorage.
 * ───────────────────────────────────────────────────────────── */

export type ReportPeriodDays = 30 | 90 | 365 | 0;

export type ReportMovement = {
  productId: string;
  type: "entry" | "exit" | "adjustment" | "return" | "transfer";
  quantity: number;
  totalCost: number;
  occurredAt: string;
  projectId?: string;
};

export type ReportProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  inventoryGroup: string;
  inventoryGroupName: string;
  unit: string;
  available: number;
  unitCost?: number;
};

export type ReportProject = {
  id: string;
  code: string;
  name: string;
};

export type ConsumptionRow = {
  key: string;
  projectId?: string;
  projectCode: string;
  projectName: string;
  movements: number;
  quantity: number;
  value: number;
  lastExitAt?: string;
};

export type RotationRow = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  available: number;
  exits: number;
  exitsValue: number;
  rotation: number | null;
  lastExitAt?: string;
};

export type IdleStockRow = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  inventoryGroupName: string;
  available: number;
  value: number;
  lastExitAt?: string;
  daysIdle: number | null;
};

export type ValuationGroupRow = {
  group: string;
  groupName: string;
  references: number;
  units: number;
  value: number;
};

const DAY = 86_400_000;

function time(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function reportPeriodStart(days: ReportPeriodDays, now: number): number {
  return days > 0 ? now - days * DAY : 0;
}

/** Movimientos dentro del periodo; `0` significa histórico completo. */
export function movementsWithinPeriod<T extends Pick<ReportMovement, "occurredAt">>(
  movements: T[],
  days: ReportPeriodDays,
  now: number,
): T[] {
  if (days <= 0) return movements;
  const start = reportPeriodStart(days, now);
  return movements.filter((movement) => time(movement.occurredAt) >= start);
}

/**
 * Consumo por obra: salidas agrupadas por proyecto. Las salidas sin obra
 * se agrupan como "Sin obra / Bodega" para que el total nunca se pierda.
 */
export function buildConsumptionByProject(
  movements: ReportMovement[],
  projects: ReportProject[],
  days: ReportPeriodDays,
  now: number,
): ConsumptionRow[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const rows = new Map<string, ConsumptionRow>();
  const start = reportPeriodStart(days, now);

  for (const movement of movements) {
    if (movement.type !== "exit") continue;
    const occurred = time(movement.occurredAt);
    if (occurred < start) continue;

    const key = movement.projectId ?? "__warehouse__";
    const project = movement.projectId ? projectById.get(movement.projectId) : undefined;
    const current = rows.get(key) ?? {
      key,
      projectId: movement.projectId,
      projectCode: project?.code ?? "BODEGA",
      projectName: project?.name ?? "Sin obra / Bodega",
      movements: 0,
      quantity: 0,
      value: 0,
      lastExitAt: undefined,
    };

    current.movements += 1;
    current.quantity += Math.max(0, Number(movement.quantity) || 0);
    current.value += Math.max(0, Number(movement.totalCost) || 0);
    if (!current.lastExitAt || occurred > time(current.lastExitAt)) {
      current.lastExitAt = movement.occurredAt;
    }
    rows.set(key, current);
  }

  return [...rows.values()].sort((a, b) => b.value - a.value || a.projectName.localeCompare(b.projectName, "es-CO"));
}

/**
 * Rotación: salidas del periodo sobre la existencia actual. Es un índice
 * operativo, no un costo de ventas contable, porque el sistema todavía no
 * guarda fotografías históricas de existencias. Se documenta esa limitación.
 */
export function buildRotationReport(
  products: ReportProduct[],
  movements: ReportMovement[],
  days: ReportPeriodDays,
  now: number,
): RotationRow[] {
  const start = reportPeriodStart(days, now);
  const exitsByProduct = new Map<string, { quantity: number; value: number; lastExitAt?: string }>();

  for (const movement of movements) {
    if (movement.type !== "exit") continue;
    const occurred = time(movement.occurredAt);
    if (occurred < start) continue;

    const current = exitsByProduct.get(movement.productId) ?? { quantity: 0, value: 0 };
    current.quantity += Math.max(0, Number(movement.quantity) || 0);
    current.value += Math.max(0, Number(movement.totalCost) || 0);
    if (!current.lastExitAt || occurred > time(current.lastExitAt)) {
      current.lastExitAt = movement.occurredAt;
    }
    exitsByProduct.set(movement.productId, current);
  }

  return products
    .map((product) => {
      const exits = exitsByProduct.get(product.id) ?? { quantity: 0, value: 0 };
      const available = Math.max(0, Number(product.available) || 0);
      const rotation =
        available > 0
          ? exits.quantity / available
          : exits.quantity > 0
            ? null
            : 0;

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        category: product.category,
        available,
        exits: exits.quantity,
        exitsValue: exits.value,
        rotation,
        lastExitAt: exits.lastExitAt,
      };
    })
    .filter((row) => row.available > 0 || row.exits > 0)
    .sort((a, b) => {
      if (a.rotation === null && b.rotation === null) return b.available - a.available;
      if (a.rotation === null) return 1;
      if (b.rotation === null) return -1;
      return b.rotation - a.rotation || b.exits - a.exits;
    });
}

/**
 * Stock inmovilizado: referencias con existencia y sin salidas durante el
 * periodo. Si una referencia nunca tuvo salida, `daysIdle` es null y se
 * muestra como "sin salidas registradas".
 */
export function buildIdleStockReport(
  products: ReportProduct[],
  movements: ReportMovement[],
  days: ReportPeriodDays,
  now: number,
): IdleStockRow[] {
  const start = reportPeriodStart(days, now);
  const lastExitByProduct = new Map<string, number>();

  for (const movement of movements) {
    if (movement.type !== "exit") continue;
    const occurred = time(movement.occurredAt);
    const current = lastExitByProduct.get(movement.productId) ?? 0;
    if (occurred > current) lastExitByProduct.set(movement.productId, occurred);
  }

  const rows: IdleStockRow[] = [];
  for (const product of products) {
    const available = Math.max(0, Number(product.available) || 0);
    if (available <= 0) continue;

    const lastExit = lastExitByProduct.get(product.id);
    if (lastExit && lastExit >= start) continue;

    const unitCost = Math.max(0, Number(product.unitCost) || 0);
    rows.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      category: product.category,
      inventoryGroupName: product.inventoryGroupName,
      available,
      value: available * unitCost,
      lastExitAt: lastExit ? new Date(lastExit).toISOString() : undefined,
      daysIdle: lastExit ? Math.max(0, Math.floor((now - lastExit) / DAY)) : null,
    });
  }

  return rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "es-CO"));
}

/** Valoración por grupo de inventario: Bodega, Dotación y Trabajadores. */
export function buildValuationByGroup(products: ReportProduct[]): ValuationGroupRow[] {
  const groups = new Map<string, ValuationGroupRow>();

  for (const product of products) {
    const key = product.inventoryGroup || "sin-grupo";
    const current = groups.get(key) ?? {
      group: key,
      groupName: product.inventoryGroupName || key,
      references: 0,
      units: 0,
      value: 0,
    };
    const available = Math.max(0, Number(product.available) || 0);
    const unitCost = Math.max(0, Number(product.unitCost) || 0);

    current.references += 1;
    current.units += available;
    current.value += available * unitCost;
    groups.set(key, current);
  }

  return [...groups.values()].sort((a, b) => b.value - a.value);
}

export function totalValuation(rows: ValuationGroupRow[]): number {
  return rows.reduce((total, row) => total + row.value, 0);
}
