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
  { href: "/settings", label: "Configuración", permissions: ["core.profile.view", "core.companies.manage"] },
];

export function canAccessModule(pathname: string, permissions: readonly string[]) {
  const definition = moduleAccess.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return !definition || definition.permissions.some((permission) => permissions.includes(permission));
}

/** Módulos visibles para la persona, en el orden en que aparecen en el menú. */
export function accessibleModules(permissions: readonly string[]): ModuleAccess[] {
  return moduleAccess.filter((item) => item.permissions.some((permission) => permissions.includes(permission)));
}

/**
 * Ruta de arranque según el primer módulo permitido. Un trabajador operativo que
 * solo tiene acceso a su jornada entra directo allí, no a un resumen que no puede ver.
 */
export function defaultLandingPath(permissions: readonly string[]): string {
  return accessibleModules(permissions)[0]?.href ?? "/attendance";
}