import type { StockProduct } from "../fixtures";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const groupNames: Record<string, string> = { bodega: "Bodega", dotacion: "Dotación", trabajadores: "Trabajadores" };

export type InventoryLoadResult =
  | { source: "demo"; products: undefined; error?: undefined }
  | { source: "database"; products: StockProduct[]; error?: string };

export async function getInventoryProducts(): Promise<InventoryLoadResult> {
  if (!isSupabaseConfigured) return { source: "demo", products: undefined };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inventory_stock")
      .select("id, inventory_group, location, quantity, minimum_quantity, inventory_items(id, sku, name, category, brand, unit)")
      .order("inventory_group")
      .order("created_at");

    if (error) return { source: "database", products: [], error: "No fue posible cargar el inventario asignado a tu cuenta." };

    const products = (data ?? []).flatMap((stock) => {
      const item = Array.isArray(stock.inventory_items) ? stock.inventory_items[0] : stock.inventory_items;
      if (!item) return [];
      return [{
        id: stock.id,
        sku: item.sku ?? item.name,
        name: item.name,
        category: item.category ?? "Sin categoría",
        available: Number(stock.quantity),
        brand: item.brand ?? "Sin marca",
        location: stock.location ?? "Sin ubicación",
        notes: null,
        inventoryGroup: stock.inventory_group,
        inventoryGroupName: groupNames[stock.inventory_group] ?? stock.inventory_group,
        unit: item.unit ?? "unidad",
        minimum: stock.minimum_quantity === null ? null : Number(stock.minimum_quantity),
        active: true,
        sourceRow: 0,
      } satisfies StockProduct];
    });

    return { source: "database", products };
  } catch {
    return { source: "demo", products: undefined };
  }
}
