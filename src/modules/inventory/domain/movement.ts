export type MovementType = "entry" | "exit" | "adjustment" | "return";

export type InventoryMovement = {
  id: string;
  productId: string;
  productName?: string;
  type: MovementType;
  quantity: number;
  unit?: string;
  unitCost: number; // Costo unitario en COP
  totalCost: number; // Cantidad * Costo unitario en COP
  occurredAt: string;
  reference: string; // N° de Orden, Vale o Factura
  projectId?: string; // Obra / Proyecto de destino
  projectName?: string;
  responsible?: string;
  notes?: string;
};
