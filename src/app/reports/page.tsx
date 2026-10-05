import { DashboardShell } from "@/app/dashboard-shell";
import { ReportsWorkspace } from "@/modules/inventory/presentation/reports-workspace";
import { getInventoryProducts } from "@/modules/inventory/application/get-inventory-products";

const reports = ["Resumen ejecutivo", "Kardex valorizado", "Ejecución por obra", "Stock crítico", "Compras y proveedores", "Herramientas en custodia", "Auditoría de movimientos"];
export default async function ReportsPage() { const inventory = await getInventoryProducts(); return <DashboardShell><ReportsWorkspace initialProducts={inventory.products ?? []} /></DashboardShell>; }
