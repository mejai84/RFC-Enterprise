export type MovementType = "entrada" | "salida";

export type MovementReason =
  | "compra"
  | "ajuste_positivo"
  | "devolucion"
  | "consumo_proyecto"
  | "venta"
  | "ajuste_negativo"
  | "merma";

/** Asiento inmutable de inventario. El saldo se deriva de la suma de movimientos. */
export type StockMovement = {
  id: string;
  productId: string;
  branchId: string;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  note: string | null;
  registeredBy: string;
  occurredAt: Date;
};

/** Existencia de un producto en una sede, calculada a partir de los movimientos. */
export type StockLevel = {
  productId: string;
  branchId: string;
  quantity: number;
  lowStock: boolean;
};
