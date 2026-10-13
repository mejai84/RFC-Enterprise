"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ErpModule } from "@/core/modules/catalog";

const GENERAL_ROUTE = "/dashboard";

export function AppNav({ modules }: { modules: readonly ErpModule[] }) {
  const pathname = usePathname();
  // El módulo `core` comparte ruta con la sección general; se omite para no duplicar la entrada.
  const applications = modules.filter((module) => module.route !== GENERAL_ROUTE);

  return (
    <>
      <div className="nav-label">General</div>
      <Link className={pathname === GENERAL_ROUTE ? "nav-item active" : "nav-item"} href={GENERAL_ROUTE}>Resumen</Link>
      <div className="nav-label">Aplicaciones</div>
      {applications.map((module) => (
        <Link className={pathname.startsWith(module.route) ? "nav-item active" : "nav-item"} href={module.route} key={module.code}>{module.name}</Link>
      ))}
    </>
  );
}
