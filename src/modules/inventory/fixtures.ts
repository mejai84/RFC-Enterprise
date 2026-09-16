import importedCatalog from "./data/catalogo-inicial.json";
import type { InventoryMovement } from "./domain/movement";
import type { Product } from "./domain/product";
import { initialProjects, type Project } from "./domain/project";
import { sampleInitialRequisitions, type MaterialRequisition } from "./domain/requisition";
import { sampleInitialToolLoans, type ToolLoan } from "./domain/tool-loan";

export type InventoryGroup = "bodega" | "dotacion" | "trabajadores";

export type StockProduct = Product & {
  unit: string;
  available: number;
  minimum: number | null;
  location: string;
  category: string;
  brand: string;
  notes: string | null;
  inventoryGroup: InventoryGroup;
  inventoryGroupName: string;
  unitCost?: number; // Costo unitario promedio en COP
  sourceRow: number;
};

// Estimación de costo base realista para los artículos que no lo traigan especificado
export function getProductUnitCost(product: { category?: string; name?: string; unitCost?: number }): number {
  if (product.unitCost && product.unitCost > 0) return product.unitCost;
  const name = (product.name || "").toLowerCase();
  const category = (product.category || "").toLowerCase();

  if (category.includes("cemento") || name.includes("cemento")) return 32000;
  if (category.includes("acero") || name.includes("varilla") || name.includes("perfil") || name.includes("tubo")) return 68000;
  if (category.includes("herramienta") || name.includes("taladro") || name.includes("pulidora")) return 280000;
  if (category.includes("pintura") || name.includes("esmalte") || name.includes("anticorrosivo")) return 95000;
  if (category.includes("electr") || name.includes("cable") || name.includes("breaker")) return 42000;
  if (category.includes("seguridad") || name.includes("casco") || name.includes("bota") || name.includes("guante")) return 35000;
  if (name.includes("disco") || name.includes("electrodo") || name.includes("tornillo")) return 14500;
  return 25000;
}

/** Catálogo inicial normalizado desde Inventario_Basico.xlsx con costo estimado */
export const inventoryProducts = (importedCatalog as StockProduct[]).map((product) => ({
  ...product,
  unitCost: getProductUnitCost(product),
}));

export const sampleInitialMovements: InventoryMovement[] = [
  {
    id: "mov-init-01",
    productId: inventoryProducts[0]?.id || "prod-1",
    productName: inventoryProducts[0]?.name || "Cemento Gris Tipo 1",
    type: "exit",
    quantity: 40,
    unit: "bulto",
    unitCost: 32000,
    totalCost: 1280000,
    occurredAt: "10 Mar, 08:30",
    reference: "VALE-2026-001",
    projectId: "prj-01",
    projectName: "Construcción Estructura Metálica y Cubierta",
    responsible: "Carlos Restrepo (Maestro)",
    notes: "Fundición de zapatas bloque frontal",
  },
  {
    id: "mov-init-02",
    productId: inventoryProducts[1]?.id || "prod-2",
    productName: inventoryProducts[1]?.name || "Varilla Corrugada 1/2 pulg",
    type: "exit",
    quantity: 25,
    unit: "unidad",
    unitCost: 68000,
    totalCost: 1700000,
    occurredAt: "11 Mar, 10:15",
    reference: "VALE-2026-002",
    projectId: "prj-01",
    projectName: "Construcción Estructura Metálica y Cubierta",
    responsible: "Carlos Restrepo (Maestro)",
    notes: "Armado de columnas principales",
  },
  {
    id: "mov-init-03",
    productId: inventoryProducts[2]?.id || "prod-3",
    productName: inventoryProducts[2]?.name || "Pintura Anticorrosiva Verde",
    type: "exit",
    quantity: 6,
    unit: "galon",
    unitCost: 95000,
    totalCost: 570000,
    occurredAt: "12 Mar, 14:00",
    reference: "VALE-2026-003",
    projectId: "prj-02",
    projectName: "Mantenimiento Integral de Instalaciones Industriales",
    responsible: "Javier Morales (Ing. Residente)",
    notes: "Protección de tanques y tuberías",
  },
  {
    id: "mov-init-04",
    productId: inventoryProducts[0]?.id || "prod-1",
    productName: inventoryProducts[0]?.name || "Cemento Gris Tipo 1",
    type: "entry",
    quantity: 100,
    unit: "bulto",
    unitCost: 32000,
    totalCost: 3200000,
    occurredAt: "14 Mar, 09:00",
    reference: "FAC-PROV-8841",
    responsible: "Almacén Central",
    notes: "Compra a Distribuidora Argos",
  },
];

export const inventoryMovements: readonly InventoryMovement[] = sampleInitialMovements;
export const inventoryProjects: readonly Project[] = initialProjects;
export const inventoryRequisitions: readonly MaterialRequisition[] = sampleInitialRequisitions;
export const inventoryToolLoans: readonly ToolLoan[] = sampleInitialToolLoans;


export const inventorySourceSummary = {
  sourceName: "Inventario_Basico.xlsx",
  products: 1191,
  units: 12495,
  historicalMovements: 822,
  groups: [
    { code: "bodega", name: "Bodega", products: 939, units: 10624 },
    { code: "dotacion", name: "Dotación", products: 154, units: 1732 },
    { code: "trabajadores", name: "Herramientas de trabajadores", products: 98, units: 139 },
  ],
} as const;
