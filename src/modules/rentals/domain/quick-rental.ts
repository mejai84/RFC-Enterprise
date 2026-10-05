export type QuickRentalStatus = "active" | "returned" | "overdue";
export type AttachmentKind = "id_document" | "equipment_photo" | "signature" | "other";

export type QuickRentalAttachment = {
  id: string;
  rentalId: string;
  kind: AttachmentKind;
  storagePath: string;
  fileName?: string;
  mimeType?: string;
  uploadedAt: string;
};

export type QuickRental = {
  id: string;
  code: string;
  equipmentId: string;
  equipmentName: string;
  customerName: string;
  customerPhone: string;
  customerDocument: string;
  pickupAt: string;
  dueAt: string;
  returnedAt?: string;
  dailyRate: number;
  deposit: number;
  status: QuickRentalStatus;
  deliveryNotes?: string;
  deliverySignatureDataUrl?: string;
  returnNotes?: string;
  extraCharge?: number;
  attachments?: QuickRentalAttachment[];
  // Campos opcionales para facturación
  companyId?: string;
  branchId?: string;
};

export function rentalDays(pickupAt: string, dueAt: string): number {
  const milliseconds = new Date(dueAt).getTime() - new Date(pickupAt).getTime();
  return Math.max(1, Math.ceil(milliseconds / 86_400_000));
}

export function rentalTotal(rental: QuickRental): number {
  const days = rentalDays(rental.pickupAt, rental.dueAt);
  return days * rental.dailyRate + (rental.extraCharge ?? 0);
}

export function nextQuickRentalCode(rentals: QuickRental[], date = new Date()): string {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const count = rentals.filter((rental) => rental.code.startsWith(`ALQ-RAP-${day}-`)).length + 1;
  return `ALQ-RAP-${day}-${String(count).padStart(3, "0")}`;
}

export const ATTACHMENT_LABELS: Record<AttachmentKind, string> = {
  id_document:     "Cédula / Documento",
  equipment_photo: "Foto del equipo",
  signature:       "Firma del cliente",
  other:           "Otro adjunto",
};
