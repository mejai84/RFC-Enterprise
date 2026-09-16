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
  type StockProduct,
  type InventoryGroup,
} from "./fixtures";

export type { InventoryMovement, MovementType } from "./domain/movement";
export type { Product } from "./domain/product";
export type { Project } from "./domain/project";
export type { MaterialRequisition, RequisitionItem, RequisitionStatus } from "./domain/requisition";
export type { ToolLoan, ToolLoanStatus } from "./domain/tool-loan";

