import type { EntityId } from "@/shared/types/identifiers";
import type { MovementReason, MovementType, StockLevel, StockMovement } from "../domain/movement";
import type { Product } from "../domain/product";
import type { InventoryRepository } from "../domain/repository";

export type StockFilter = { branchId?: EntityId; search?: string; onlyLowStock?: boolean };

export type InventoryRow = { product: Product; level: StockLevel };

export type InventorySnapshot = {
  rows: InventoryRow[];
  totals: { products: number; units: number; lowStock: number; movements: number };
  lastMovements: { movement: StockMovement; productName: string }[];
};

export type RegisterMovementInput = {
  productId: EntityId;
  branchId: EntityId;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  note?: string;
  registeredBy: string;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const entryReasons: readonly MovementReason[] = ["compra", "ajuste_positivo", "devolucion"];
export const exitReasons: readonly MovementReason[] = ["consumo_proyecto", "venta", "ajuste_negativo", "merma"];

/** Saldo de un producto en una sede: entradas menos salidas. */
export function computeBalance(movements: { type: MovementType; quantity: number }[]): number {
  return movements.reduce((total, movement) => total + (movement.type === "entrada" ? movement.quantity : -movement.quantity), 0);
}

/** Une catálogo y existencias para la vista de inventario. */
export async function getInventorySnapshot(repository: InventoryRepository, filter: StockFilter = {}): Promise<InventorySnapshot> {
  const [products, movements] = await Promise.all([repository.listProducts({ onlyActive: true }), repository.listMovements()]);
  const search = filter.search?.trim().toLowerCase();

  const rows: InventoryRow[] = products
    .filter((product) => (search ? product.name.toLowerCase().includes(search) || product.sku.toLowerCase().includes(search) : true))
    .map((product) => {
      const productMovements = filter.branchId ? movements.filter((m) => m.productId === product.id && m.branchId === filter.branchId) : movements.filter((m) => m.productId === product.id);
      const quantity = computeBalance(productMovements);
      return { product, level: { productId: product.id, branchId: filter.branchId ?? "*", quantity, lowStock: quantity < product.minStock } };
    })
    .filter((row) => (filter.onlyLowStock ? row.level.lowStock : true))
    .sort((a, b) => a.product.name.localeCompare(b.product.name, "es"));

  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const lastMovements = [...movements]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 6)
    .map((movement) => ({ movement, productName: productNameById.get(movement.productId) ?? movement.productId }));

  return {
    rows,
    totals: {
      products: rows.length,
      units: rows.reduce((total, row) => total + row.level.quantity, 0),
      lowStock: rows.filter((row) => row.level.lowStock).length,
      movements: movements.length,
    },
    lastMovements,
  };
}

/** Valida y registra un movimiento. Una salida nunca puede dejar el saldo en negativo. */
export async function registerMovement(repository: InventoryRepository, input: RegisterMovementInput): Promise<Result<EntityId>> {
  const product = await repository.findProduct(input.productId);
  if (!product) return { ok: false, error: "El producto no existe." };
  if (!product.active) return { ok: false, error: "El producto está inactivo y no admite movimientos." };
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return { ok: false, error: "La cantidad debe ser un número mayor que cero." };

  const reasons = input.type === "entrada" ? entryReasons : exitReasons;
  if (!reasons.includes(input.reason)) return { ok: false, error: "El motivo no corresponde al tipo de movimiento." };

  if (input.type === "salida") {
    const movements = (await repository.listMovements(input.productId)).filter((movement) => movement.branchId === input.branchId);
    const available = computeBalance(movements);
    if (input.quantity > available) return { ok: false, error: `Existencias insuficientes en la sede: disponibles ${available} ${product.unit}.` };
  }

  const id = await repository.nextMovementId();
  await repository.saveMovement({
    id,
    productId: input.productId,
    branchId: input.branchId,
    type: input.type,
    reason: input.reason,
    quantity: input.quantity,
    note: input.note?.trim() || null,
    registeredBy: input.registeredBy,
    occurredAt: new Date(),
  });
  return { ok: true, value: id };
}
