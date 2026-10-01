export type ApuCategory = "materials" | "equipment" | "labor" | "transport";

export type ApuLine = {
  id: string;
  category: ApuCategory;
  name: string;
  quantity: number;
  yieldPerDay: number;
  dailyRate: number;
  inventoryProductId?: string;
  unit?: string;
};

export type Apu = {
  id: string;
  code: string;
  name: string;
  unit: string;
  workQuantity: number;
  lines: ApuLine[];
  createdAt: string;
  updatedAt: string;
};

export const apuCategoryMeta: Record<ApuCategory, { label: string; description: string }> = {
  equipment: { label: "Equipos y herramientas", description: "Tarifa diaria x cantidad x rendimiento" },
  materials: { label: "Materiales", description: "Cantidad x tarifa unitaria del inventario" },
  labor: { label: "Mano de obra", description: "Cantidad x salario diario x rendimiento" },
  transport: { label: "Transporte", description: "Cantidad x tarifa x rendimiento" },
};

export function lineTotal(line: ApuLine) {
  const factor = line.category === "materials" ? 1 : line.yieldPerDay || 1;
  return line.quantity * line.dailyRate * factor;
}

export function apuTotal(apu: Apu) {
  return apu.lines.reduce((total, line) => total + lineTotal(line), 0);
}
