import { DashboardShell } from "@/app/dashboard-shell";
import { LaborWorkspace } from "@/modules/apu/presentation/labor-workspace";

export const metadata = { title: "Tarifas Salariales | RFC Enterprise" };

export default function LaborPage() {
  return (
    <DashboardShell>
      <LaborWorkspace />
    </DashboardShell>
  );
}
