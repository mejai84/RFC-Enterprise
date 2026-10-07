"use client";

/**
 * Cantidades del APU: admiten decimales escritos con coma o punto y se presentan
 * en formato colombiano con máximo dos decimales.
 *
 * Se evita `type="number"` a propósito: en muchos navegadores el separador decimal
 * del campo depende de la configuración regional y no es confiable escribir "1,2345".
 */

const MAX_DECIMALS = 2;

/**
 * Convierte lo que el usuario escribió en un número.
 * Acepta coma o punto como separador decimal, y no rompe con separadores de miles.
 *   "1,2345" -> 1.2345   "1.2345" -> 1.2345   "1.234,56" -> 1234.56
 *   "12 und" -> 12        "" o "-" -> 0
 */
export function parseApuQuantityInput(value: string): number {
  const raw = value.trim().replace(/\s/g, "");
  if (!raw || raw === "-" || raw === "," || raw === ".") return 0;

  // Se permite el signo solo al inicio.
  const negative = raw.startsWith("-");
  const cleaned = raw.replace(/^-/, "").replace(/[^0-9.,]/g, "");
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // El último separador que aparece es el decimal.
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    // Solo hay comas: si hay más de una, son separadores de miles.
    normalized = cleaned.split(",").length > 2 ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".");
  } else if (lastDot > -1) {
    // Solo hay puntos: igual criterio que con las comas.
    const parts = cleaned.split(".");
    normalized = parts.length > 2 ? cleaned.replace(/\./g, "") : cleaned;
  } else {
    normalized = cleaned;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  const value2 = negative ? -parsed : parsed;
  // Un rendimiento o cantidad nunca puede ser negativo.
  return value2 < 0 ? 0 : value2;
}

/** Texto editable: sin formato de miles, con el separador decimal que el usuario escribió. */
export function formatApuQuantityInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "0";
  return String(Number(value.toFixed(MAX_DECIMALS)));
}

/** Presentación: formato colombiano con máximo dos decimales. */
export function formatApuQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("es-CO", { maximumFractionDigits: MAX_DECIMALS });
}

/** Redondea al máximo de decimales admitidos, para no arrastrar ruido en los cálculos. */
export function roundApuQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(MAX_DECIMALS));
}

/** Valor seguro para los cálculos de costo por unidad. */
export function safeApuQuantity(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
