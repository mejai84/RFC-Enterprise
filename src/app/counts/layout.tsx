import type { ReactNode } from "react";
import { requireAnyEffectivePermission } from "@/core/permissions/server";

// La guarda consulta la sesión y los permisos en cada petición; no se puede
// prerenderizar sin una sesión real.
export const dynamic = "force-dynamic";

export default async function CountsLayout({ children }: { children: ReactNode }) {
  await requireAnyEffectivePermission([
    "inventory.stock.manage",
    "inventory.items.manage",
    "inventory.catalog.view",
  ]);
  return children;
}
