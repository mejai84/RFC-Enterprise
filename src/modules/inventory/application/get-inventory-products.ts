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
      .select("id, inventory_group, location, quantity, minimum_quantity, unit_cost, valuation_status, initial_value_source, inventory_items(id, sku, name, category, brand, unit, notes, technical_reference, model, serial_number, acquired_at, warranty_until, asset_condition, purchase_unit, units_per_purchase, purchase_unit_cost)")
      .order("inventory_group")
      .order("created_at");

    if (error) return { source: "database", products: [], error: "No fue posible cargar el inventario asignado a tu cuenta." };

    const products = (data ?? []).flatMap((stock) => {
      const item = Array.isArray(stock.inventory_items) ? stock.inventory_items[0] : stock.inventory_items;
      if (!item) return [];
      return [{
        id: stock.id,
        itemId: item.id,
        sku: item.sku ?? item.name,
        name: item.name,
        category: item.category ?? "Sin categoría",
        available: Number(stock.quantity),
        brand: item.brand ?? "Sin marca",
        location: stock.location ?? "Sin ubicación",
        notes: item.notes ?? null,
        inventoryGroup: stock.inventory_group,
        inventoryGroupName: groupNames[stock.inventory_group] ?? stock.inventory_group,
        unit: item.unit ?? "unidad",
        minimum: stock.minimum_quantity === null ? null : Number(stock.minimum_quantity),
        unitCost: Number(stock.unit_cost),
        purchaseUnit: item.purchase_unit ?? undefined,
        unitsPerPurchase: item.units_per_purchase === null ? undefined : Number(item.units_per_purchase),
        purchaseUnitCost: item.purchase_unit_cost === null ? undefined : Number(item.purchase_unit_cost),
        technicalReference: item.technical_reference ?? undefined,
        model: item.model ?? undefined,
        serialNumber: item.serial_number ?? undefined,
        acquiredAt: item.acquired_at ?? undefined,
        warrantyUntil: item.warranty_until ?? undefined,
        assetCondition: item.asset_condition ?? undefined,
        active: true,
        sourceRow: 0,
      } satisfies StockProduct];
    });

    return { source: "database", products };
  } catch {
    return { source: "demo", products: undefined };
  }
}
