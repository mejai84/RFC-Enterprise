import type { EntityId } from "@/shared/types/identifiers";
import type { Product } from "./product";
import type { StockMovement } from "./movement";

export type ProductQuery = { search?: string; onlyActive?: boolean };

/**
 * Contrato de persistencia del módulo. La implementación en memoria sirve para
 * desarrollo; un repositorio real (base de datos) debe cumplir la misma firma.
 */
export interface InventoryRepository {
  listProducts(query: ProductQuery): Promise<Product[]>;
  findProduct(id: EntityId): Promise<Product | null>;
  listMovements(productId?: EntityId): Promise<StockMovement[]>;
  nextMovementId(): Promise<EntityId>;
  saveMovement(movement: StockMovement): Promise<void>;
}
