export type RequisitionStatus = "pending" | "approved" | "rejected" | "dispatched";

export type RequisitionItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
};

export type MaterialRequisition = {
  id: string;
  code: string; // REQ-2026-001
  projectId: string;
  projectName: string;
  requestedBy: string; // ej. Carlos Restrepo (Maestro de Obra)
  status: RequisitionStatus;
  createdAt: string;
  neededByDate?: string;
  notes?: string;
  items: RequisitionItem[];
};

export const sampleInitialRequisitions: MaterialRequisition[] = [
  {
    id: "req-01",
    code: "REQ-2026-001",
    projectId: "prj-01",
    projectName: "Construcción Estructura Metálica y Cubierta",
    requestedBy: "Carlos Restrepo (Maestro)",
    status: "pending",
    createdAt: "2026-03-15 08:30",
    neededByDate: "2026-03-18",
    notes: "Material urgente para fundición de columnas secundarias",
    items: [
      { productId: "prod-1", productName: "Cemento Gris Tipo 1", quantity: 30, unit: "bulto", unitCost: 32000 },
      { productId: "prod-2", productName: "Varilla Corrugada 1/2 pulg", quantity: 15, unit: "unidad", unitCost: 68000 },
    ],
  },
  {
    id: "req-02",
    code: "REQ-2026-002",
    projectId: "prj-02",
    projectName: "Mantenimiento Integral de Instalaciones Industriales",
    requestedBy: "Javier Morales (Ing. Residente)",
    status: "dispatched",
    createdAt: "2026-03-12 11:00",
    neededByDate: "2026-03-14",
    notes: "Protección anticorrosiva tanques etapa 2",
    items: [
      { productId: "prod-3", productName: "Pintura Anticorrosiva Verde", quantity: 6, unit: "galon", unitCost: 95000 },
    ],
  },
];
