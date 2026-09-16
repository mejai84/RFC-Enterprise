import { DashboardExecutiveWorkspace } from "@/modules/inventory/presentation/dashboard-executive-workspace";

export const metadata = {
  title: "Dashboard Ejecutivo de Obras y Materiales | RFC Enterprise",
  description: "Monitoreo financiero en tiempo real del gasto de insumos y control de despachos por obra.",
};

export default function DashboardPage() {
  return <DashboardExecutiveWorkspace />;
}
