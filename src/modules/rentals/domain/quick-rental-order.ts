/* ─────────────────────────────────────────────────────────────
 * Módulo Alquiler rápido – Documento con múltiples equipos
 *
 * Un documento tiene una cabecera (cliente, periodo y firma) y varias
 * líneas. Cada línea conserva su propia cantidad, tarifa, garantía,
 * devolución parcial y recargo. Es el contrato que consumen la pantalla,
 * los informes y el resumen del dashboard.
 * ───────────────────────────────────────────────────────────── */

export type QuickRentalOrderStatus =
  | "active"
  | "partially_returned"
  | "returned"
  | "overdue";

export type QuickRentalOrderLine = {
  id: string;
  inventoryItemId: string | null;
  equipmentName: string;
  quantity: number;
  dailyRate: number;
  deposit: number;
  returnedQuantity: number;
  returnedAt?: string;
  returnNotes?: string;
  extraCharge: number;
};

export type QuickRentalOrder = {
  id: string;
  code: string;
  customerName: string;
  customerPhone?: string;
  customerDocument?: string;
  pickupAt: string;
  dueAt: string;
  status: QuickRentalOrderStatus;
  deliveryNotes?: string;
  lines: QuickRentalOrderLine[];
  signaturePath?: string;
  createdAt?: string;
};

/** Equipo disponible para alquilar, calculado contra la bodega persistida. */
export type RentableEquipment = {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  inventoryGroup: string;
  inventoryGroupName: string;
  stock: number;
  rented: number;
  available: number;
  unitCost: number;
};

export type CreateQuickRentalOrderLine = {
  inventoryItemId: string;
  equipmentName: string;
  quantity: number;
  dailyRate: number;
  deposit: number;
};

export type CreateQuickRentalOrderInput = {
  customerName: string;
  customerPhone?: string;
  customerDocument?: string;
  pickupAt: string;
  dueAt: string;
  deliveryNotes?: string;
  lines: CreateQuickRentalOrderLine[];
  signatureDataUrl: string;
};

export type CreateQuickRentalOrderResult = {
  orderId: string;
  code: string;
  signatureWarning?: string;
};

export type ReturnQuickRentalLineInput = {
  orderId: string;
  lineId: string;
  quantity: number;
  notes: string;
  extraCharge: number;
};

export const quickRentalStatusLabels: Record<QuickRentalOrderStatus, string> = {
  active: "Activo",
  partially_returned: "Devolución parcial",
  returned: "Devuelto",
  overdue: "Vencido",
};

/** Días facturables del documento. Un mismo periodo aplica a todas las líneas. */
export function quickRentalDays(pickupAt: string, dueAt: string): number {
  const milliseconds = new Date(dueAt).getTime() - new Date(pickupAt).getTime();
  if (!Number.isFinite(milliseconds)) return 1;
  return Math.max(1, Math.ceil(milliseconds / 86_400_000));
}

export function quickRentalLineSubtotal(
  line: Pick<QuickRentalOrderLine, "quantity" | "dailyRate" | "extraCharge">,
  days: number,
): number {
  return line.quantity * days * line.dailyRate + line.extraCharge;
}

/** Renta del documento: días × tarifa × cantidad, más recargos. */
export function quickRentalOrderRentTotal(order: QuickRentalOrder): number {
  const days = quickRentalDays(order.pickupAt, order.dueAt);
  return order.lines.reduce(
    (total, line) => total + quickRentalLineSubtotal(line, days),
    0,
  );
}

/** Garantía del documento: garantía unitaria × cantidad de cada línea. */
export function quickRentalOrderDepositTotal(order: QuickRentalOrder): number {
  return order.lines.reduce(
    (total, line) => total + line.deposit * line.quantity,
    0,
  );
}

export function quickRentalOrderReturnedQuantity(order: QuickRentalOrder): number {
  return order.lines.reduce(
    (total, line) => total + line.returnedQuantity,
    0,
  );
}

export function quickRentalOrderTotalQuantity(order: QuickRentalOrder): number {
  return order.lines.reduce((total, line) => total + line.quantity, 0);
}

export function quickRentalOrderPendingQuantity(order: QuickRentalOrder): number {
  return Math.max(
    0,
    quickRentalOrderTotalQuantity(order) - quickRentalOrderReturnedQuantity(order),
  );
}

export function quickRentalLinePending(line: QuickRentalOrderLine): number {
  return Math.max(0, line.quantity - line.returnedQuantity);
}

export function quickRentalLineIsReturned(line: QuickRentalOrderLine): boolean {
  return line.returnedQuantity >= line.quantity;
}

/** Estado real para la interfaz: el vencimiento se deriva de la fecha. */
export function quickRentalDisplayStatus(
  order: QuickRentalOrder,
  now = Date.now(),
): QuickRentalOrderStatus {
  if (order.status === "returned") return "returned";
  if (new Date(order.dueAt).getTime() < now) return "overdue";
  return order.status;
}
