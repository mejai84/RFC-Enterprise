import { type PermissionCode } from "@/core/permissions";

export type RoleCode = "administrator" | "resident_engineer" | "warehouse_lead" | "foreman" | "auditor";

export type Role = {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
  level: number;
  dashboardVisibility: {
    canViewCompanyFinances: boolean;
    canViewAllProjects: boolean;
    canViewTopMaterialsCost: boolean;
    canViewWarehouseAlerts: boolean;
    canApproveRequisitions: boolean;
    canDispatchMaterial: boolean;
    canManageTools: boolean;
  };
  permissionCodes: readonly PermissionCode[];
};

export const employeeRoles: Role[] = [
  {
    id: "role-administrator",
    code: "administrator",
    name: "Administrador / Gerencia General",
    description: "Control total de operaciones, finanzas consolidadas, presupuestos, auditoría y parametrización.",
    level: 1,
    dashboardVisibility: {
      canViewCompanyFinances: true,
      canViewAllProjects: true,
      canViewTopMaterialsCost: true,
      canViewWarehouseAlerts: true,
      canApproveRequisitions: true,
      canDispatchMaterial: true,
      canManageTools: true,
    },
    permissionCodes: [
      "core.users.manage",
      "core.roles.manage",
      "core.companies.manage",
      "core.modules.manage",
      "core.audit.read",
      "dashboard.financials.view",
      "dashboard.intelligence.view",
      "projects.view",
      "projects.manage",
      "projects.requisitions.create",
      "projects.requisitions.approve",
      "inventory.catalog.view",
      "inventory.stock.manage",
      "inventory.dispatch.create",
      "inventory.return.create",
      "inventory.tools.manage",
      "inventory.kardex.view",
    ],
  },
  {
    id: "role-resident-engineer",
    code: "resident_engineer",
    name: "Ingeniero Residente / Director de Obra",
    description: "Gestión técnica de obras asignadas, control de insumos en frente de trabajo y solicitud de materiales.",
    level: 2,
    dashboardVisibility: {
      canViewCompanyFinances: false, // Solo ve avance de su obra, no el balance de toda la empresa
      canViewAllProjects: false,
      canViewTopMaterialsCost: true,
      canViewWarehouseAlerts: false,
      canApproveRequisitions: true,
      canDispatchMaterial: false,
      canManageTools: true,
    },
    permissionCodes: [
      "dashboard.intelligence.view",
      "projects.view",
      "projects.requisitions.create",
      "projects.requisitions.approve",
      "inventory.catalog.view",
      "inventory.return.create",
      "inventory.tools.manage",
    ],
  },
  {
    id: "role-warehouse-lead",
    code: "warehouse_lead",
    name: "Jefe de Almacén / Bodeguero",
    description: "Administración física del stock, alertas de reposición, emisión de remisiones de salida y custodia de equipos.",
    level: 3,
    dashboardVisibility: {
      canViewCompanyFinances: false,
      canViewAllProjects: true,
      canViewTopMaterialsCost: false,
      canViewWarehouseAlerts: true, // Máxima prioridad: stocks críticos y requisiciones entrantes
      canApproveRequisitions: true,
      canDispatchMaterial: true,
      canManageTools: true,
    },
    permissionCodes: [
      "projects.view",
      "inventory.catalog.view",
      "inventory.stock.manage",
      "inventory.dispatch.create",
      "inventory.return.create",
      "inventory.tools.manage",
      "inventory.kardex.view",
    ],
  },
  {
    id: "role-foreman",
    code: "foreman",
    name: "Maestro de Obra / Cuadrilla",
    description: "Operación en campo: solicitudes rápidas de material para su frente, herramientas asignadas y devolución de sobrantes.",
    level: 4,
    dashboardVisibility: {
      canViewCompanyFinances: false,
      canViewAllProjects: false,
      canViewTopMaterialsCost: false,
      canViewWarehouseAlerts: false,
      canApproveRequisitions: false,
      canDispatchMaterial: false,
      canManageTools: false,
    },
    permissionCodes: [
      "projects.view",
      "projects.requisitions.create",
      "inventory.catalog.view",
      "inventory.return.create",
    ],
  },
  {
    id: "role-auditor",
    code: "auditor",
    name: "Auditor / Contador de Costos",
    description: "Revisión analítica de Kardex, comprobantes de salida, valorización de inventarios e imputaciones por centro de costos.",
    level: 5,
    dashboardVisibility: {
      canViewCompanyFinances: true,
      canViewAllProjects: true,
      canViewTopMaterialsCost: true,
      canViewWarehouseAlerts: false,
      canApproveRequisitions: false,
      canDispatchMaterial: false,
      canManageTools: false,
    },
    permissionCodes: [
      "core.audit.read",
      "dashboard.financials.view",
      "dashboard.intelligence.view",
      "projects.view",
      "inventory.catalog.view",
      "inventory.kardex.view",
    ],
  },
];

export const administratorRole = employeeRoles[0];
