import type { ReactNode } from "react";
import { DashboardShell } from "@/app/dashboard-shell";
import { requireAnyEffectivePermission } from "@/core/permissions/server";

// La guarda consulta la sesión y los permisos en cada petición; no se puede
// prerenderizar sin una sesión real.
export const dynamic = "force-dynamic";

export default async function InventoryLayout({ children }: { children: ReactNode }) {
  await requireAnyEffectivePermission([
    "inventory.catalog.view",
    "inventory.items.read",
    "inventory.items.manage",
    "inventory.stock.read",
    "inventory.stock.manage",
    "inventory.movements.read",
    "inventory.movements.create",
    "inventory.dispatch.create",
    "inventory.return.create",
    "inventory.tools.manage",
    "inventory.kardex.view",
    "inventory.reports.read",
  ]);
  return <DashboardShell>{children}</DashboardShell>;
}
