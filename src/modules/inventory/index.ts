/**
 * Punto de entrada público del módulo Inventarios. La interfaz sólo consume este
 * contrato y nunca importa rutas internas del módulo ni de otros módulos.
 */
export const inventoryModule = { code: "inventory", version: "0.1.0" } as const;

export type { Product, ProductUnit } from "./domain/product";
export type { MovementReason, MovementType, StockLevel, StockMovement } from "./domain/movement";
export type { InventoryRepository, ProductQuery } from "./domain/repository";
export type { InventoryRow, InventorySnapshot, RegisterMovementInput, Result, StockFilter } from "./use-cases/inventory";
export { computeBalance, entryReasons, exitReasons, getInventorySnapshot, registerMovement } from "./use-cases/inventory";
export { inventoryRepository, mainBranchId } from "./infrastructure/memory-repository";
