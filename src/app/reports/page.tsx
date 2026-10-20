import { DashboardShell } from "@/app/dashboard-shell";
import { ReportsWorkspace } from "@/modules/inventory/presentation/reports-workspace";
import { getInventoryProducts } from "@/modules/inventory/application/get-inventory-products";

// Los productos se leen con la sesión y RLS del usuario: la página no puede
// quedar prerenderizada con un inventario vacío de la compilación.
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const inventory = await getInventoryProducts();
  return (
    <DashboardShell>
      <ReportsWorkspace initialProducts={inventory.products ?? []} />
    </DashboardShell>
  );
}
