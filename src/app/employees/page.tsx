import { DashboardShell } from "@/app/dashboard-shell";
import { EmployeesWorkspace } from "@/core/users/presentation/employees-workspace";

export const metadata = {
  title: "Personal y accesos | RFC Enterprise",
  description: "Directorio de empleados, administración de identidades, roles del sistema y permisos efectivos.",
};

export default function EmployeesPage() {
  return (
    <DashboardShell>
      <EmployeesWorkspace />
    </DashboardShell>
  );
}
