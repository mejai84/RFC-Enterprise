import type { ReactNode } from "react";
import { requireAnyEffectivePermission } from "@/core/permissions/server";

// La guarda consulta la sesión y los permisos en cada petición; no se puede
// prerenderizar sin una sesión real.
export const dynamic = "force-dynamic";

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireAnyEffectivePermission([
    "reports.view",
    "inventory.reports.read",
    "inventory.kardex.view",
    "inventory.stock.read",
  ]);
  return children;
}
