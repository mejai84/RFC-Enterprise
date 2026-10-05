import { DashboardExecutiveWorkspace } from "@/modules/inventory/presentation/dashboard-executive-workspace";
import { getInventoryProducts } from "@/modules/inventory/application/get-inventory-products";

export const metadata = {
  title: "Dashboard Ejecutivo de Obras y Materiales | RFC Enterprise",
  description:
    "Monitoreo financiero en tiempo real del gasto de insumos y control de despachos por obra.",
};

export default async function DashboardPage() {
  const inventory = await getInventoryProducts();
  return (
    <DashboardExecutiveWorkspace initialProducts={inventory.products ?? []} />
  );
}
