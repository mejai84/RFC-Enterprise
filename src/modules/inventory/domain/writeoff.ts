/** Bajas de inventario por deterioro, daño, vencimiento, pérdida u obsolescencia (INV-008). */

export const WRITEOFF_REASONS = [
  { value: "deterioro", label: "Deterioro por uso" },
  { value: "daño", label: "Daño" },
  { value: "vencimiento", label: "Vencimiento" },
  { value: "perdida", label: "Pérdida" },
  { value: "obsoleto", label: "Obsolescencia técnica" },
] as const;

export type WriteoffReason = (typeof WRITEOFF_REASONS)[number]["value"];

export const WRITEOFF_STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "pending_approval", label: "Pendiente de aprobación" },
  { value: "approved", label: "Aprobada" },
  { value: "rejected", label: "Rechazada" },
  { value: "applied", label: "Aplicada al inventario" },
] as const;

export type WriteoffStatus = (typeof WRITEOFF_STATUSES)[number]["value"];

export type Writeoff = {
  id: string;
  code: string;
  branchId: string;
  itemName: string;
  unit: string;
  reason: WriteoffReason;
  quantity: number;
  unitCost: number;
  totalValue: number;
  availableBefore: number;
  status: WriteoffStatus;
  requiresApproval: boolean;
  notes: string | null;
  evidencePaths: string[];
  requestedByName: string;
  requestedAt: string;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  appliedAt: string | null;
};

export const writeoffReasonLabel = (reason: string) =>
  WRITEOFF_REASONS.find((option) => option.value === reason)?.label ?? reason;

export const writeoffStatusLabel = (status: string) =>
  WRITEOFF_STATUSES.find((option) => option.value === status)?.label ?? status;

/** Una baja solo puede tocarse mientras no haya producido movimiento en el kardex. */
export const isWriteoffPending = (status: WriteoffStatus) =>
  status === "draft" || status === "pending_approval" || status === "approved";

/** Valor total de la baja, usado para comparar contra el umbral de aprobación. */
export const writeoffValue = (quantity: number, unitCost: number) =>
  Math.round(quantity * unitCost * 100) / 100;
