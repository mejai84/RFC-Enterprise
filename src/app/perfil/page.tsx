import { DashboardShell } from "@/app/dashboard-shell";
import { ProfileWorkspace } from "@/core/settings/presentation/profile-workspace";

export const metadata = {
  title: "Mi cuenta | RFC Enterprise",
  description: "Datos personales, seguridad y permisos de la cuenta con la que inicias sesión.",
};

export default function ProfilePage() {
  return (
    <DashboardShell>
      <ProfileWorkspace />
    </DashboardShell>
  );
}