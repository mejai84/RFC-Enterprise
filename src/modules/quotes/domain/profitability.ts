import type { Quote } from "./quote";
import { calculateTotalCost } from "./quote";

export type QuoteProfitability = { cost: number; sale: number; profit: number; marginPercent: number | null; level: "missing" | "danger" | "warning" | "healthy"; label: string; };

/** Control comercial previo al envio; no modifica el pre-costeo. */
export function calculateQuoteProfitability(quote: Pick<Quote, "costBreakdown" | "estimatedValue">): QuoteProfitability {
  const cost = calculateTotalCost(quote.costBreakdown);
  const sale = quote.estimatedValue ?? 0;
  if (sale <= 0 || cost <= 0) return { cost, sale, profit: sale - cost, marginPercent: null, level: "missing", label: "Falta costo o valor de venta" };
  const profit = sale - cost;
  const marginPercent = (profit / sale) * 100;
  if (marginPercent < 0) return { cost, sale, profit, marginPercent, level: "danger", label: "La propuesta genera pérdida" };
  if (marginPercent < 10) return { cost, sale, profit, marginPercent, level: "danger", label: "Margen menor al 10 %" };
  if (marginPercent < 20) return { cost, sale, profit, marginPercent, level: "warning", label: "Margen menor al 20 %" };
  return { cost, sale, profit, marginPercent, level: "healthy", label: "Margen saludable" };
}