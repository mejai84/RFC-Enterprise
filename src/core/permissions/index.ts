export type Permission = { code: string; description: string; module: string };

export const corePermissions = [
  // Core / Administración
  { code: "core.users.manage", description: "Administrar usuarios y sus estados.", module: "core" },
  { code: "core.roles.manage", description: "Administrar roles y permisos.", module: "core" },
  { code: "core.companies.manage", description: "Administrar empresas y sedes.", module: "core" },
  { code: "core.modules.manage", description: "Administrar módulos habilitados.", module: "core" },
  { code: "core.audit.read", description: "Consultar la auditoría del sistema.", module: "core" },

  // Dashboard / Finanzas
  { code: "dashboard.financials.view", description: "Ver cifras financieras globales, presupuestos y gasto en COP.", module: "dashboard" },
  { code: "dashboard.intelligence.view", description: "Ver Top de materiales costosos y ranking de insumos.", module: "dashboard" },

  // Obras / Proyectos
  { code: "projects.view", description: "Consultar fichas y estado de obras.", module: "projects" },
  { code: "projects.manage", description: "Crear y editar obras y presupuestos.", module: "projects" },
  { code: "projects.requisitions.create", description: "Crear solicitudes/requisiciones de material desde obra.", module: "projects" },
  { code: "projects.requisitions.approve", description: "Aprobar técnicamente requisiciones de obra.", module: "projects" },

  // Inventarios / Almacén
  { code: "inventory.catalog.view", description: "Consultar catálogo y niveles de stock.", module: "inventory" },
  { code: "inventory.stock.manage", description: "Ajustar existencias y stocks mínimos.", module: "inventory" },
  { code: "inventory.dispatch.create", description: "Emitir vales de salida de material a obra con remisión.", module: "inventory" },
  { code: "inventory.return.create", description: "Registrar devolución y reintegro de sobrantes de obra.", module: "inventory" },
  { code: "inventory.tools.manage", description: "Registrar préstamos y custodias de herramientas.", module: "inventory" },
  { code: "inventory.kardex.view", description: "Consultar historial completo del Kardex valorizado.", module: "inventory" },
] as const satisfies readonly Permission[];

export type PermissionCode = (typeof corePermissions)[number]["code"];
