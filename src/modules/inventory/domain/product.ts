export type ProductUnit = "unidad" | "metro" | "kilogramo" | "litro" | "paquete";

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: ProductUnit;
  /** Cantidad mínima estimada; por debajo se considera existencias bajas. */
  minStock: number;
  active: boolean;
};
