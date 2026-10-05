import importedCatalog from "./data/catalogo-inicial.json";
import importedAliases from "./data/catalogo-aliases.json";
import type { InventoryMovement } from "./domain/movement";
import type { Product } from "./domain/product";
import { initialProjects, type Project } from "./domain/project";
import { sampleInitialRequisitions, type MaterialRequisition } from "./domain/requisition";
import { sampleInitialToolLoans, type ToolLoan } from "./domain/tool-loan";

export type InventoryGroup = "bodega" | "dotacion" | "trabajadores";
export type InventoryItemKind = "material" | "tool" | "equipment" | "ppe";

export type StockProduct = Product & {
  itemId?: string;
  unit: string;
  available: number;
  minimum: number | null;
  location: string;
  category: string;
  brand: string;
  notes: string | null;
  /** Nombres comunes, comerciales o regionales que dirigen al artículo técnico. */
  aliases?: string[];
  inventoryGroup: InventoryGroup;
  inventoryGroupName: string;
  unitCost?: number; // Costo unitario promedio en COP
  purchaseUnit?: string; // Presentación recibida del proveedor, p. ej. caja
  unitsPerPurchase?: number; // Unidades de consumo contenidas por presentación
  purchaseUnitCost?: number; // Costo de una presentación de compra en COP
  model?: string;
  technicalReference?: string;
  serialNumber?: string;
  acquiredAt?: string;
  warrantyUntil?: string;
  assetCondition?: "available" | "in_service" | "maintenance" | "retired";
  sourceRow: number;
};

/** Clasificación operativa para no confundir activos reutilizables con insumos consumibles. */
export function getInventoryItemKind(product: Pick<StockProduct, "inventoryGroup" | "category" | "name">): InventoryItemKind {
  const text = `${product.category} ${product.name}`.toLocaleLowerCase("es-CO");
  if (product.inventoryGroup === "dotacion" || /protecci|uniforme|dotaci.n|seguridad personal|casco|guante|bota|rodillera/.test(text)) return "ppe";
  if (/consumible|electrodo|disco de corte|lija|broca|tornill|clavo|remache/.test(text)) return "material";
  if (/herramientas? el.ctrica|equipo de |taladro|pulidora|esmeril|soldadora|soldadura|mezcladora|compresor|generador/.test(text)) return "equipment";
  if (/herramient|medici.n|llave|martillo|mazo|pala|pal.n|palustre|nivel|segueta|tenaza|tijera|alicate|destornillador|flex.metro|metro/.test(text)) return "tool";
  return "material";
}

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
  aliases: getDefaultAliases(product.name),
  unitCost: getProductUnitCost(product),
}));

/** Completa aliases semilla en catálogos guardados antes de incorporar esta capacidad. */
export function withDefaultInventoryAliases(products: StockProduct[]): StockProduct[] {
  return products.map((product) => ({
    ...product,
    aliases: [...new Set([...(product.aliases ?? []), ...getDefaultAliases(product.name)])],
  }));
}

type CatalogAlias = { match: string[]; aliases: string[] };

function getDefaultAliases(name: string): string[] {
  const normalizedName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CO");
  return (importedAliases as CatalogAlias[])
    .filter((entry) => entry.match.some((term) => normalizedName.includes(term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CO"))))
    .flatMap((entry) => entry.aliases);
}

export const sampleInitialMovements: InventoryMovement[] = [];


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
