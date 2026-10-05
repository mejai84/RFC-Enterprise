import { DashboardShell } from "@/app/dashboard-shell";
import { CountsWorkspace } from "@/modules/inventory/presentation/counts-workspace";
import { getInventoryProducts } from "@/modules/inventory/application/get-inventory-products";
export default async function CountsPage() { const inventory = await getInventoryProducts(); return <DashboardShell><CountsWorkspace products={inventory.products ?? []} /></DashboardShell>; }
