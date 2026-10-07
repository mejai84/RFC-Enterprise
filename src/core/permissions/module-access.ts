export type ModuleAccess = {
  href: string;
  label: string;
  permissions: string[];
};

/**
 * Módulos de la plataforma y el permiso que abre cada uno.
 *
 * El menú lateral y la guarda de ruta consultan esta misma tabla, de modo que lo
 * que se ve y lo que se puede escribir no pueden quedar desalineados.
 */
export const moduleAccess: ModuleAccess[] = [
  { href: "/dashboard", label: "Resumen", permissions: ["dashboard.view", "dashboard.financials.view", "dashboard.intelligence.view"] },
  { href: "/quotes", label: "Cotizaciones", permissions: ["quotes.view", "quotes.manage"] },
  { href: "/apu", label: "APU", permissions: ["apu.view", "apu.manage"] },
  { href: "/projects", label: "Proyectos & Obras", permissions: ["projects.view", "projects.manage", "projects.requisitions.create", "projects.requisitions.approve"] },
  { href: "/attendance", label: "Registro de jornada", permissions: ["attendance.self.record", "attendance.team.view"] },
  { href: "/rentals", label: "Alquiler rápido", permissions: ["rentals.view", "rentals.manage"] },
  { href: "/inventory", label: "Inventarios", permissions: ["inventory.catalog.view", "inventory.stock.manage", "inventory.dispatch.create", "inventory.return.create", "inventory.tools.manage", "inventory.kardex.view"] },
  { href: "/movements", label: "Movimientos", permissions: ["inventory.kardex.view", "inventory.dispatch.create", "inventory.return.create"] },
  { href: "/counts", label: "Conteos físicos", permissions: ["inventory.stock.manage"] },
  { href: "/reports", label: "Informes", permissions: ["reports.view"] },
  { href: "/employees", label: "Empleados", permissions: ["core.users.manage"] },
  { href: "/perfil", label: "Mi perfil", permissions: ["core.profile.view"] },
  { href: "/settings", label: "Configuración", permissions: ["core.companies.manage"] },
];

export function canAccessModule(pathname: string, permissions: readonly string[]) {
  const definition = moduleAccess.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return !definition || definition.permissions.some((permission) => permissions.includes(permission));
}

/** Módulos visibles para la persona, en el orden en que aparecen en el menú. */
export function accessibleModules(permissions: readonly string[]): ModuleAccess[] {
  return moduleAccess.filter((item) => item.permissions.some((permission) => permissions.includes(permission)));
}

export type ModuleGroupId = "comercial" | "obras" | "bodega" | "consultas" | "administracion";

export type ModuleGroup = {
  id: ModuleGroupId;
  label: string;
  /** Modulos del bloque. Se guardan por ruta, la unica clave estable entre modulos. */
  hrefs: string[];
};

export const moduleGroups: ModuleGroup[] = [
  { id: "comercial", label: "Comercial", hrefs: ["/quotes", "/apu"] },
  { id: "obras", label: "Obras", hrefs: ["/projects", "/attendance", "/rentals"] },
  { id: "bodega", label: "Bodega", hrefs: ["/inventory", "/movements", "/counts"] },
  { id: "consultas", label: "Consultas", hrefs: ["/reports"] },
  { id: "administracion", label: "Administración", hrefs: ["/employees", "/perfil", "/settings"] },
];

export type NavigationSection = { id: ModuleGroupId | null; label: string; hrefs: string[] };

/**
 * Orden final del menu: los modulos sueltos primero y despues los bloques.
 * Solo entra lo que la persona puede ver. Un bloque con un solo modulo se
 * muestra suelto, porque rotularlo solo anade ruido.
 */
export function navigationSections(permissions: readonly string[]): {
  loose: string[];
  sections: NavigationSection[];
} {
  const allowed = accessibleModules(permissions).map((module) => module.href);
  const grouped = new Set(moduleGroups.flatMap((group) => group.hrefs));
  const loose = allowed.filter((href) => !grouped.has(href));
  const sections = moduleGroups
    .map((group) => {
      const hrefs = group.hrefs.filter((href) => allowed.includes(href));
      if (hrefs.length === 0) return null;
      if (hrefs.length === 1) return { id: null as ModuleGroupId | null, label: "", hrefs };
      return { id: group.id, label: group.label, hrefs };
    })
    .filter((section): section is NavigationSection => section !== null);
  return { loose, sections };
}

/**
 * Ruta de arranque según el primer módulo permitido. Un trabajador operativo que
 * solo tiene acceso a su jornada entra directo allí, no a un resumen que no puede ver.
 */
export function defaultLandingPath(permissions: readonly string[]): string {
  return accessibleModules(permissions)[0]?.href ?? "/attendance";
}