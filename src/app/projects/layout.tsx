import { DashboardShell } from "@/app/dashboard-shell";
import { requireAuthenticatedUser } from "@/core/auth/server";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser();
  return <DashboardShell>{children}</DashboardShell>;
}
