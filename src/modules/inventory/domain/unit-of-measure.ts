export type UnitOfMeasure = { code: string; name: string; symbol: string; baseCode?: string; factor?: number };
export const inventoryUnits: UnitOfMeasure[] = [
  { code: "unit", name: "Unidad", symbol: "und" }, { code: "pair", name: "Par", symbol: "par" },
  { code: "meter", name: "Metro", symbol: "m" }, { code: "kilogram", name: "Kilogramo", symbol: "kg" },
  { code: "liter", name: "Litro", symbol: "L" }, { code: "gallon", name: "Galón", symbol: "gal", baseCode: "liter", factor: 3.785 },
  { code: "bag", name: "Bulto", symbol: "bulto" }, { code: "box", name: "Caja", symbol: "caja" },
  { code: "cubic_meter", name: "Metro cúbico", symbol: "m³" }, { code: "can", name: "Caneca", symbol: "caneca" },
];
