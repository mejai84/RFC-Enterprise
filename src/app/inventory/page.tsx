import { InventoryWorkspace } from "@/modules/inventory/presentation/inventory-workspace";
import { getInventoryProducts } from "@/modules/inventory/application/get-inventory-products";

export default async function InventoryPage() {
  const inventory = await getInventoryProducts();
  return <InventoryWorkspace dataSource={inventory.source} initialProducts={inventory.products} loadError={inventory.error} />;
}
