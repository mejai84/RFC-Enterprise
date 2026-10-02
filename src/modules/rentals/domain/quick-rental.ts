export type QuickRentalStatus = "active" | "returned" | "overdue";

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
  returnNotes?: string;
  extraCharge?: number;
};

export function rentalDays(pickupAt: string, dueAt: string): number {
  const milliseconds = new Date(dueAt).getTime() - new Date(pickupAt).getTime();
  return Math.max(1, Math.ceil(milliseconds / 86_400_000));
}

export function nextQuickRentalCode(rentals: QuickRental[], date = new Date()): string {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const count = rentals.filter((rental) => rental.code.startsWith(`ALQ-RAP-${day}-`)).length + 1;
  return `ALQ-RAP-${day}-${String(count).padStart(3, "0")}`;
}
