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

export const sampleInitialRequisitions: MaterialRequisition[] = [];

