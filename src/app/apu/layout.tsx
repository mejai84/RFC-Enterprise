import { DashboardShell } from "@/app/dashboard-shell";
import { requireAuthenticatedUser } from "@/core/auth/server";

export default async function ApuLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser();
  return <DashboardShell>{children}</DashboardShell>;
}
