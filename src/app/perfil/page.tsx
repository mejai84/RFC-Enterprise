import { DashboardShell } from "@/app/dashboard-shell";
import { ProfileWorkspace } from "@/core/settings/presentation/profile-workspace";

export const metadata = {
  title: "Mi perfil | RFC Enterprise",
  description: "Datos personales de la cuenta con la que inicias sesión.",
};

export default function ProfilePage() {
  return (
    <DashboardShell>
      <ProfileWorkspace />
    </DashboardShell>
  );
}