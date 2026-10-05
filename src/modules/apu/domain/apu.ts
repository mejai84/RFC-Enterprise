export type ApuCategory = "materials" | "equipment" | "labor" | "transport";

export type ApuCategoryMargins = Partial<Record<ApuCategory, number>>;

export const defaultApuMargins: Record<ApuCategory, number> = {
  materials: 10,
  labor: 25,
  equipment: 15,
  transport: 10,
};

export type ApuLine = {
  id: string;
  category: ApuCategory;
  name: string;
  quantity: number;
  yieldPerDay: number;
  dailyRate: number;
  inventoryProductId?: string;
  laborPositionId?: string;
  laborCode?: string;
  laborLevel?: number;
  laborActivityType?: "propias" | "no_propias";
  transportItemId?: string;
  transportCode?: string;
  unit?: string;
};

export type Apu = {
  id: string;
  code: string;
  name: string;
  unit: string;
  workQuantity: number;
  lines: ApuLine[];
  categoryMargins?: ApuCategoryMargins;
  quoteId?: string;
  quoteCode?: string;
  projectId?: string;
  revision?: number;
  versionId?: string;
  status?: "draft" | "in_review" | "approved" | "superseded" | "archived";
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

export function lineSellingTotal(line: ApuLine, margins?: ApuCategoryMargins) {
  const cost = lineTotal(line);
  const margin = margins?.[line.category] ?? defaultApuMargins[line.category] ?? 0;
  return cost * (1 + margin / 100);
}

export function apuCostTotal(apu: Apu) {
  return apu.lines.reduce((total, line) => total + lineTotal(line), 0);
}

export function apuTotal(apu: Apu) {
  return apuCostTotal(apu);
}

export function apuSellingTotal(apu: Apu) {
  return apu.lines.reduce((total, line) => total + lineSellingTotal(line, apu.categoryMargins), 0);
}

export function apuProfitAmount(apu: Apu) {
  return apuSellingTotal(apu) - apuCostTotal(apu);
}

export function apuEffectiveMarginPercent(apu: Apu) {
  const cost = apuCostTotal(apu);
  return cost > 0 ? (apuProfitAmount(apu) / cost) * 100 : 0;
}

export function apuCostBreakdown(apus: ReadonlyArray<Apu>) {
  return apus.reduce(
    (total, apu) => {
      for (const line of apu.lines) {
        total[line.category] += lineTotal(line);
      }
      return total;
    },
    { materials: 0, equipment: 0, labor: 0, transport: 0 },
  );
}

export function apuSellingBreakdown(apus: ReadonlyArray<Apu>) {
  return apus.reduce(
    (total, apu) => {
      for (const line of apu.lines) {
        total[line.category] += lineSellingTotal(line, apu.categoryMargins);
      }
      return total;
    },
    { materials: 0, equipment: 0, labor: 0, transport: 0 },
  );
}
