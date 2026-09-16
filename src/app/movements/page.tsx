import { InventoryWorkspace } from "@/modules/inventory/presentation/inventory-workspace";
import { getInventoryProducts } from "@/modules/inventory/application/get-inventory-products";

export const metadata = {
  title: "Kardex de Movimientos y Remisiones | RFC Enterprise",
  description: "Historial completo de entradas, salidas de material por obra, ajustes y devoluciones.",
};

export default async function MovementsPage() {
  const inventory = await getInventoryProducts();
  return <InventoryWorkspace dataSource={inventory.source} initialProducts={inventory.products} loadError={inventory.error} initialTab="movements" />;
}
