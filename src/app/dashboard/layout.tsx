import { DashboardShell } from "@/app/dashboard-shell";
import { requireAnyEffectivePermission } from "@/core/permissions/server";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await requireAnyEffectivePermission([
    'dashboard.view',
    'dashboard.financials.view',
    'dashboard.intelligence.view',
  ]);
  return <DashboardShell>{children}</DashboardShell>;
}
