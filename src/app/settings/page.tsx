import { DashboardShell } from "@/app/dashboard-shell";
import { SettingsWorkspace } from "@/core/settings/presentation/settings-workspace";

export const metadata = {
  title: "Configuración | RFC Enterprise",
  description: "Centro de configuración empresarial, parámetros comerciales y costos laborales.",
};

export default function SettingsPage() {
  return (
    <DashboardShell>
      <SettingsWorkspace />
    </DashboardShell>
  );
}
