import { DashboardShell } from "@/app/dashboard-shell";
import { requireAuthenticatedUser } from "@/core/auth/server";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await requireAuthenticatedUser();
  return <DashboardShell>{children}</DashboardShell>;
}
