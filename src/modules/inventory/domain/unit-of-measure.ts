export type UnitOfMeasure = {
  code: string;
  name: string;
  symbol: string;
  baseCode?: string;
  factor?: number;
};

export const inventoryUnits: UnitOfMeasure[] = [
  { code: "unit", name: "Unidad", symbol: "und" },
  { code: "pair", name: "Par", symbol: "par" },
  { code: "meter", name: "Metro", symbol: "m" },
  { code: "centimeter", name: "Centímetro", symbol: "cm" },
  { code: "millimeter", name: "Milímetro", symbol: "mm" },
  { code: "square_meter", name: "Metro cuadrado", symbol: "m²" },
  { code: "cubic_meter", name: "Metro cúbico", symbol: "m³" },
  { code: "kilogram", name: "Kilogramo", symbol: "kg" },
  { code: "gram", name: "Gramo", symbol: "g" },
  { code: "pound", name: "Libra", symbol: "lb" },
  { code: "ounce", name: "Onza", symbol: "oz" },
  { code: "liter", name: "Litro", symbol: "L" },
  { code: "milliliter", name: "Mililitro", symbol: "mL" },
  {
    code: "gallon",
    name: "Galón",
    symbol: "gal",
    baseCode: "liter",
    factor: 3.785,
  },
  { code: "hour", name: "Hora", symbol: "h" },
  { code: "day", name: "Día", symbol: "día" },
  { code: "bag", name: "Bulto", symbol: "bulto" },
  { code: "box", name: "Caja", symbol: "caja" },
  { code: "can", name: "Caneca", symbol: "caneca" },
];
