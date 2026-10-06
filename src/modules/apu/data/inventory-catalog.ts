import { createBrowserClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import type { InventoryGroup, StockProduct } from "@/modules/inventory";

const groupNames: Record<string, string> = {
  bodega: "Bodega",
  dotacion: "Dotación",
  trabajadores: "Trabajadores",
};

type StockRow = {
  id: string;
  inventory_group: InventoryGroup;
  location: string | null;
  quantity: number | string | null;
  minimum_quantity: number | string | null;
  unit_cost: number | string | null;
  inventory_items:
    | {
        id: string;
        sku: string | null;
        name: string;
        category: string | null;
        brand: string | null;
        unit: string | null;
        notes: string | null;
        technical_reference: string | null;
        model: string | null;
        serial_number: string | null;
        purchase_unit: string | null;
        units_per_purchase: number | string | null;
        purchase_unit_cost: number | string | null;
      }
    | Array<{
        id: string;
        sku: string | null;
        name: string;
        category: string | null;
        brand: string | null;
        unit: string | null;
        notes: string | null;
        technical_reference: string | null;
        model: string | null;
        serial_number: string | null;
        purchase_unit: string | null;
        units_per_purchase: number | string | null;
        purchase_unit_cost: number | string | null;
      }>
    | null;
};

/**
 * Catálogo de inventario disponible para costear materiales y equipos en el APU.
 * Lee de Supabase con el usuario autenticado, igual que el módulo de Inventarios.
 */
export async function loadApuInventoryCatalog(): Promise<{
  products: StockProduct[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    return { products: [], error: "Supabase no está configurado." };
  }
  const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
  const { data, error } = await supabase
    .from("inventory_stock")
    .select(
      "id, inventory_group, location, quantity, minimum_quantity, unit_cost, inventory_items(id, sku, name, category, brand, unit, notes, technical_reference, model, serial_number, purchase_unit, units_per_purchase, purchase_unit_cost)",
    )
    .limit(2000);

  if (error) {
    return { products: [], error: error.message };
  }

  const products = (data ?? []).flatMap((row) => {
    const stock = row as StockRow;
    const item = Array.isArray(stock.inventory_items)
      ? stock.inventory_items[0]
      : stock.inventory_items;
    if (!item) return [];
    return [
      {
        id: stock.id,
        itemId: item.id,
        sku: item.sku ?? item.name,
        name: item.name,
        category: item.category ?? "Sin categoría",
        available: Number(stock.quantity ?? 0),
        brand: item.brand ?? "Sin marca",
        location: stock.location ?? "Sin ubicación",
        notes: item.notes ?? null,
        inventoryGroup: stock.inventory_group,
        inventoryGroupName:
          groupNames[stock.inventory_group] ?? stock.inventory_group,
        unit: item.unit ?? "unidad",
        minimum:
          stock.minimum_quantity === null ? null : Number(stock.minimum_quantity),
        unitCost: Number(stock.unit_cost ?? 0),
        purchaseUnit: item.purchase_unit ?? undefined,
        unitsPerPurchase:
          item.units_per_purchase === null
            ? undefined
            : Number(item.units_per_purchase),
        purchaseUnitCost:
          item.purchase_unit_cost === null
            ? undefined
            : Number(item.purchase_unit_cost),
        technicalReference: item.technical_reference ?? undefined,
        model: item.model ?? undefined,
        serialNumber: item.serial_number ?? undefined,
        active: true,
        sourceRow: 0,
      } satisfies StockProduct,
    ];
  });

  return { products };
}
