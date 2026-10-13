"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ErpModule } from "@/core/modules/catalog";

export function AppNav({ modules }: { modules: readonly ErpModule[] }) {
  const pathname = usePathname();

  return (
    <>
      <div className="nav-label">General</div>
      <Link className={pathname === "/dashboard" ? "nav-item active" : "nav-item"} href="/dashboard">Resumen</Link>
      <div className="nav-label">Aplicaciones</div>
      {modules.map((module) => (
        <Link className={pathname.startsWith(module.route) ? "nav-item active" : "nav-item"} href={module.route} key={module.code}>{module.name}</Link>
      ))}
    </>
  );
}
