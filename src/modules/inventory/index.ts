/** Punto de entrada público del módulo Inventarios & Costos de Obra. */
export const inventoryModule = { code: "inventory", version: "0.3.0" } as const;

export {
  inventoryMovements,
  inventoryProducts,
  inventoryProjects,
  inventoryRequisitions,
  inventoryToolLoans,
  inventorySourceSummary,
  sampleInitialMovements,
  getProductUnitCost,
  getInventoryItemKind,
  type StockProduct,
  type InventoryGroup,
  type InventoryItemKind,
} from "./fixtures";

export type { InventoryMovement, MovementType } from "./domain/movement";
export type { Product } from "./domain/product";
export { inventoryUnits, type UnitOfMeasure } from "./domain/unit-of-measure";
export { getNextProjectCode, initialProjects, projectTypeOptions, type AssignedProjectEmployee, type Project, type ProjectType } from "./domain/project";
export type { MaterialRequisition, RequisitionItem, RequisitionStatus } from "./domain/requisition";
export type { ToolLoan, ToolLoanStatus } from "./domain/tool-loan";
