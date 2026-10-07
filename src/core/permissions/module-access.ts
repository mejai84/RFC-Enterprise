export type ModuleAccess = {
  href: string;
  label: string;
  permissions: string[];
};

/** A module is visible when the person has at least one of its operations. */
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
