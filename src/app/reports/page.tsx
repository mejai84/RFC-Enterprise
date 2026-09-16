import { DashboardShell } from "@/app/dashboard-shell";
import { ReportsWorkspace } from "@/modules/inventory/presentation/reports-workspace";

const reports = ["Resumen ejecutivo", "Kardex valorizado", "Ejecución por obra", "Stock crítico", "Compras y proveedores", "Herramientas en custodia", "Auditoría de movimientos"];
export default function ReportsPage() { return <DashboardShell><ReportsWorkspace /></DashboardShell>; }
