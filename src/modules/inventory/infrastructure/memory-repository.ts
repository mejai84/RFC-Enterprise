import type { EntityId } from "@/shared/types/identifiers";
import type { StockMovement } from "../domain/movement";
import type { Product } from "../domain/product";
import type { InventoryRepository, ProductQuery } from "../domain/repository";

const MAIN_BRANCH: EntityId = "branch-caucasia";

const seedProducts: Product[] = [
  { id: "prd-001", sku: "CEM-001", name: "Cemento Gris 50 kg", category: "Concretos y morteros", unit: "paquete", minStock: 120, active: true },
  { id: "prd-002", sku: "ACE-014", name: "Acero de refuerzo 1/2 pulg", category: "Metalmecánica", unit: "metro", minStock: 200, active: true },
  { id: "prd-003", sku: "PINT-022", name: "Anticorrosivo epóxico", category: "Pinturas y recubrimientos", unit: "litro", minStock: 40, active: true },
  { id: "prd-004", sku: "TUB-031", name: "Tubería PVC 4 pulg", category: "Instalaciones", unit: "unidad", minStock: 25, active: true },
  { id: "prd-005", sku: "ELE-008", name: "CABLE THHN 12 AWG", category: "Electricidad", unit: "metro", minStock: 300, active: true },
  { id: "prd-006", sku: "SEG-045", name: "Casco de seguridad", category: "Seguridad industrial", unit: "unidad", minStock: 15, active: true },
  { id: "prd-007", sku: "MAD-060", name: "Madera de pino", category: "Carpintería", unit: "unidad", minStock: 10, active: false },
];

function seedMovements(): StockMovement[] {
  const day = 86_400_000;
  const now = Date.now();
  return [
    { id: "mov-001", productId: "prd-001", branchId: MAIN_BRANCH, type: "entrada", reason: "compra", quantity: 400, note: null, registeredBy: "usr-001", occurredAt: new Date(now - 6 * day) },
    { id: "mov-002", productId: "prd-001", branchId: MAIN_BRANCH, type: "salida", reason: "consumo_proyecto", quantity: 260, note: "Obra vial barrio La Esperanza", registeredBy: "usr-001", occurredAt: new Date(now - 3 * day) },
    { id: "mov-003", productId: "prd-002", branchId: MAIN_BRANCH, type: "entrada", reason: "compra", quantity: 500, note: null, registeredBy: "usr-001", occurredAt: new Date(now - 5 * day) },
    { id: "mov-004", productId: "prd-002", branchId: MAIN_BRANCH, type: "salida", reason: "consumo_proyecto", quantity: 480, note: null, registeredBy: "usr-002", occurredAt: new Date(now - 2 * day) },
    { id: "mov-005", productId: "prd-003", branchId: MAIN_BRANCH, type: "entrada", reason: "compra", quantity: 30, note: null, registeredBy: "usr-002", occurredAt: new Date(now - 4 * day) },
    { id: "mov-006", productId: "prd-004", branchId: MAIN_BRANCH, type: "entrada", reason: "compra", quantity: 60, note: null, registeredBy: "usr-001", occurredAt: new Date(now - 4 * day) },
    { id: "mov-007", productId: "prd-004", branchId: MAIN_BRANCH, type: "salida", reason: "merma", quantity: 12, note: "Rotura en transporte", registeredBy: "usr-002", occurredAt: new Date(now - day) },
    { id: "mov-008", productId: "prd-005", branchId: MAIN_BRANCH, type: "entrada", reason: "compra", quantity: 200, note: null, registeredBy: "usr-001", occurredAt: new Date(now - 8 * day) },
    { id: "mov-009", productId: "prd-005", branchId: MAIN_BRANCH, type: "salida", reason: "venta", quantity: 150, note: null, registeredBy: "usr-002", occurredAt: new Date(now - 5 * day) },
    { id: "mov-010", productId: "prd-006", branchId: MAIN_BRANCH, type: "entrada", reason: "compra", quantity: 30, note: null, registeredBy: "usr-001", occurredAt: new Date(now - 7 * day) },
    { id: "mov-011", productId: "prd-006", branchId: MAIN_BRANCH, type: "salida", reason: "consumo_proyecto", quantity: 18, note: null, registeredBy: "usr-001", occurredAt: new Date(now - 2 * day) },
  ];
}

/**
 * Implementación en memoria para desarrollo. El estado vive en el proceso, por lo
 * que se reinicia en cada carga; sustituir por un repositorio persistente cuando
 * el flujo lo requiera (ver InventoryRepository).
 */
class InMemoryInventoryRepository implements InventoryRepository {
  private products: Product[];
  private movements: StockMovement[];
  private sequence: number;

  constructor(products: Product[], movements: StockMovement[]) {
    this.products = products;
    this.movements = movements;
    this.sequence = movements.length;
  }

  async listProducts(query: ProductQuery): Promise<Product[]> {
    return this.products.filter((product) => (query.onlyActive ? product.active : true));
  }

  async findProduct(id: EntityId): Promise<Product | null> {
    return this.products.find((product) => product.id === id) ?? null;
  }

  async listMovements(productId?: EntityId): Promise<StockMovement[]> {
    return productId ? this.movements.filter((movement) => movement.productId === productId) : [...this.movements];
  }

  async nextMovementId(): Promise<EntityId> {
    this.sequence += 1;
    return `mov-${String(this.sequence).padStart(3, "0")}`;
  }

  async saveMovement(movement: StockMovement): Promise<void> {
    this.movements.push(movement);
  }
}

/** Repositorio compartido por las rutas del módulo mientras no exista persistencia. */
export const inventoryRepository: InventoryRepository = new InMemoryInventoryRepository(seedProducts, seedMovements());

export const mainBranchId = MAIN_BRANCH;
